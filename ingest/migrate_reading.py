"""
Migrates existing TOPIK reading data (Korean-keyed chunks) into the new StructuredReadingTest JSON
format under frontend/src/data/reading-tests/.

Usage:
    python3 ingest/migrate_reading.py

Output files:
    frontend/src/data/reading-tests/topik2-35.json
    frontend/src/data/reading-tests/topik2-41.json
    frontend/src/data/reading-tests/topik2-91.json
"""
import json
import re
import glob
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_ROOT = REPO_ROOT / "frontend" / "src" / "data" / "reading"
OUT_DIR = REPO_ROOT / "frontend" / "src" / "data" / "reading-tests"

TESTS = [
    {
        "id": "topik2-35",
        "title": "제35회 TOPIK II 읽기",
        "round": 35,
        "chunk_dir": DATA_ROOT / "35",
        "chunk_pattern": ["1-5", "6-10", "11-15", "16-20", "21-25", "26-30", "31-40", "41-50"],
    },
    {
        "id": "topik2-41",
        "title": "제41회 TOPIK II 읽기",
        "round": 41,
        "chunk_dir": DATA_ROOT / "41",
        "chunk_pattern": ["1-10", "11-20", "21-30", "31-40", "41-50"],
    },
    {
        "id": "topik2-91",
        "title": "제91회 TOPIK II 읽기",
        "round": 91,
        "chunk_dir": DATA_ROOT / "91",
        "chunk_pattern": ["1-10", "11-20", "21-30", "31-40", "41-50"],
    },
]


def parse_points(배점_str: str) -> int:
    m = re.search(r"\d+", 배점_str)
    return int(m.group()) if m else 2


def load_chunks(chunk_dir: Path, patterns: list[str]) -> list[dict]:
    questions = []
    for pat in patterns:
        path = chunk_dir / f"{pat}.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                questions.extend(json.load(f))
    return questions


def migrate_question(q: dict) -> dict:
    return {
        "number": q["문제_번호"],
        "instruction": q["지시문"],
        "points": parse_points(q.get("배점", "2점")),
        "passage": q.get("문제_내용", ""),
        "choices": q["선택지"],
        "answer": q["정답"],
        "topic": q.get("주제"),
    }


def migrate_test(spec: dict) -> dict:
    raw_questions = load_chunks(spec["chunk_dir"], spec["chunk_pattern"])
    if not raw_questions:
        raise FileNotFoundError(f"No chunks found in {spec['chunk_dir']}")

    questions = [migrate_question(q) for q in raw_questions]

    return {
        "id": spec["id"],
        "title": spec["title"],
        "level": "TOPIK II",
        "round": spec["round"],
        "render_mode": "structured",
        "section": "reading",
        "questions": questions,
        "time_limit_minutes": 70,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for spec in TESTS:
        print(f"Migrating {spec['id']}...")
        test = migrate_test(spec)
        out_path = OUT_DIR / f"{spec['id']}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(test, f, ensure_ascii=False, indent=2)
        print(f"  → {out_path} ({len(test['questions'])} questions)")


if __name__ == "__main__":
    main()
