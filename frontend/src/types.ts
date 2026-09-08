export type Section = "reading" | "listening" | "writing";

// --- Structured reading/listening question (existing parsed tests) ---

export interface StructuredQuestion {
  number: number;
  instruction: string;
  points: number;
  passage?: string;
  passage_id?: string;
  image_url?: string;
  choices: Record<string, string>;
  answer: number | null;  // null for copyright-withheld questions
  topic?: string;
}

export interface StructuredReadingTest {
  id: string;
  title: string;
  level: "TOPIK II";
  round: number;
  render_mode: "structured";
  section: "reading";
  questions: StructuredQuestion[];
  time_limit_minutes: number;
  source?: string;
}

// --- PDF-based tests (new papers shown as PDF + answer sheet) ---

export interface AnswerKeyItem {
  number: number;
  answer: number;
  points: number;
  topic?: string;
}

export interface PdfReadingTest {
  id: string;
  title: string;
  level: "TOPIK II";
  round: number;
  render_mode: "pdf";
  section: "reading";
  pdf_url: string;
  answer_key: AnswerKeyItem[];
  time_limit_minutes: number;
  source?: string;
}

export interface PdfListeningTest {
  id: string;
  title: string;
  level: "TOPIK II";
  round: number;
  render_mode: "pdf";
  section: "listening";
  pdf_url: string;
  audio_url: string;
  answer_key: AnswerKeyItem[];
  time_limit_minutes: number;
  source?: string;
}

// --- Writing test ---

export type WritingQuestionType = "short-blank" | "chart-description" | "essay";

export interface WritingQuestion {
  number: number;
  type: WritingQuestionType;
  instruction: string;
  prompt: string;
  image_url?: string;
  blanks?: string[];
  min_chars?: number;
  max_chars?: number;
  max_points: number;
}

export interface WritingTest {
  id: string;
  title: string;
  level: "TOPIK II";
  round: number;
  section: "writing";
  questions: WritingQuestion[];
  pdf_url?: string;
  time_limit_minutes: number;
  source?: string;
}

// --- Union types for routing ---

export type ReadingTest = StructuredReadingTest | PdfReadingTest;
export type ListeningTest = PdfListeningTest;
export type AnyTest = ReadingTest | ListeningTest | WritingTest;
