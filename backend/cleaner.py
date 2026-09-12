import re
import json
import httpx
from typing import Optional, Dict, Any, List, Tuple

# Regex patterns for speech cleanup
# 1. Emojis and miscellaneous symbols/pictographs
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA70-\U0001FAFF"  # symbols & pictographs extended-A
    "]+",
    flags=re.UNICODE
)

# 2. Markdown links: [anchor text](https://url) -> anchor text
MD_LINK_PATTERN = re.compile(r'\[([^\]]+)\]\([^)]+\)')

# 3. Markdown images: ![alt](url) -> ""
MD_IMAGE_PATTERN = re.compile(r'!\[[^\]]*\]\([^)]+\)')

# 4. Bare URLs: https://... or http://... -> ""
URL_PATTERN = re.compile(r'https?://[^\s)\]]+')

# 5. Citation brackets e.g. [1], [2, 3], [citation needed], [source]
CITATION_PATTERN = re.compile(r'\[(?:\d+(?:,\s*\d+)*|[a-zA-Z\s]{1,20})\]')

# 6. Markdown headings markers at start of line
HEADING_PATTERN = re.compile(r'^\s*#{1,6}\s*', flags=re.MULTILINE)

# 7. Markdown blockquotes
BLOCKQUOTE_PATTERN = re.compile(r'^\s*>\s*', flags=re.MULTILINE)

# 8. Markdown code fences: ```lang ... ``` -> content inside
CODE_FENCE_PATTERN = re.compile(r'```[a-zA-Z0-9_-]*\n?(.*?)\n?```', flags=re.DOTALL)

# 9. Markdown inline code: `code` -> code
INLINE_CODE_PATTERN = re.compile(r'`([^`]+)`')

# 10. Table separator rows: |---|---| or |:---:|
TABLE_SEP_PATTERN = re.compile(r'\|?(\s*:?-+:?\s*\|)+\s*')

# 11. Repeated table pipes: | col1 | col2 | -> col1, col2
TABLE_PIPE_PATTERN = re.compile(r'^\s*\||\|\s*$')

# 12. Markdown bold/italic/strikethrough emphasis: **text**, *text*, __text__, _text_, ~~text~~
# We clean markdown markers:
# - double asterisks or tildes: ** or ~~
# - standalone emphasis asterisks: *word*
# - emphasis underscores at word boundaries: \b_\w+_\b or spaces
EMPHASIS_BOLD_PATTERN = re.compile(r'(\*{2,3}|_{2,3}|~~)')
EMPHASIS_ITALIC_STAR = re.compile(r'(?<!\S)\*([^\*\n]+)\*(?!\S)')
EMPHASIS_ITALIC_UNDERSCORE = re.compile(r'(?<!\S)_([^_\n]+)_(?!\S)')


def clean_text_for_speech(text: str) -> str:
    """
    Deterministically cleans text to produce natural, smooth speech output:
    - Strips emojis and pictographs
    - Converts markdown links to plain anchor text
    - Removes raw URLs and image tags
    - Strips citation brackets [1], [2]
    - Strips heading hashes, blockquote markers, table syntax
    - Removes markdown asterisks/underscores/tildes
    - Normalizes excessive whitespace and punctuation
    """
    if not text:
        return ""

    s = text

    # Remove code fences first (keeping text inside)
    s = CODE_FENCE_PATTERN.sub(r'\1', s)
    
    # Inline code
    s = INLINE_CODE_PATTERN.sub(r'\1', s)

    # Remove images
    s = MD_IMAGE_PATTERN.sub('', s)

    # Convert links [Title](URL) -> Title
    s = MD_LINK_PATTERN.sub(r'\1', s)

    # Remove raw URLs
    s = URL_PATTERN.sub('', s)

    # Remove citations [1], [citation needed]
    s = CITATION_PATTERN.sub('', s)

    # Remove heading markers
    s = HEADING_PATTERN.sub('', s)

    # Remove blockquote markers
    s = BLOCKQUOTE_PATTERN.sub('', s)

    # Remove table separators
    s = TABLE_SEP_PATTERN.sub('', s)
    
    # Replace remaining pipes with commas or spaces
    s = TABLE_PIPE_PATTERN.sub('', s)
    s = s.replace('|', ', ')

    # Remove bold / strike markers like **, __, ~~
    s = EMPHASIS_BOLD_PATTERN.sub('', s)

    # Clean italic markers while leaving internal_underscores_in_code intact
    s = EMPHASIS_ITALIC_STAR.sub(r'\1', s)
    s = EMPHASIS_ITALIC_UNDERSCORE.sub(r'\1', s)


    # Strip emojis
    s = EMOJI_PATTERN.sub('', s)

    # Clean bullet points at start of line (*, -, +)
    s = re.sub(r'^\s*[-*+]\s+', '', s, flags=re.MULTILINE)

    s = re.sub(r'[\r\t]', ' ', s)

    # Normalize multiple whitespace, dashes, and duplicate punctuation
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r'(\n\s*){3,}', '\n\n', s)
    s = re.sub(r'([.,!?])\1+', r'\1', s)

    return s.strip()

