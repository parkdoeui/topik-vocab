#!/usr/bin/env python3
"""
Clean quiz answers: strip Korean particles from noun answers.

For noun-based quiz entries, the answer should be just the root word,
not word+particle (e.g. "장치" not "장치를"), because the particle
is already visible in the sentence and gives away the answer.

Verb/adjective conjugations (e.g. 물려주었다, 탁월하게) are kept as-is
since those are legitimate fill-in-the-blank answers.
"""

import json
import os
import re
import sys

# Korean particles to strip from the END of noun answers
# Order matters: check longer particles first
PARTICLES = [
    "에서는", "으로서", "이라고", "에게서",
    "별로", "처럼", "보다", "까지",
    "에서", "에게", "으로", "이다",
    "이서", "이면", "에도",
    "는", "은", "을", "를", "이", "가", "의", "에", "와", "과",
    "도", "로",
]

def load_unique_words():
    """Load unique words to identify which entries are nouns vs verbs."""
    path = "src/data/vocabs/unique-words.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def is_verb_or_adjective(word):
    """Check if a word is a verb/adjective (ends with 하다/되다/다)."""
    verb_endings = ["하다", "되다", "앓다", "얽히다", "희다", "붉다"]
    adj_endings = ["적", "럽다", "직하다"]
    
    if word.endswith("하다") or word.endswith("되다"):
        return True
    if word.endswith("다") and len(word) > 1:
        # Most words ending in 다 are verbs/adjectives
        return True
    return False

def strip_particle(answer, root_word):
    """Strip trailing particle from answer, returning just the root word."""
    # If the answer IS the root word, nothing to strip
    if answer == root_word:
        return answer
    
    # If answer starts with root word and has a particle suffix
    if answer.startswith(root_word):
        suffix = answer[len(root_word):]
        for p in PARTICLES:
            if suffix == p:
                return root_word
    
    return answer

def clean_quiz_set(filepath, unique_words):
    """Clean a single quiz set file. Returns (changed_count, total_count)."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    changed = 0
    total = 0
    
    for word, entry in data.items():
        # Only clean noun-based entries, skip verbs/adjectives
        if is_verb_or_adjective(word):
            continue
        
        for q in entry.get("quiz", []):
            total += 1
            old_answer = q["answer"]
            new_answer = strip_particle(old_answer, word)
            
            if new_answer != old_answer:
                q["answer"] = new_answer
                changed += 1
                print(f"  {word}: \"{old_answer}\" -> \"{new_answer}\"")
    
    # Write back
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changed, total

def main():
    sets = [4, 5, 6]
    if len(sys.argv) > 1:
        sets = [int(x) for x in sys.argv[1:]]
    
    unique_words = load_unique_words()
    total_changed = 0
    
    for n in sets:
        filepath = f"src/data/vocabs/quiz-sentences/quiz_set_{n}.json"
        if not os.path.exists(filepath):
            print(f"Skip: {filepath} not found")
            continue
        
        print(f"\n=== quiz_set_{n}.json ===")
        changed, total = clean_quiz_set(filepath, unique_words)
        total_changed += changed
        print(f"  Changed {changed} answers")
    
    # Also update the merged quiz-sentences.json
    print(f"\n=== Updating merged quiz-sentences.json ===")
    merged_path = "src/data/vocabs/quiz-sentences.json"
    with open(merged_path, "r", encoding="utf-8") as f:
        merged = json.load(f)
    
    merged_changed = 0
    for word, entry in merged.items():
        if is_verb_or_adjective(word):
            continue
        for q in entry.get("quiz", []):
            old_answer = q["answer"]
            new_answer = strip_particle(old_answer, word)
            if new_answer != old_answer:
                q["answer"] = new_answer
                merged_changed += 1
    
    with open(merged_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    
    print(f"  Changed {merged_changed} answers in merged file")
    print(f"\nTotal: {total_changed} answers cleaned in quiz sets, {merged_changed} in merged file")

if __name__ == "__main__":
    main()
