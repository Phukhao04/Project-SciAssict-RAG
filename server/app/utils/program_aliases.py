import re

PROGRAM_ALIASES: dict[str, list[str]] = {
    "เคมี": ["chem", "chemistry"],
    "วัสดุศาสตร์": ["matsci", "mat sci", "วัสดุ", "materials"],
    "ฟิสิกส์": ["phys", "physics", "ฟิสิก"],
    "ชีววิทยา": ["ชีวะ", "biology", "ไบโอ"],
    "เทคโนโลยีชีวภาพ": ["biotech", "biotechnology", "ไบโอเทค"],
    "จุลชีววิทยา": ["micro", "microbio", "microbiology", "จุล"],
    "คณิตศาสตร์": ["math", "maths", "mathematics", "คณิต", "แมท"],
    "สถิติประยุกต์และวิทยาการข้อมูล": [
        "stat",
        "stats",
        "statistics",
        "applied stat",
        "data science",
        "ds",
        "สถิติประยุกต์",
        "สถิติ",
    ],
    "วิทยาการคอมพิวเตอร์": [
        "comsci",
        "com sci",
        "cs",
        "computer science",
        "คอมซาย",
        "คอมไซ",
        "วิทย์คอม",
    ],
    "เทคโนโลยีสารสนเทศและการสื่อสาร": ["ict", "ไอซีที"],
    "เทคโนโลยีสารสนเทศ (ต่อเนื่อง)": [
        "it",
        "ไอที",
        "it ต่อเนื่อง",
        "it continuing",
    ],
    "เคมี-ชีววิทยาประยุกต์": [
        "chembio",
        "chem bio",
        "applied chem bio",
        "เคมีชีวะ",
        "เคมีชีววิทยา",
    ],
    "วิทยาศาสตร์พอลิเมอร์": [
        "polymer",
        "polymer science",
        "พอลิเมอร์",
        "โพลิเมอร์",
    ],
}


def _compile(alias: str) -> re.Pattern:
    a = re.escape(alias.lower())
    if re.fullmatch(r"[a-z0-9 ]+", alias.lower()):
        # คำอังกฤษ: ต้องเป็นคำเดี่ยว กัน "it" ไปชนกลางคำอื่น
        return re.compile(rf"(?<![a-z0-9]){a}(?![a-z0-9])")
    return re.compile(a)


_PATTERNS = [
    (official, [_compile(a) for a in aliases])
    for official, aliases in PROGRAM_ALIASES.items()
]


def expand_program_aliases(query: str) -> str:
    """ต่อชื่อสาขาทางการท้ายคำถาม ถ้าเจอชื่อเล่น (ใช้กับ embedding เท่านั้น)"""
    q = query.lower()
    extra = [
        official
        for official, pats in _PATTERNS
        if official.lower() not in q and any(p.search(q) for p in pats)
    ]
    return f"{query} {' '.join(extra)}" if extra else query
