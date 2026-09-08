const SESSION_KEY_PREFIX = "topik-session-";

export interface AnswerRecord {
  selected: number;
  correct: boolean;
  timeSpentMs: number;
}

export interface TestSession {
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
      `${SESSION_KEY_PREFIX}${session.testId}-${session.startedAt}`,
      JSON.stringify(session)
    );
  } catch {
    // session tracking must never break the app
  }
}
