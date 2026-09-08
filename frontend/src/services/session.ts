const SESSION_KEY_PREFIX = "topik-session-";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export interface AnswerRecord {
  selected: number;
  correct: boolean;
  timeSpentMs: number;
  topic?: string;
}

export interface TestSession {
  id: string;
  testId: string;
  section: "reading" | "listening";
  startedAt: string;
  completedAt: string;
  totalTimeMs: number;
  answers: Record<string, AnswerRecord>;
  score: { correct: number; total: number };
  syncStatus?: "local-only" | "synced";
}

export function saveSession(session: TestSession): void {
  try {
    localStorage.setItem(
      `${SESSION_KEY_PREFIX}${session.id}`,
      JSON.stringify(session)
    );
  } catch {
    // session tracking must never break the app
  }
}

export function loadSession(id: string): TestSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as TestSession) : null;
  } catch {
    return null;
  }
}
