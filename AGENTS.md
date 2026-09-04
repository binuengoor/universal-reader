# Agent Execution Rules

- **Execution Protocol**:
  1. Inspect `IMPLEMENTATION_PLAN.md` to identify the next unchecked item (`- [ ]`).
  2. Implement strictly that item. Avoid skipping ahead.
  3. Validate implementation using shell commands (run linters, verify test runs, or curl endpoints).
  4. Once validated, update `IMPLEMENTATION_PLAN.md` to mark the checkbox (`- [x]`).
  5. Commit the change using `git commit -m "feat(<phase>): <description>"`.
  6. Proceed sequentially until all phases are complete.

- **Stack & Architecture**:
  - Refer strictly to `SPEC.md` for architecture, port assignments, and data structures.
  - Backend: Python / FastAPI on port 9025.
  - Storage: Filesystem per document at `/data/documents/<doc_id>/`.
  - External TTS: Proxy OpenAI-compatible API to the Universal TTS service.

- **Quality Guardrails**:
  - Keep changes narrowly scoped to the current phase.
  - Never generate placeholder/mock logic for chunking or audio streaming.
  - Never proceed to the next phase if a verification step fails.

