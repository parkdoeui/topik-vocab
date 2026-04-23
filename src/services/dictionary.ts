import type { DictionaryResult, VocabEntry } from "../types";
import kengdicData from "../data/kengdic.json";

const KRDICT_API = "https://krdict.korean.go.kr/api/search";

// Strip trailing punctuation from a word token for lookup
function normalize(word: string): string {
  return word.replace(/[.,!?;:'"()\[\]{}·…。、]/g, "").trim();
}

async function lookupKrdict(
  word: string,
  apiKey: string
): Promise<DictionaryResult | null> {
  try {
    const url = `${KRDICT_API}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(word)}&translated=y&trans_lang=1&part=word`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const english =
      xml.querySelector("trans_word")?.textContent?.trim() ?? null;
    const pos =
      xml.querySelector("pos")?.textContent?.trim() ?? undefined;
    if (!english) return null;
    return { korean: word, english, partOfSpeech: pos, source: "krdict" };
  } catch {
    return null;
  }
}

function lookupKengdic(word: string): DictionaryResult | null {
  const normalized = normalize(word);
  const entry = (kengdicData as { korean: string; english: string; pos?: string }[]).find(
    (e) => e.korean === normalized || e.korean === word
  );
  if (!entry) return null;
  return {
    korean: normalized,
    english: entry.english,
    partOfSpeech: entry.pos,
    source: "kengdic",
  };
}

function lookupVocabMap(
  word: string,
  vocabMap: VocabEntry[]
): DictionaryResult | null {
  const entry = vocabMap.find((e) => normalize(e.original_word) === word);
  if (!entry) return null;
  return {
    korean: entry.root,
    root: entry.root,
    english: entry.english,
    source: "vocab_map",
  };
}

export async function lookup(
  word: string,
  apiKey?: string,
  vocabMap?: VocabEntry[]
): Promise<DictionaryResult | null> {
  const normalized = normalize(word);
  if (!normalized) return null;

  if (vocabMap) {
    const result = lookupVocabMap(normalized, vocabMap);
    if (result) return result;
  }

  if (apiKey) {
    const result = await lookupKrdict(normalized, apiKey);
    if (result) return result;
  }

  return lookupKengdic(normalized);
}
