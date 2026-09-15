import re
import json
import logging
import httpx
from typing import Optional, Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

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

# 6. Markdown heading markers: start-of-line (multiline) + any inline ## after joining
HEADING_PATTERN = re.compile(r'^\s*#{1,6}\s*', flags=re.MULTILINE)
# Catches any residual #{1,6} mid-string (e.g. after chunker joins lines with " ".join())
INLINE_HEADING_PATTERN = re.compile(r'#{1,6}\s*')

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


def apply_glossary(text: str, glossary: Optional[List[Dict[str, str]]] = None) -> str:
    """Apply custom phonetic or acronym substitutions based on user glossary."""
    if not text or not glossary:
        return text
    result = text
    for item in glossary:
        find = item.get("find", "").strip() if isinstance(item, dict) else ""
        replace = item.get("replace", "").strip() if isinstance(item, dict) else ""
        if find:
            # Word boundary regex with case insensitivity
            pattern = re.compile(r'\b' + re.escape(find) + r'\b', re.IGNORECASE)
            result = pattern.sub(replace, result)
    return result


def format_code_fences_for_speech(text: str) -> str:
    """
    Transforms markdown code fences (```lang ... ```) into conversational spoken language.
    Instead of reciting brackets, syntax, and semicolons, it identifies the language
    and formats commands and code into readable spoken sentences.
    """
    pattern = re.compile(r'```([a-zA-Z0-9_-]*)\n?(.*?)\n?```', flags=re.DOTALL)

    def repl(m):
        lang = m.group(1).strip()
        code = m.group(2).strip()
        if not code:
            return ""

        lang_label = lang.lower() if lang else ""
        is_shell = lang_label in ("bash", "sh", "zsh", "shell", "cmd", "powershell")
        lines = [l.strip() for l in code.split("\n") if l.strip()]

        if not lines:
            return ""

        if is_shell or len(lines) <= 2:
            lead = f"Command in {lang_label}: " if is_shell else (f"Code snippet in {lang}: " if lang else "Code: ")
            joined = " and ".join(lines) if is_shell else ", ".join(lines)
            return f"\n{lead}{joined}.\n"

        lead = f"Code block in {lang}: " if lang else "Code block: "
        cleaned_lines = []
        for l in lines[:4]:
            c = re.sub(r'[{}\[\]();]', ' ', l).strip()
            c = re.sub(r'\s+', ' ', c)
            if c:
                cleaned_lines.append(c)

        inner = ", ".join(cleaned_lines)
        ellipsis = " and continuing." if len(lines) > 4 else "."
        return f"\n{lead}{inner}{ellipsis}\n"

    return pattern.sub(repl, text)


def format_table_for_speech(text: str) -> str:
    """
    Transforms markdown tables (| col | col |) into natural, spoken descriptive sentences.
    e.g.
    | Model | Tier | Cost |
    |---|---|---|
    | Edge | Free | 0 |
    -> "Table details. For Edge: Tier is Free, Cost is 0."
    """
    lines = text.split("\n")
    output_lines = []
    table_buffer = []

    def flush_table(buf: List[str]) -> List[str]:
        if not buf:
            return []
        cleaned_rows = []
        for l in buf:
            stripped = l.strip()
            if re.match(r"^\|?(\s*:?-+:?\s*\|)+\s*$", stripped):
                continue
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if any(cells):
                cleaned_rows.append(cells)

        if len(cleaned_rows) < 2:
            return [" ".join(buf)]

        headers = cleaned_rows[0]
        data_rows = cleaned_rows[1:]
        spoken = ["Table details."]
        for r in data_rows:
            primary = r[0] if len(r) > 0 else ""
            pairs = []
            for i in range(1, len(r)):
                col_name = headers[i] if i < len(headers) else f"Column {i+1}"
                val = r[i]
                if val:
                    pairs.append(f"{col_name} is {val}")
            joined_pairs = ", ".join(pairs)
            if joined_pairs:
                spoken.append(f"For {primary}: {joined_pairs}.")
            elif primary:
                spoken.append(f"{primary}.")
        return [" ".join(spoken)]

    for line in lines:
        if "|" in line and (line.strip().startswith("|") or line.strip().endswith("|")):
            table_buffer.append(line)
        else:
            if table_buffer:
                output_lines.extend(flush_table(table_buffer))
                table_buffer = []
            output_lines.append(line)

    if table_buffer:
        output_lines.extend(flush_table(table_buffer))

    return "\n".join(output_lines)


