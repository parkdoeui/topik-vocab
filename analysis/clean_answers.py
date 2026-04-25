#!/usr/bin/env python3
"""
Clean quiz answers: strip ALL suffixes (particles, plural markers, predicate 
endings) from noun answers.

For noun-based quiz entries, the answer should be ONLY the root word.
Any trailing particle/suffix is already visible in the sentence context
and would give away the answer.

Verb/adjective entries (words ending in 다) keep their conjugations
since those are legitimate fill-in-the-blank answers.
"""

import json
import os
import sys


def is_verb_or_adjective(word):
    """Words ending in 다 are verbs/adjectives — keep their conjugations."""
    return word.endswith("다")


def clean_noun_answer(answer, root_word):
    """For noun entries: if the answer starts with root word, return just the root."""
    if answer == root_word:
        return answer
    
    # If answer starts with root word + any suffix, strip the suffix
    if answer.startswith(root_word) and len(answer) > len(root_word):
        return root_word
    
    return answer


def clean_quiz_file(filepath):
    """Clean all noun answers in a quiz set. Returns changed count."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    changed = 0
    
    for word, entry in data.items():
        if is_verb_or_adjective(word):
            continue
        
        for q in entry.get("quiz", []):
            old = q["answer"]
            new = clean_noun_answer(old, word)
            if new != old:
                q["answer"] = new
                changed += 1
                print(f"  {word}: \"{old}\" -> \"{new}\"")
    
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
        [f for f in os.listdir(quiz_dir) if f.startswith("quiz_set_") and f.endswith(".json")],
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
    
    print(f"\n{'='*40}")
    print(f"Total: {total_changed} in quiz sets, {merged_changed} in merged file")


if __name__ == "__main__":
    main()
