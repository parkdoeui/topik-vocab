import type { TestSession } from "./session";

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

export interface SessionPayload {
  id: string;
  test_id: string;
  section: "reading" | "listening";
  started_at: string;
  completed_at: string;
  total_time_ms: number;
  answers: Array<{
    question_number: number;
    selected: number;
    is_correct: boolean;
    time_spent_ms: number;
    topic?: string | null;
  }>;
  score: { correct: number; total: number };
}

export async function syncSession(session: TestSession): Promise<boolean> {
  try {
    const payload: SessionPayload = {
      id: session.id,
      test_id: session.testId,
      section: session.section,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      total_time_ms: session.totalTimeMs,
      answers: Object.entries(session.answers).map(([num, a]) => ({
        question_number: parseInt(num),
        selected: a.selected,
        is_correct: a.correct,
        time_spent_ms: a.timeSpentMs,
        topic: a.topic ?? null,
      })),
      score: session.score,
    };
    const res = await apiFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.ok || res.status === 409; // 409 = already exists, that's fine
  } catch {
    return false;
  }
}

export interface SectionAccuracy { correct: number; total: number }
export interface TopicAccuracy { topic: string; correct: number; total: number; accuracy: number }
export interface ScoreHistoryItem {
  date: string; test_id: string; section: string; correct: number; total: number;
}
export interface ProgressData {
  total_sessions: number;
  per_section_accuracy: { reading: SectionAccuracy; listening: SectionAccuracy };
  score_history: ScoreHistoryItem[];
  per_topic_accuracy: TopicAccuracy[];
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
