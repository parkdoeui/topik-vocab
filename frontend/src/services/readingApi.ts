import { apiFetch } from "./api";

export type ReadingOption = 1 | 2 | 3 | 4;
export const readingOptionMarkers = ["①", "②", "③", "④"];

export interface ReadingQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
}

export interface ReadingSetSummary {
  id: string;
  title: string;
  notice: string;
  topics: string[];
  question_count: number;
  points_per_question: number;
}

export interface ReadingSet extends ReadingSetSummary {
  instruction: string;
  questions: ReadingQuestion[];
}

export interface ReadingAttemptPayload {
  id: string;
  set_id: string;
  answers: Array<{ question_id: string; selected_option: ReadingOption }>;
}

export interface ReadingAttemptSummary {
  id: string;
  set_id: string;
  set_title: string;
  completed_at: string;
  correct_count: number;
  question_count: number;
  score: number;
  max_score: number;
}

export interface ReadingQuestionReview extends ReadingQuestion {
  selected_option: ReadingOption;
  correct_option: ReadingOption;
  correct: boolean;
  explanation: string;
  vocabulary: string[];
  sources?: Array<{ title: string; url: string }>;
}

export interface ReadingAttemptReview extends ReadingAttemptSummary {
  instruction: string;
  points_per_question: number;
  questions: ReadingQuestionReview[];
}

async function readingJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new Error(`Reading request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function getReadingSets(): Promise<ReadingSetSummary[]> {
  return readingJson("/api/reading-sets");
}

export function getReadingSet(setId: string): Promise<ReadingSet> {
  return readingJson(`/api/reading-sets/${encodeURIComponent(setId)}`);
}

export function submitReadingAttempt(payload: ReadingAttemptPayload): Promise<ReadingAttemptReview> {
  return readingJson("/api/reading-attempts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReadingAttempts(): Promise<ReadingAttemptSummary[]> {
  return readingJson("/api/reading-attempts");
}

export function getReadingAttempt(attemptId: string): Promise<ReadingAttemptReview> {
  return readingJson(`/api/reading-attempts/${encodeURIComponent(attemptId)}`);
}
