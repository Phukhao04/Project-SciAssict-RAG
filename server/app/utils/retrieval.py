import json
import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .chunk_heading import extract_chunk_heading
from .embedding import embed_query


# Include nearby chunks when a heading's content was split during ingestion.
SIBLING_SEARCH_RADIUS = 5

# Boost exact matches for course codes found in the query.
COURSE_CODE_PATTERN = re.compile(r"(?<!\d)\d{3}-\d{3}[A-Za-z0-9]*")
MAX_CODES_PER_QUERY = 2
MAX_KEYWORD_CHUNKS = 3


@dataclass
class RetrievedChunk:
    chunk_id: int
    chunk_text: str
    parent_text: str
    document_id: int
    document_name: str
    file_name: str | None
    source_url: str | None
    distance: float
    match_type: str = "vector"


def _fetch_code_matches(db: Session, query_text_str: str, query_embedding: list) -> list:
    """Fetch and rank chunks matching course codes in the query."""
    codes = list(dict.fromkeys(COURSE_CODE_PATTERN.findall(query_text_str)))
    codes = codes[:MAX_CODES_PER_QUERY]
    if not codes:
        return []

    sql = text("""
        SELECT
            dc.chunk_id,
            dc.chunk_text,
            dc.parent_text,
            dc.document_id,
            d.document_name,
            d.file_name,
            d.source_url,
            vec_cosine_distance(dc.embedding_vector, :query_embedding) AS distance
        FROM document_chunk dc
        JOIN document d
            ON dc.document_id = d.document_id
        WHERE dc.parent_text LIKE :pattern
        ORDER BY distance
        LIMIT :lim
    """)

    found: dict[int, object] = {}
    for code in codes:
        rows = db.execute(
            sql,
            {
                "query_embedding": json.dumps(query_embedding),
                "pattern": f"%{code}%",
                "lim": MAX_KEYWORD_CHUNKS,
            },
        ).fetchall()
        for row in rows:
            found.setdefault(row.chunk_id, row)

    return sorted(found.values(), key=lambda r: r.distance)[:MAX_KEYWORD_CHUNKS]


def _fetch_sibling_chunks(
    db: Session, document_id: int, center_chunk_id: int, heading: str
) -> list:
    """Fetch nearby chunks that share the center chunk's heading."""
    sql = text("""
        SELECT chunk_id, chunk_text, parent_text
        FROM document_chunk
        WHERE document_id = :document_id
          AND chunk_id BETWEEN :lo AND :hi
        ORDER BY chunk_id ASC
    """)
    rows = db.execute(
        sql,
        {
            "document_id": document_id,
            "lo": center_chunk_id - SIBLING_SEARCH_RADIUS,
            "hi": center_chunk_id + SIBLING_SEARCH_RADIUS,
        },
    ).fetchall()

    return [
        row
        for row in rows
        if row.chunk_id != center_chunk_id
        and extract_chunk_heading(row.parent_text, row.chunk_text) == heading
    ]


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """Retrieve vector matches, boost course-code matches, and expand siblings."""
    query_embedding = embed_query(query_text_str)

    sql = text("""
        SELECT
            dc.chunk_id,
            dc.chunk_text,
            dc.parent_text,
            dc.document_id,
            d.document_name,
            d.file_name,
            d.source_url,
            vec_cosine_distance(dc.embedding_vector, :query_embedding) AS distance
        FROM document_chunk dc
        JOIN document d
            ON dc.document_id = d.document_id
        ORDER BY distance
        LIMIT :k
    """)

    vector_rows = db.execute(
        sql,
        {
            "query_embedding": json.dumps(query_embedding),
            "k": k,
        },
    ).fetchall()

    # Put exact course-code matches first, then fill the remaining slots by vector rank.
    keyword_rows = _fetch_code_matches(db, query_text_str, query_embedding)[:k]
    keyword_ids = {r.chunk_id for r in keyword_rows}
    rows = list(keyword_rows) + [
        r for r in vector_rows if r.chunk_id not in keyword_ids
    ][: max(k - len(keyword_rows), 0)]

    results: dict[int, RetrievedChunk] = {
        row.chunk_id: RetrievedChunk(
            chunk_id=row.chunk_id,
            chunk_text=row.chunk_text,
            parent_text=row.parent_text,
            document_id=row.document_id,
            document_name=row.document_name,
            file_name=row.file_name,
            source_url=row.source_url,
            distance=row.distance,
            match_type="vector",
        )
        for row in rows
    }

    for row in rows:
        heading = extract_chunk_heading(row.parent_text, row.chunk_text)
        if not heading:
            continue

        for sib in _fetch_sibling_chunks(db, row.document_id, row.chunk_id, heading):
            if sib.chunk_id in results:
                continue
            results[sib.chunk_id] = RetrievedChunk(
                chunk_id=sib.chunk_id,
                chunk_text=sib.chunk_text,
                parent_text=sib.parent_text,
                document_id=row.document_id,
                document_name=row.document_name,
                file_name=row.file_name,
                source_url=row.source_url,
                # Keep the distance of the vector-matched chunk.
                distance=row.distance,
                match_type="sibling",
            )

    # Preserve document order so split sections reach the LLM in sequence.
    return sorted(results.values(), key=lambda c: (c.document_id, c.chunk_id))