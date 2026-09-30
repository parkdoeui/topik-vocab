import { apiFetch } from "./api";

export type ReviewQuestionType =
  | "particle_choice"
  | "natural_sentence"
  | "error_correction"
  | "collocation_completion";

export interface ReviewQuestion {
  id: string;
  setId: string;
  setPosition: number;
  type: ReviewQuestionType;
  question: string;
  options: string[];
  targetPattern: string;
  category: string;
  difficulty: 1 | 2 | 3;
  source: "user_error" | "general_topik" | "mixed";
}

export interface ReviewSetSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  latestBaseCorrectCount: number | null;
  latestCompletedAt: string | null;
  latestSessionId: string | null;
}

export interface ReviewSessionResponse {
  id: string;
  setId: string;
  setTitle: string;
  initialQuestionCount: number;
  questions: ReviewQuestion[];
}

export interface ReviewProgress {
  correctCount: number;
  incorrectCount: number;
  streak: number;
  masteryLevel: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface ReviewFeedback {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  targetPattern: string;
  category: string;
  progress: ReviewProgress;
  replacementQuestion?: ReviewQuestion;
  insertAfter?: number;
  replacementIsSupplemental?: boolean;
}

export interface ReviewResult {
  id: string;
  setId: string;
  setTitle: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  initialQuestionCount: number;
  attemptedCount: number;
  correctCount: number;
  baseCorrectCount: number;
  supplementalAttemptCount: number;
  missedPatterns: Array<{
    pattern: string;
    naturalExpression: string;
  }>;
  answers: Array<{
    question: string;
    submittedAnswer: string;
    correctAnswer: string;
    correct: boolean;
    explanation: string;
    isSupplemental: boolean;
  }>;
}

export interface MyReviewError {
  pattern: string;
  category: string;
  incorrectExpression: string;
  naturalExpression: string;
  historicalErrorCount: number;
  quizIncorrectCount: number;
  totalErrorCount: number;
  masteryLevel: number;
}

export interface ReviewAnswerPayload {
  id: string;
  question_id: string;
  sequence_index: number;
  submitted_answer: string;
  excluded_question_ids: string[];
}

async function reviewJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    throw new Error(`Review request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getReviewSets(): Promise<ReviewSetSummary[]> {
  return reviewJson<ReviewSetSummary[]>("/api/review/sets");
}

export function startReviewSession(
  payload: { id: string; set_id: string }
): Promise<ReviewSessionResponse> {
  return reviewJson<ReviewSessionResponse>("/api/review/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitReviewAnswer(
  sessionId: string,
  payload: ReviewAnswerPayload
): Promise<ReviewFeedback> {
  return reviewJson<ReviewFeedback>(`/api/review/sessions/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeReviewSession(sessionId: string): Promise<ReviewResult> {
  return reviewJson<ReviewResult>(`/api/review/sessions/${sessionId}/complete`, {
    method: "POST",
  });
}

export function getReviewResult(sessionId: string): Promise<ReviewResult> {
  return reviewJson<ReviewResult>(`/api/review/sessions/${sessionId}`);
}

export function getMyReviewErrors(): Promise<MyReviewError[]> {
  return reviewJson<MyReviewError[]>("/api/review/errors");
}
