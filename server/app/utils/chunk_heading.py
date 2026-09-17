def extract_chunk_heading(parent_text: str, chunk_text: str) -> str:
    if not parent_text or parent_text == chunk_text:
        return ""
    if len(parent_text) > len(chunk_text) and parent_text.endswith(chunk_text):
        prefix = parent_text[: len(parent_text) - len(chunk_text)]
        return prefix.rstrip("\n")
    return ""