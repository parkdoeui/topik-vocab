import quizSet1 from "./vocabs/quiz-sentences/quiz_set_1.json";
import quizSet2 from "./vocabs/quiz-sentences/quiz_set_2.json";
import quizSet3 from "./vocabs/quiz-sentences/quiz_set_3.json";
import quizSet4 from "./vocabs/quiz-sentences/quiz_set_4.json";
import quizSet5 from "./vocabs/quiz-sentences/quiz_set_5.json";
import quizSet6 from "./vocabs/quiz-sentences/quiz_set_6.json";
import uniqueWords from "./vocabs/unique-words.json";

export interface QuizSentence {
  sentence: string;
  answer: string;
}

export interface FlashcardEntry {
  korean: string;
  english: string;
  variations: string[];
  sentences: QuizSentence[];
}

export interface QuizSet {
  id: number;
  title: string;
  cards: FlashcardEntry[];
}

type RawQuizJson = Record<string, { quiz: QuizSentence[] }>;
type UniqueWordsJson = Record<string, { english: string; variations: string[] }>;

const uniqueWordsData = uniqueWords as UniqueWordsJson;

const rawSets: RawQuizJson[] = [quizSet1, quizSet2, quizSet3, quizSet4, quizSet5, quizSet6] as RawQuizJson[];

function buildSet(raw: RawQuizJson, id: number): QuizSet {
  const cards: FlashcardEntry[] = Object.entries(raw).map(([word, data]) => {
    const lookup = uniqueWordsData[word];
    return {
      korean: word,
      english: lookup?.english ?? "",
      variations: lookup?.variations ?? [],
      sentences: data.quiz,
    };
  });
  return { id, title: `Quiz Set ${id}`, cards };
}

export const quizSets: QuizSet[] = rawSets.map((raw, i) => buildSet(raw, i + 1));

const CLEARED_KEY = "quiz-cleared-sets";

export function getClearedSets(): Set<number> {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

export function markSetCleared(setId: number): void {
  const cleared = getClearedSets();
  cleared.add(setId);
  localStorage.setItem(CLEARED_KEY, JSON.stringify([...cleared]));
}
