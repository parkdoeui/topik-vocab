const SESSION_KEY_PREFIX = "topik-session-";

export interface AnswerRecord {
  selected: number;
  correct: boolean;
  timeSpentMs: number;
}

export interface SavedWordRecord {
  korean: string;
  english: string;
  questionNumber: number;
}

export interface TestSession {
  testId: string;
  startedAt: string;
  completedAt: string;
  totalTimeMs: number;
  answers: Record<string, AnswerRecord>;
  savedWords: SavedWordRecord[];
  score: { correct: number; total: number };
}

export function saveSession(session: TestSession): void {
  try {
    localStorage.setItem(
      `${SESSION_KEY_PREFIX}${session.testId}`,
      JSON.stringify(session)
    );
  } catch {
    // Silently swallow — session tracking must never break the app
  }
}