def clean_text_for_speech(text: str, glossary: Optional[List[Dict[str, str]]] = None) -> str:
    """
    Deterministically cleans text to produce natural, smooth speech output:
    - Strips emojis and pictographs
    - Converts markdown links to plain anchor text
    - Removes raw URLs and image tags
    - Strips citation brackets [1], [2]
    - Strips heading hashes, blockquote markers, table syntax
    - Removes markdown asterisks/underscores/tildes
    - Normalizes excessive whitespace and punctuation
    - Applies custom pronunciation glossary replacements
    """
    if not text:
        return ""

    s = text

    # Apply custom phonetic glossary if provided
    if glossary:
        s = apply_glossary(s, glossary)

    # Format code fences into spoken English before raw syntax stripping
    s = format_code_fences_for_speech(s)

    # Format markdown tables into spoken descriptive sentences
    s = format_table_for_speech(s)
    
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

    # Remove heading markers (start-of-line)
    s = HEADING_PATTERN.sub('', s)
    # Remove any inline heading markers that survived (e.g. ### mid-string after join)
    s = INLINE_HEADING_PATTERN.sub('', s)
    # Absolute safety: strip any stray '#' characters so TTS never vocalizes "hash"
    s = re.sub(r'#+', ' ', s)

    # Remove horizontal rules (---, ***, ___)
    s = re.sub(r'^\s*[-*_]{3,}\s*$', '', s, flags=re.MULTILINE)
    s = re.sub(r'[-*_]{3,}', ' ', s)

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
    "You are an expert text pre-processor for a Text-to-Speech (TTS) voice synthesizer. "
    "Clean, reformat, and normalize the following text so that it reads naturally and pleasantly when spoken out loud. "
    "Rules:\n"
    "1. Remove all emojis, raw URLs, citation brackets (e.g. [1]), and markdown symbols like '#', '***', '---'.\n"
    "2. Code blocks (```): Do NOT read out verbatim brackets, semicolons, or syntax. In conversational spoken English, summarize or describe what the code block or command accomplishes (e.g., 'Command to run the container: docker compose up -d.').\n"
    "3. Tables: Do NOT read raw pipes or repeatedly recite column headers. Reformat tables into smooth, natural spoken sentences (e.g., 'The table compares three options: for Option A, speed is fast; for Option B, speed is medium.').\n"
    "4. Spell out awkward abbreviations or symbols (e.g. '%', '&', '@') if helpful for pronunciation.\n"
    "5. Keep the exact core meaning, tone, and information intact without adding introductory commentary like 'Here is the cleaned text:'.\n"
    "6. Return ONLY the spoken text ready for TTS synthesis."
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

    # Bound output tokens to input length + buffer to prevent rate limit spikes
    estimated_tokens = max(100, int(len(text) / 2))
    payload: Dict[str, Any] = {
        "model": llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0.2,
        "max_tokens": min(estimated_tokens, 1500)
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content.strip():
                    return clean_text_for_speech(content.strip())
            else:
                logger.warning(f"llm_clean_text failed with HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"llm_clean_text error: {str(e)}")

    return regex_cleaned


async def llm_generate_synopsis(
    content: str,
    llm_base_url: str = "",
    llm_api_key: str = "",
    llm_model: str = "gpt-4o-mini",
    timeout: float = 20.0
) -> Optional[str]:
    """
    Generate a punchy, concise 1-2 sentence synopsis (100-180 characters)
    specifically designed to fit library card preview displays.
    """
    if not content or not content.strip() or not llm_base_url:
        return None

    sample_content = content[:3000].strip()
    system_prompt = (
        "You are an expert editorial curator. Summarize the provided document into a concise, "
        "compelling 1-2 sentence synopsis (strictly between 100 and 180 characters) suitable for a "
        "card preview. Focus on the core insight, takeaway, or problem solved. "
        "Do not include phrases like 'This document discusses' or 'The author explains'. "
        "Return ONLY the synopsis text and nothing else."
    )

    endpoint = f"{llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if llm_api_key:
        headers["Authorization"] = f"Bearer {llm_api_key}"

    payload = {
        "model": llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Document text:\n\n{sample_content}"}
        ],
        "temperature": 0.3,
        "max_tokens": 100
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                raw = raw.strip('"\'*`')
                if raw:
                    return re.sub(r'[\r\n\t]+', ' ', raw).strip()
            else:
                logger.warning(f"llm_generate_synopsis failed HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"llm_generate_synopsis error: {str(e)}")

    return None


async def llm_generate_title_and_tags(
    content: str,
    existing_tags: Optional[list] = None,
    llm_base_url: str = "",
    llm_api_key: str = "",
    llm_model: str = "gpt-4o-mini",
    timeout: float = 20.0,
    include_synopsis: bool = False
) -> Any:
    """
    Generate a concise title and 1-3 topical category tags using an OpenAI-compatible LLM.
    Enforces a strict global limit of at most 50 unique tags in the library.
    Tags MUST represent topical subject matter (e.g. 'philosophy', 'health', 'cooking').
    Platform/format names (reddit, url, blog, pdf, article, etc.) are ALWAYS forbidden.
    """
    if not content or not content.strip() or not llm_base_url:
        return None, []

    # Platform/format names that must NEVER appear as tags
    FORBIDDEN_TAGS = {
        "reddit", "url", "web", "blog", "article", "pdf", "epub", "docx",
        "text", "website", "link", "post", "document", "file", "reading",
        "inbox", "archived", "note", "notes", "thread", "forum", "social",
        "media", "news", "content", "page", "site"
    }

    # Filter existing tags to only topical ones for the LLM prompt
    existing = [
        t.strip().lower() for t in (existing_tags or [])
        if t and t.strip() and t.strip().lower() not in FORBIDDEN_TAGS
        and not t.strip().lower().startswith("r/")
        and not t.strip().lower().startswith("u/")
    ]
    unique_existing = sorted(list(set(existing)))
    tag_count = len(unique_existing)

    forbidden_examples = ", ".join(sorted(FORBIDDEN_TAGS)[:10]) + ", r/*, u/*"

    if tag_count >= 50:
        tag_instruction = (
            f"CRITICAL CONSTRAINT: The library has reached its maximum global limit of 50 categories ({tag_count}/50).\n"
            f"You MUST select 1 to 3 tags EXCLUSIVELY from the following existing TOPICAL categories. DO NOT invent any new tags:\n"
            f"{json.dumps(unique_existing)}"
        )
    elif tag_count > 0:
        tag_instruction = (
            f"There are currently {tag_count}/50 topical categories in the library.\n"
            f"PREFER reusing existing tags ONLY if they genuinely describe the SUBJECT MATTER of this document:\n"
            f"{json.dumps(unique_existing)}\n"
            f"If none of the existing tags match the actual topic, CREATE a new topical tag instead — do not force-fit an existing tag."
        )
    else:
        tag_instruction = (
            "Select 1 to 3 broad, high-level topical category tags (e.g. 'philosophy', 'health', 'cooking', 'parenting', 'technology', 'finance', 'spirituality'). "
            "Tags represent the SUBJECT MATTER of the document, not its format or source."
        )

    schema_desc = (
        '{"title": "Descriptive Note Title", "tags": ["topic1", "topic2"], "synopsis": "A punchy 1-2 sentence core takeaway (120-180 characters)."}'
        if include_synopsis else
        '{"title": "Descriptive Note Title", "tags": ["topic1", "topic2"]}'
    )

    system_prompt = (
        "You are an expert librarian and taxonomy classifier. Analyze the provided text and return a concise title and 1-3 TOPICAL category tags.\n"
        "CRITICAL RULES FOR TAGS:\n"
        "- Tags MUST describe the SUBJECT MATTER / TOPIC of the content (e.g. 'parenting', 'spirituality', 'productivity', 'machine-learning').\n"
        f"- Tags MUST NOT be platform names, file formats, or source types. FORBIDDEN examples: {forbidden_examples}.\n"
        "- Tags must be lowercase, only letters, numbers, and hyphens (no hashtags, spaces, or emojis).\n"
        "- 1 to 3 tags only.\n"
        f"Tag selection rule: {tag_instruction}\n"
        "TITLE RULES:\n"
        "- 3 to 8 words, descriptive, Title Case, no punctuation at end.\n"
        f"Respond with ONLY a valid JSON object matching this schema:\n{schema_desc}"
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
        "max_tokens": 150,
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
                synopsis = parsed.get("synopsis")

                # Sanitize title
                clean_title = str(title).strip() if title else None
                if clean_title:
                    clean_title = re.sub(r'[\r\n\t]+', ' ', clean_title).strip('"\';:')

                # Sanitize synopsis
                clean_synopsis = str(synopsis).strip().strip('"\'*`') if synopsis else None
                if clean_synopsis:
                    clean_synopsis = re.sub(r'[\r\n\t]+', ' ', clean_synopsis).strip()

                # Sanitize and post-filter tags — enforce topical-only
                clean_tags = []
                for t in tags:
                    norm = re.sub(r'[^a-z0-9\-]', '', str(t).lower().replace(' ', '-')).strip('-')
                    if not norm:
                        continue
                    if norm in FORBIDDEN_TAGS:
                        continue  # Strip platform/format tags even if LLM returned them
                    if norm.startswith("r-") or norm.startswith("u-"):
                        continue
                    if norm in clean_tags:
                        continue
                    if tag_count >= 50 and norm not in unique_existing:
                        continue  # Skip illegal new tags when at 50 capacity
                    clean_tags.append(norm)

                if include_synopsis:
                    return clean_title, clean_tags[:3], clean_synopsis
                return clean_title, clean_tags[:3]
            else:
                logger.warning(f"llm_generate_title_and_tags failed HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"llm_generate_title_and_tags error: {str(e)}")

    if include_synopsis:
        return None, [], None
    return None, []


async def llm_consolidate_reddit_comments(
    post_title: str,
    post_content: str,
    comments_markdown: str,
    llm_base_url: str = "",
    llm_api_key: str = "",
    llm_model: str = "gpt-4o-mini",
    timeout: float = 35.0
) -> Optional[str]:
    """
    Consolidate and synthesize a Reddit thread's comments into a cohesive, neatly laid-out
    discussion section optimized for both visual reading and natural TTS listening.
    Groups redundant remarks, summarizes multi-perspective viewpoints, and consolidates
    nested discussions into coherent thematic points.
    """
    if not comments_markdown or not comments_markdown.strip() or not llm_base_url:
        return None

    system_prompt = (
        "You are an expert editor creating clean, easy-to-read, and natural-sounding summaries of online discussions.\n"
        "Analyze the provided Reddit post and its comments. Consolidate and synthesize the comments into a coherent, neatly laid-out discussion section.\n\n"
        "Guidelines:\n"
        "1. Start with an opening sentence: \"Consolidating all of the comments on this post, here is what people say:\"\n"
        "2. Identify recurring themes, consensus opinions, key takeaways, and contrasting viewpoints.\n"
        "3. Eliminate redundant information, low-value conversational chatter (e.g., 'thanks for sharing', '+1', 'this'), and off-topic noise.\n"
        "4. Consolidate nested comment replies and sub-debates into cohesive single notes rather than back-and-forth snippets.\n"
        "5. Attribute distinct ideas naturally in prose (e.g., 'A few commenters noted...', 'One user highlighted that...', 'Others cautioned that...').\n"
        "6. Write in clear, flowing markdown paragraphs with bullet points. Optimize for both visual readability and natural text-to-speech listening (avoid raw markdown tables, URLs, or dense ASCII formatting).\n"
        "7. Return ONLY the consolidated markdown text and nothing else."
    )

    post_excerpt = post_content[:3000].strip()
    comments_excerpt = comments_markdown[:15000].strip()

    endpoint = f"{llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if llm_api_key:
        headers["Authorization"] = f"Bearer {llm_api_key}"

    payload = {
        "model": llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Post Title: {post_title}\n\nPost Content:\n{post_excerpt}\n\nComments to Consolidate:\n{comments_excerpt}"
            }
        ],
        "temperature": 0.3,
        "max_tokens": 1200
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_answer = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if raw_answer:
                    if raw_answer.startswith("```"):
                        raw_answer = re.sub(r'^```[a-zA-Z0-9_-]*\n?', '', raw_answer)
                        raw_answer = re.sub(r'\n?```$', '', raw_answer).strip()
                    return raw_answer
            else:
                logger.warning(f"llm_consolidate_reddit_comments failed HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"llm_consolidate_reddit_comments error: {str(e)}")

    return None