DEFAULT_CLEAN_PROMPT = (
    "You are a text pre-processor for a Text-to-Speech (TTS) voice synthesizer. "
    "Clean and normalize the following text so that it reads naturally when spoken out loud. "
    "Rules:\n"
    "1. Remove all emojis, markdown syntax, raw URLs, and citation brackets (e.g. [1]).\n"
    "2. Spell out awkward abbreviations or symbols (e.g. '%', '&', '@') if helpful for pronunciation.\n"
    "3. Keep the exact core meaning, tone, and information intact without adding commentary or meta-text.\n"
    "4. Return ONLY the cleaned text and nothing else."
)

async def llm_clean_text(
    text: str,
    llm_base_url: str,
    llm_api_key: str = "",
    llm_model: str = "gpt-4o-mini",
    prompt: Optional[str] = None,
    timeout: float = 20.0
) -> str:
    """
    Optionally send text to an OpenAI-compatible /chat/completions endpoint
    to rewrite/normalize text for TTS synthesis. Falls back to regex-cleaned text on failure.
    """
    if not text.strip():
        return ""

    regex_cleaned = clean_text_for_speech(text)
    if not llm_base_url:
        return regex_cleaned

    endpoint = f"{llm_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json"
    }
    if llm_api_key:
        headers["Authorization"] = f"Bearer {llm_api_key}"

    system_prompt = prompt.strip() if prompt and prompt.strip() else DEFAULT_CLEAN_PROMPT

    payload: Dict[str, Any] = {
        "model": llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0.2
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content.strip():
                    return clean_text_for_speech(content.strip())
    except Exception:
        pass

    return regex_cleaned


async def llm_generate_title_and_tags(
    content: str,
    existing_tags: Optional[list] = None,
    llm_base_url: str = "",
    llm_api_key: str = "",
    llm_model: str = "gpt-4o-mini",
    timeout: float = 20.0
) -> tuple[Optional[str], list]:
    """
    Generate a concise title and 1-3 broad category tags using an OpenAI-compatible LLM.
    Enforces a strict global limit of at most 50 unique tags in the library:
    - If existing_tags has >= 50 tags, the LLM MUST strictly select only from existing_tags.
    - If existing_tags has < 50 tags, the LLM prefers existing tags and only creates a new one if necessary.
    - Tags must be lowercase, alphanumeric/hyphenated words representing broad categories.
    """
    if not content or not content.strip() or not llm_base_url:
        return None, []

    existing = [t.strip().lower() for t in (existing_tags or []) if t and t.strip()]
    unique_existing = sorted(list(set(existing)))
    tag_count = len(unique_existing)

    if tag_count >= 50:
        tag_instruction = (
            f"CRITICAL CONSTRAINT: The library has reached its maximum global limit of 50 categories ({tag_count}/50).\n"
            f"You MUST select 1 to 3 tags EXCLUSIVELY from the following list of existing categories. DO NOT invent or return any new tag outside this list:\n"
            f"{json.dumps(unique_existing)}"
        )
    elif tag_count > 0:
        tag_instruction = (
            f"There are currently {tag_count}/50 categories in the library. PREFER selecting 1 to 3 tags from this existing list:\n"
            f"{json.dumps(unique_existing)}\n"
            f"Only create a new tag if none of the existing categories fit. "
            f"A tag must be a single, broad high-level category (e.g. 'technology', 'science', 'philosophy', 'health', 'finance'), never hyper-specific keywords."
        )
    else:
        tag_instruction = (
            "Select 1 to 3 broad, high-level categorical tags for this note (e.g. 'technology', 'science', 'philosophy', 'health', 'news'). "
            "Tags must be broad categories, not hyper-specific phrases."
        )

    system_prompt = (
        "You are an expert librarian and taxonomy classifier. Your job is to analyze the provided text and output a concise title and 1-3 category tags.\n"
        "Guidelines:\n"
        "1. Title: 3 to 8 words, descriptive, title case, no punctuation at the end.\n"
        "2. Tags: 1 to 3 broad category tags. Must be lowercase, only letters, numbers, and hyphens (no hashtags, spaces, or emojis).\n"
        f"3. {tag_instruction}\n"
        "4. You MUST respond with ONLY a valid JSON object matching this schema:\n"
        '{"title": "Descriptive Note Title", "tags": ["category1", "category2"]}'
    )

    sample_content = content[:3000].strip()

    endpoint = f"{llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if llm_api_key:
        headers["Authorization"] = f"Bearer {llm_api_key}"

    payload = {
        "model": llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Document text excerpt:\n\n{sample_content}"}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                # If json_object format is rejected by a third-party server, retry without response_format
                if "response_format" in resp.text:
                    payload.pop("response_format", None)
                    resp = await client.post(endpoint, json=payload, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                raw_answer = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                # Parse JSON
                parsed = json.loads(raw_answer)
                title = parsed.get("title")
                tags = parsed.get("tags") or []
                
                # Sanitize title
                clean_title = str(title).strip() if title else None
                if clean_title:
                    clean_title = re.sub(r'[\r\n\t]+', ' ', clean_title).strip('"\';:')

                # Sanitize tags
                clean_tags = []
                for t in tags:
                    norm = re.sub(r'[^a-z0-9\-]', '', str(t).lower().replace(' ', '-')).strip('-')
                    if norm and norm not in clean_tags:
                        if tag_count >= 50 and norm not in unique_existing:
                            continue  # Skip illegal new tags when at 50 capacity
                        clean_tags.append(norm)

                return clean_title, clean_tags[:3]
    except Exception:
        pass

    return None, []
