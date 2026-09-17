const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const PASSCODE_KEY = "topik_passcode";

// Fetch header values are restricted to ByteString/ISO-8859-1. Encode the
// UTF-8 bytes so Korean and other Unicode access codes are safe to transport.
export function encodePasscodeForTransport(passcode: string): string {
  const bytes = new TextEncoder().encode(passcode);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `v1.${encoded}`;
}

function authHeaders(): Record<string, string> {
  let passcode = "";
  try {
    passcode = localStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    // Cookie authentication can still work when storage is unavailable.
  }
  return passcode
    ? { "X-TOPIK-Passcode": encodePasscodeForTransport(passcode) }
    : {};
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  includeStoredPasscode = true
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (includeStoredPasscode) {
    for (const [name, value] of Object.entries(authHeaders())) {
      headers.set(name, value);
    }
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
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
    }, false);
    if (res.ok) {
      try {
        localStorage.setItem(PASSCODE_KEY, passcode);
      } catch {
        // The HTTP-only cookie remains available where the browser permits it.
      }
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

export interface WritingSessionStartPayload {
  id: string;
  test_id: string;
}

export interface WritingSessionStartResponse {
  id: string;
  test_id: string;
  started_at: string;
  completed_at: string | null;
  total_time_ms: number | null;
}

export interface WritingSessionPayload {
  id: string;
  test_id: string;
  answers: Record<string, WritingAnswerPayload>;
}

export interface QuestionGrading {
  score: number;
  max_score: number;
  criteria: Record<string, number>;
  criteria_max_scores?: Record<string, number>;
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
  q53_char_count: number;
  q54_char_count: number;
  answers: Record<string, WritingAnswerPayload>;
  grading: WritingGrading;
}

export async function startWritingSession(
  payload: WritingSessionStartPayload
): Promise<WritingSessionStartResponse | null> {
  try {
    const res = await apiFetch("/api/writing-sessions/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json() as Promise<WritingSessionStartResponse>;
  } catch {
    return null;
  }
}

export async function finishWritingSession(
  id: string
): Promise<WritingSessionStartResponse | null> {
  try {
    const res = await apiFetch(`/api/writing-sessions/${id}/finish`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return res.json() as Promise<WritingSessionStartResponse>;
  } catch {
    return null;
  }
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

// --- Rapid practice API ---

export interface PracticeBlankPayload {
  marker: string;
  submitted_answer: string;
  model_answer: string;
  accepted_variants: string[];
  focus: string;
  feedback: string;
}

export interface PracticeQuestionPayload {
  id: string;
  prompt: string;
  elapsed_ms: number;
  blanks: PracticeBlankPayload[];
}

export interface PracticeAttemptPayload {
  id: string;
  set_id: string;
  set_title: string;
  question_type: string;
  started_at: string;
  completed_at: string;
  total_time_ms: number;
  target_seconds_per_question: number;
  questions: PracticeQuestionPayload[];
}

export interface PracticeAttemptSummary {
  id: string;
  set_id: string;
  set_title: string;
  completed_at: string;
  total_time_ms: number;
  question_count: number;
  within_target_count: number;
}

export interface PracticeAttemptResponse extends PracticeAttemptSummary {
  question_type: string;
  started_at: string;
  target_seconds_per_question: number;
  questions: PracticeQuestionPayload[];
}

export async function submitPracticeAttempt(
  payload: PracticeAttemptPayload
): Promise<PracticeAttemptResponse> {
  const res = await apiFetch("/api/practice-attempts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Practice attempt save failed: ${res.status}`);
  return res.json() as Promise<PracticeAttemptResponse>;
}

export async function getPracticeAttempts(): Promise<PracticeAttemptSummary[] | null> {
  try {
    const res = await apiFetch("/api/practice-attempts");
    if (!res.ok) return null;
    return res.json() as Promise<PracticeAttemptSummary[]>;
  } catch {
    return null;
  }
}

export async function getPracticeAttempt(
  id: string
): Promise<PracticeAttemptResponse | null> {
  try {
    const res = await apiFetch(`/api/practice-attempts/${id}`);
    if (!res.ok) return null;
    return res.json() as Promise<PracticeAttemptResponse>;
  } catch {
    return null;
  }
}
