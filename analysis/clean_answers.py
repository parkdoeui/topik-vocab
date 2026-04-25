#!/usr/bin/env python3
"""
Clean quiz answers using sentence-aware stripping.

Algorithm:
  1. Parse the sentence to find Korean text DIRECTLY ATTACHED after (   )
     e.g. "(   )를 설치했다" → attached suffix = "를"
          "(   ) 사건이"    → attached suffix = "" (space = separate word)
          "(   )."          → attached suffix = "" (non-Korean)

  2. If the answer ends with that attached suffix AND removing it still
     leaves the root word (or starts with the root word), strip it.

  3. Safety: never strip if the result doesn't match the root word.

Examples:
  "새로운 (   )를 설치했다." + "장치를"    → "장치"    (를 visible, root intact)
  "(   )들이 모여 이야기를"  + "주부들이"  → "주부"    (들이 visible, root intact)
  "그것은 비상 (   )로서 중요" + "장치로서"  → "장치"    (로서 visible, root intact)
  "(   ) 사건이 발생했다."   + "흉악한"   → "흉악한"  (space after blank = keep)
  "그 범죄는 정말 (   )."   + "흉악하다"  → "흉악하다" (period after blank = keep)
  "이 음식은 (   )가 높다." + "영양가"   → "영양가"  (stripping 가 breaks root)
"""

import json
import os
import re


def get_attached_suffix(sentence):
    """
    Get Korean text directly attached after the (   ) blank.
    Returns empty string if there's a space, punctuation, or nothing after.
    """
    match = re.search(r'\(\s+\)([가-힣]+)', sentence)
    if match:
        return match.group(1)
    return ""


def clean_answer(answer, root_word, sentence):
    """
    Strip suffix from answer ONLY if:
      1. The suffix is already visible right after (   ) in the sentence
      2. After stripping, the result equals the root word
    """
    suffix = get_attached_suffix(sentence)

    if not suffix:
        # Nothing attached after blank — keep answer as-is
        return answer

    if answer.endswith(suffix) and len(answer) > len(suffix):
        stripped = answer[:-len(suffix)]
        # Only accept if the stripped result IS the root word
        if stripped == root_word:
            return stripped

    return answer


def clean_quiz_file(filepath):
    """Clean all answers in a quiz file. Returns changed count."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = 0

    for word, entry in data.items():
        for q in entry.get("quiz", []):
            old = q["answer"]
            new = clean_answer(old, word, q["sentence"])
            if new != old:
                q["answer"] = new
                changed += 1
                print(f"  {word}: \"{old}\" -> \"{new}\"  [{q['sentence']}]")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    return changed


def main():
    quiz_dir = "src/data/vocabs/quiz-sentences"
    merged_path = "src/data/vocabs/quiz-sentences.json"

    # Process ALL quiz set files
    total_changed = 0
    files = sorted(
        [f for f in os.listdir(quiz_dir)
         if f.startswith("quiz_set_") and f.endswith(".json")],
        key=lambda x: int(x.split("_")[2].split(".")[0])
    )

    for fname in files:
        filepath = os.path.join(quiz_dir, fname)
        print(f"\n=== {fname} ===")
        changed = clean_quiz_file(filepath)
        total_changed += changed
        print(f"  -> {changed} answers cleaned")

    # Also clean the merged file
    print(f"\n=== quiz-sentences.json (merged) ===")
    merged_changed = clean_quiz_file(merged_path)

    print(f"\n{'='*50}")
    print(f"Total: {total_changed} in quiz sets, {merged_changed} in merged file")


if __name__ == "__main__":
    main()
