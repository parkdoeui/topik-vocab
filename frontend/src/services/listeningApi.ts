import { apiFetch } from "./api";

export function formatListeningTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export type ListeningOption = 1 | 2 | 3 | 4;
export type ListeningPracticeType = "43-44" | "39-40";
export const listeningOptionMarkers = ["①", "②", "③", "④"];
export const listeningPracticeConfig = {
  "43-44": { title: "듣기 43–44 연습", homePath: "/listening", reviewPath: "/listening-attempts", badge: "이유 · 내용 일치 · 중심 내용" },
  "39-40": { title: "듣기 39–40 연습", homePath: "/listening-39", reviewPath: "/listening-39-attempts", badge: "대화 전의 내용 · 내용 일치" },
};

export interface ListeningAudio {
  path: string;
  duration_seconds: number;
  stages: { first_end: number; cue_start: number; cue_end: number; second_start: number };
}

export interface ListeningQuestion {
  id: string;
  number: number;
  type: string;
  prompt: string;
  options: string[];
}

export interface ListeningSetSummary {
  id: string;
  practice_type: ListeningPracticeType;
  title: string;
  topics: string[];
  combination: string;
  notice: string;
  question_count: number;
  audio_duration_seconds: number;
}

export interface ListeningSet extends ListeningSetSummary {
  audio: ListeningAudio;
  questions: ListeningQuestion[];
}

export interface ListeningAttemptPayload {
  id: string;
  set_id: string;
  replay_count: number;
  answers: Array<{ question_id: string; selected_option: ListeningOption }>;
}

export interface ListeningAttemptSummary {
  id: string;
  practice_type: ListeningPracticeType;
  set_id: string;
  set_title: string;
  completed_at: string;
  correct_count: number;
  question_count: number;
  replay_count: number;
}

export interface ListeningQuestionReview extends ListeningQuestion {
  selected_option: ListeningOption;
  correct_option: ListeningOption;
  correct: boolean;
  explanation: string;
}

export interface ListeningAttemptReview extends ListeningAttemptSummary {
  passage: string;
  audio: ListeningAudio;
  topics: string[];
  notice: string;
  questions: ListeningQuestionReview[];
}

async function listeningJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new Error(`Listening request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function getListeningSets(type: ListeningPracticeType = "43-44"): Promise<ListeningSetSummary[]> {
  return listeningJson(`/api/listening-sets?practice_type=${type}`);
}

export function getListeningSet(id: string): Promise<ListeningSet> {
  return listeningJson(`/api/listening-sets/${encodeURIComponent(id)}`);
}

export function submitListeningAttempt(payload: ListeningAttemptPayload): Promise<ListeningAttemptReview> {
  return listeningJson("/api/listening-attempts", { method: "POST", body: JSON.stringify(payload) });
}

export function getListeningAttempts(type: ListeningPracticeType = "43-44"): Promise<ListeningAttemptSummary[]> {
  return listeningJson(`/api/listening-attempts?practice_type=${type}`);
}

export function getListeningAttempt(id: string): Promise<ListeningAttemptReview> {
  return listeningJson(`/api/listening-attempts/${encodeURIComponent(id)}`);
}
