export interface VocabEntry {
  root: string;
  english: string;
  original_word: string;
}

export interface TopikQuestion {
  문제_번호: number;
  지시문: string;
  배점: string;
  문제_내용: string;
  선택지: Record<string, string>;
  정답: number;
  주제: string;
  단어맵?: VocabEntry[];
}

export interface TopikTest {
  id: string;
  title: string;
  level: "TOPIK I" | "TOPIK II";
  questions: TopikQuestion[];
}

export interface VocabWord {
  id: string;
  korean: string;
  root?: string;
  originalWord?: string;
  english: string;
  partOfSpeech?: string;
  exampleSentence: string;
  testId: string;
  questionNumber: number;
  savedAt: number;
}

export interface DictionaryResult {
  korean: string;
  root?: string;
  english: string;
  partOfSpeech?: string;
  pronunciation?: string;
  source: "krdict" | "kengdic" | "vocab_map";
}

export interface BasketState {
  words: VocabWord[];
}
