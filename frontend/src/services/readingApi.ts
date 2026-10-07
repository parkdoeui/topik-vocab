import { apiFetch } from "./api";

export type ReadingOption = 1 | 2 | 3 | 4;
export type ReadingPracticeType = "28-31" | "19";
export const readingOptionMarkers = ["①", "②", "③", "④"];

export const readingPracticeConfig = {
  "28-31": {
    title: "읽기 28–31 연습",
    typeLabel: "읽기 28–31번 유형",
    homePath: "/reading",
    reviewPath: "/reading-attempts",
    badge: "빈칸 추론",
    topicLabel: "주제",
    introduction: "원하는 주제의 세트를 골라 4문항을 풀어 보세요. 지문을 읽고 빈칸에 가장 알맞은 보기를 고르면 제출 후 정답과 근거 해설을 확인할 수 있습니다.",
  },
  "19": {
    title: "읽기 19번 연습",
    typeLabel: "읽기 19번 유형",
    homePath: "/reading-19",
    reviewPath: "/reading-19-attempts",
    badge: "연결 표현",
    topicLabel: "분류",
    introduction: "세트마다 서로 다른 6가지 분류의 연결 표현을 연습하세요. 총 6세트, 36문항이며 각 분류가 전체에서 3번씩 등장합니다. 제출 후 정답과 근거 해설을 확인할 수 있습니다.",
  },
};

export interface ReadingQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
}

export interface ReadingSetSummary {
  id: string;
  practice_type: ReadingPracticeType;
  title: string;
  notice: string;
  topics: string[];
  question_count: number;
  points_per_question: number;
  guidance?: string | null;
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
  practice_type: ReadingPracticeType;
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
  vocabulary?: string[];
  category_description?: string;
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

export function getReadingSets(practiceType: ReadingPracticeType = "28-31"): Promise<ReadingSetSummary[]> {
  return readingJson(`/api/reading-sets${practiceType === "19" ? "?practice_type=19" : ""}`);
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

export function getReadingAttempts(practiceType: ReadingPracticeType = "28-31"): Promise<ReadingAttemptSummary[]> {
  return readingJson(`/api/reading-attempts${practiceType === "19" ? "?practice_type=19" : ""}`);
}

export function getReadingAttempt(attemptId: string): Promise<ReadingAttemptReview> {
  return readingJson(`/api/reading-attempts/${encodeURIComponent(attemptId)}`);
}
