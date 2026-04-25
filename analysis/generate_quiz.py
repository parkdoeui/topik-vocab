#!/usr/bin/env python3
"""
Generate quiz sentences by calling Vertex AI Gemini API in small batches.

Usage:
    python3 analysis/generate_quiz.py [--batch-size 10] [--max-batches 1] [--reset]

Prerequisites:
    - google-genai SDK installed (pip3 install google-genai)
    - GCP credentials via gcloud auth (gcloud auth application-default login)
    - Set PROJECT_ID in .env (or pass --project)

Reads:
    - src/data/vocabs/unique-words.json     (all root words to generate quizzes for)
    - src/data/vocabs/quiz-sentences.json   (existing quizzes, to skip already-done words)
    - analysis/quiz_prompt.txt              (prompt template)

Writes:
    - src/data/vocabs/quiz-sentences.json           (merged output)
    - src/data/vocabs/quiz-sentences/batch_N.json   (individual batch outputs)

Options:
    --batch-size N      Number of words per API call (default: 10)
    --model NAME        Gemini model name (default: gemini-2.0-flash)
    --project ID        GCP project ID (or set PROJECT_ID env var)
    --location REGION   GCP region (default: us-central1)
    --max-batches N     Max batches to process, 0 = all (default: 0)
    --reset             Ignore existing quiz data and regenerate everything
    --dry-run           Print the prompt for the first batch without calling the API
"""

import json
import os
import sys
import argparse
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UNIQUE_WORDS_PATH = os.path.join(ROOT_DIR, "src", "data", "vocabs", "unique-words.json")
QUIZ_PATH = os.path.join(ROOT_DIR, "src", "data", "vocabs", "quiz-sentences.json")
BATCH_DIR = os.path.join(ROOT_DIR, "src", "data", "vocabs", "quiz-sentences")
PROMPT_PATH = os.path.join(ROOT_DIR, "analysis", "quiz_prompt.txt")


def load_unique_words():
    with open(UNIQUE_WORDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_existing_quiz():
    if os.path.exists(QUIZ_PATH):
        with open(QUIZ_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_quiz(data):
    with open(QUIZ_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_prompt_template():
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def build_prompt(template, words_batch, unique_words):
    """Build the full prompt with word list and their English meanings."""
    word_lines = []
    for word in words_batch:
        english = unique_words[word]["english"]
        variations = unique_words[word].get("variations", [])
        line = f"- {word} ({english})"
        if variations:
            line += f"  [known forms: {', '.join(variations[:8])}]"
        word_lines.append(line)

    return template + "\n".join(word_lines)


def call_gemini(client, prompt, model):
    """Call Gemini via google-genai SDK."""
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=16384,
            response_mime_type="application/json",
        ),
    )

    content = response.text.strip()
    # Strip markdown fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0]
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        print(f"  Raw response (last 200 chars): ...{content[-200:]}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Generate TOPIK quiz sentences via Vertex AI Gemini")
    parser.add_argument("--batch-size", type=int, default=25, help="Words per API call")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model name")
    parser.add_argument("--project", default=os.environ.get("PROJECT_ID", ""), help="GCP project ID")
    parser.add_argument("--location", default=os.environ.get("GCP_LOCATION", "us-central1"), help="GCP region")
    parser.add_argument("--max-batches", type=int, default=0, help="Max batches to process (0 = all)")
    parser.add_argument("--reset", action="store_true", help="Regenerate all words")
    parser.add_argument("--dry-run", action="store_true", help="Print first batch prompt only")
    args = parser.parse_args()

    if not args.project and not args.dry_run:
        print("Error: GCP project ID required. Set PROJECT_ID in .env")
        sys.exit(1)

    # Init Vertex AI client (uses Application Default Credentials)
    client = None
    if not args.dry_run:
        client = genai.Client(
            vertexai=True,
            project=args.project,
            location=args.location,
        )

    # Load data
    unique_words = load_unique_words()
    existing_quiz = {} if args.reset else load_existing_quiz()
    template = load_prompt_template()

    # Determine which words still need quizzes
    all_roots = list(unique_words.keys())
    remaining = [w for w in all_roots if w not in existing_quiz]

    print(f"Total words: {len(all_roots)}")
    print(f"Already done: {len(all_roots) - len(remaining)}")
    print(f"Remaining: {len(remaining)}")
    print(f"Batch size: {args.batch_size}")
    print(f"Batches needed: {(len(remaining) + args.batch_size - 1) // args.batch_size}")
    print(f"Model: {args.model}")
    print()

    if not remaining:
        print("All words already have quiz sentences!")
        return

    # Split into batches
    batches = []
    for i in range(0, len(remaining), args.batch_size):
        batches.append(remaining[i : i + args.batch_size])

    # Dry run: just print the first prompt
    if args.dry_run:
        prompt = build_prompt(template, batches[0], unique_words)
        print("=== PROMPT (batch 1) ===")
        print(prompt)
        print(f"\n=== Total prompt length: {len(prompt)} chars ===")
        return

    # Limit batches if requested
    if args.max_batches > 0:
        batches = batches[:args.max_batches]

    # Process batches
    for idx, batch in enumerate(batches):
        print(f"[Batch {idx + 1}/{len(batches)}] Generating {len(batch)} words: {', '.join(batch[:5])}{'...' if len(batch) > 5 else ''}")

        prompt = build_prompt(template, batch, unique_words)

        try:
            result = call_gemini(client, prompt, args.model)
        except Exception as e:
            print(f"  Failed: {e}")
            print(f"  Saving progress ({len(existing_quiz)} words) and stopping.")
            save_quiz(existing_quiz)
            sys.exit(1)

        # Save batch file
        os.makedirs(BATCH_DIR, exist_ok=True)
        batch_path = os.path.join(BATCH_DIR, f"quiz_set_{idx + 1}.json")
        with open(batch_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"  Saved batch to {batch_path}")

        # Merge results
        added = 0
        for word, quiz_data in result.items():
            if word in unique_words:  # Only accept words we asked for
                existing_quiz[word] = quiz_data
                added += 1

        print(f"  Added {added} words. Total: {len(existing_quiz)}/{len(all_roots)}")

        # Save after each batch (crash-safe)
        save_quiz(existing_quiz)

        # Rate limit pause between batches
        if idx < len(batches) - 1:
            print("  Waiting 2s...")
            time.sleep(2)

    print(f"\nDone! Quiz sentences for {len(existing_quiz)} words saved to {QUIZ_PATH}")


if __name__ == "__main__":
    main()
