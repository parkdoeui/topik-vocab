const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const PASSCODE_KEY = "topik_passcode";

function authHeaders(): Record<string, string> {
  const passcode = localStorage.getItem(PASSCODE_KEY) ?? "";
  return passcode ? { "X-TOPIK-Passcode": passcode } : {};
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
}

export async function checkAuthSession(): Promise<boolean> {
  try {
    const res = await apiFetch("/api/auth/session");
    if (!res.ok) return false;
    const data = await res.json() as { authenticated: boolean };
    return data.authenticated;
  } catch {
    return false;
  }
}

export async function loginWithPasscode(passcode: string): Promise<boolean> {
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      localStorage.setItem(PASSCODE_KEY, passcode);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// --- Writing API ---

export interface ImagePayload {
  data: string;      // base64-encoded
  mime_type: string;
}

export interface TranscriptionResult {
  transcription: string;
  char_count: number;
}

export async function transcribeImages(
  images: ImagePayload[]
): Promise<TranscriptionResult[]> {
  const res = await apiFetch("/api/writing-sessions/transcribe", {
    method: "POST",
    body: JSON.stringify({ images }),
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  const data = await res.json() as { results: TranscriptionResult[] };
  return data.results;
}

export interface WritingAnswerPayload {
  image_urls: string[];
  transcription: string;
  char_count: number;
}

export interface WritingSessionPayload {
  id: string;
  test_id: string;
  started_at: string;
  completed_at: string;
  total_time_ms: number;
  answers: Record<string, WritingAnswerPayload>;
}

export interface QuestionGrading {
  score: number;
  max_score: number;
  criteria: Record<string, number>;               // 내용_및_과제수행 / 전개구조 / 언어사용 → 점수
  criterion_evidence: Record<string, string>;
  detailed_improvement_points: Record<string, string[]>;
  current_state: string;
  primary_goal: string;
  sample_answer: string;
}

export interface WritingGrading {
  total_score: number;
  questions: Record<string, QuestionGrading>;
  action_points: string[];
}

export interface WritingSessionResponse {
  id: string;
  test_id: string;
  started_at: string;
  completed_at: string;
  total_time_ms: number;
  answers: Record<string, WritingAnswerPayload>;
  grading: WritingGrading;
}

export async function submitWritingSession(
  payload: WritingSessionPayload
): Promise<WritingSessionResponse | null> {
  try {
    const res = await apiFetch("/api/writing-sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json() as Promise<WritingSessionResponse>;
  } catch {
    return null;
  }
}

export async function getWritingSession(
  id: string
): Promise<WritingSessionResponse | null> {
  try {
    const res = await apiFetch(`/api/writing-sessions/${id}`);
    if (!res.ok) return null;
    return res.json() as Promise<WritingSessionResponse>;
  } catch {
    return null;
  }
}

// --- Progress API ---

export interface WritingSessionSummary {
  id: string;
  test_id: string;
  date: string;
  total_score: number;
  max_score: number;
}

export interface ProgressData {
  total_sessions: number;
  average_score: number;
  sessions: WritingSessionSummary[];
}

export async function getProgress(): Promise<ProgressData | null> {
  try {
    const res = await apiFetch("/api/progress");
    if (!res.ok) return null;
    return res.json() as Promise<ProgressData>;
  } catch {
    return null;
  }
}
