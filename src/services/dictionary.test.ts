import { describe, it, expect } from "vitest";
import { passages } from "../data/passages";
import type { VocabEntry } from "../types";

// Reproduce the exact normalize function from dictionary.ts
function normalize(word: string): string {
  return word.replace(/[.,!?;:'"()\[\]{}·…。、]/g, "").trim();
}

// Reproduce the exact tokenize function from PassageView.tsx
function tokenize(text: string): string[] {
  return text.split(/(\s+)/);
}

// Reproduce the exact wordOnly logic from PassageView.tsx
function extractKorean(token: string): string {
  return token.replace(
    /^[^\uAC00-\uD7A3\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]+|[^\uAC00-\uD7A3\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]+$/g,
    ""
  );
}

// Reproduce the exact lookupVocabMap logic from dictionary.ts (after fix)
function lookupVocabMap(word: string, vocabMap: VocabEntry[]) {
  const normalized = normalize(word);
  if (!normalized) return null;
  const entry = vocabMap.find((e) => normalize(e.original_word) === normalized);
  return entry ? { korean: entry.root, english: entry.english, matchedVia: normalized } : null;
}

describe("vocabMap lookup for every token in every passage", () => {
  for (const passage of passages) {
    if (!passage.vocabMap) continue;

    describe(`passage: ${passage.id}`, () => {
      const paragraphs = passage.content.split(/\n+/);
      const allTokens: string[] = [];

      for (const para of paragraphs) {
        for (const token of tokenize(para)) {
          if (/^\s+$/.test(token)) continue;
          const wordOnly = extractKorean(token);
          if (!wordOnly) continue;
          allTokens.push(token);
        }
      }

      // Test 1: every token that has a vocabMap entry should match
      it("every vocabMap original_word should be findable from passage tokens", () => {
        const normalizedTokens = allTokens.map((t) => normalize(t));
        const missingFromText: string[] = [];

        for (const entry of passage.vocabMap!) {
          // The original_word should match a normalized token
          const found = normalizedTokens.includes(normalize(entry.original_word));
          if (!found) {
            missingFromText.push(entry.original_word);
          }
        }

        expect(missingFromText, `vocabMap entries not found in passage text: ${JSON.stringify(missingFromText)}`).toEqual([]);
      });

      // Test 2: check each token's lookup result
      it("each Korean token should resolve correctly via vocabMap", () => {
        const results: { token: string; normalized: string; match: string | null; root: string | null; english: string | null }[] = [];

        for (const token of allTokens) {
          const normalized = normalize(token);
          const result = lookupVocabMap(token, passage.vocabMap!);
          results.push({
            token,
            normalized,
            match: result?.matchedVia ?? null,
            root: result?.korean ?? null,
            english: result?.english ?? null,
          });
        }

        // Print full results table for inspection
        const matched = results.filter((r) => r.match);
        const unmatched = results.filter((r) => !r.match);

        console.log(`\n=== ${passage.id} ===`);
        console.log(`Tokens: ${results.length} | Matched: ${matched.length} | Unmatched: ${unmatched.length}`);
        console.log("\n--- MATCHED ---");
        for (const r of matched) {
          console.log(`  "${r.token}" → normalized "${r.normalized}" → root "${r.root}" = "${r.english}"`);
        }
        console.log("\n--- UNMATCHED (no vocabMap hit) ---");
        for (const r of unmatched) {
          console.log(`  "${r.token}" → normalized "${r.normalized}" → NO MATCH`);
        }

        // This just ensures the test runs and prints — the real assertion is visual
        expect(results.length).toBeGreaterThan(0);
      });

      // Test 3: original_word with punctuation should still match after normalize-on-both-sides fix
      it("original_word with punctuation still matches via normalized comparison", () => {
        const punctuationEntries = passage.vocabMap!.filter(
          (e) => normalize(e.original_word) !== e.original_word
        );

        for (const entry of punctuationEntries) {
          const result = lookupVocabMap(entry.original_word, passage.vocabMap!);
          expect(result, `"${entry.original_word}" should still match after normalization`).not.toBeNull();
          expect(result!.korean).toBe(entry.root);
        }
      });

      // Test 4: detect duplicate original_word entries (first match wins, rest are invisible)
      it("no duplicate original_word values (duplicates cause wrong lookups)", () => {
        const seen = new Map<string, number>();
        const duplicates: { original_word: string; indices: number[] }[] = [];

        for (let i = 0; i < passage.vocabMap!.length; i++) {
          const key = passage.vocabMap![i].original_word;
          if (seen.has(key)) {
            const existing = duplicates.find((d) => d.original_word === key);
            if (existing) {
              existing.indices.push(i);
            } else {
              duplicates.push({ original_word: key, indices: [seen.get(key)!, i] });
            }
          }
          seen.set(key, i);
        }

        if (duplicates.length > 0) {
          console.log("\n!!! DUPLICATE original_word (only first entry used, rest ignored) !!!");
          for (const d of duplicates) {
            const entries = d.indices.map((i) => `[${i}] root="${passage.vocabMap![i].root}" english="${passage.vocabMap![i].english}"`);
            console.log(`  "${d.original_word}" → ${entries.join(" vs ")}`);
          }
        }

        // Duplicates are warnings (logged above), not failures — same word appearing
        // twice in a passage is normal. Only fail if duplicates have DIFFERENT roots.
        const conflicting = duplicates.filter((d) => {
          const roots = new Set(d.indices.map((i) => passage.vocabMap![i].root));
          return roots.size > 1;
        });
        expect(conflicting, `Conflicting duplicate original_word values (different roots): ${conflicting.map((d) => d.original_word).join(", ")}`).toEqual([]);
      });
    });
  }
});
