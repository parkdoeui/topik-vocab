#!/usr/bin/env python3
"""
Generate unique-words.json from saved-words and reading data.

Usage:
    python analysis/generate_vocab.py

Reads:
    - analysis/test-results/*/saved-words.json  (words the user saved during practice)
    - src/data/reading/*/*.json                 (TOPIK reading passages with 단어맵)

Writes:
    - src/data/vocabs/unique-words.json

Output format:
    {
      "<root>": {
        "english": "<translation>",
        "variations": ["<inflected_form_1>", "<inflected_form_2>", ...]
      }
    }

Variations exclude the root form itself and are sorted alphabetically.
"""

import json
import glob
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SAVED_WORDS_GLOB = os.path.join(ROOT_DIR, "analysis", "test-results", "*", "saved-words.json")
READING_DATA_GLOB = os.path.join(ROOT_DIR, "src", "data", "reading", "*", "*.json")
OUTPUT_PATH = os.path.join(ROOT_DIR, "src", "data", "vocabs", "unique-words.json")


def load_saved_korean_words():
    """Collect all unique korean values from saved-words files."""
    saved = set()
    for f in sorted(glob.glob(SAVED_WORDS_GLOB)):
        data = json.load(open(f, encoding="utf-8"))
        for w in data:
            if "korean" in w:
                saved.add(w["korean"])
    return saved


def load_word_map():
    """Compile all 단어맵 entries into {original_word: {root, english}}."""
    word_map = {}
    for f in sorted(glob.glob(READING_DATA_GLOB)):
        data = json.load(open(f, encoding="utf-8"))
        for q in data:
            if "단어맵" in q:
                for w in q["단어맵"]:
                    ow = w["original_word"]
                    if ow not in word_map:
                        word_map[ow] = {"root": w["root"], "english": w["english"]}
    return word_map


def build_unique_words(word_map, saved_korean):
    """Build unique root dict filtered by saved words."""
    unique = {}
    for original_word, info in word_map.items():
        root = info["root"]
        if root not in saved_korean:
            continue
        if root not in unique:
            unique[root] = {"english": info["english"], "variations": []}
        if original_word != root and original_word not in unique[root]["variations"]:
            unique[root]["variations"].append(original_word)

    # Sort variations
    for root in unique:
        unique[root]["variations"].sort()

    return unique


def main():
    saved_korean = load_saved_korean_words()
    print(f"Loaded {len(saved_korean)} unique saved words")

    word_map = load_word_map()
    print(f"Loaded {len(word_map)} unique original words from 단어맵")

    unique = build_unique_words(word_map, saved_korean)
    print(f"Generated {len(unique)} unique root entries")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    print(f"Written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
