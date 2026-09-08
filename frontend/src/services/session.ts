const WRITING_SESSION_PREFIX = "topik-writing-";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export interface WritingImageEntry {
  data: string;
  mime_type: string;
}

export interface WritingSessionDraft {
  id: string;
  testId: string;
  startedAt: string;
  elapsedMs: number;
  images: Record<number, WritingImageEntry[]>;
  transcriptions: Record<number, string>;
  charCounts: Record<number, number>;
}

export function saveWritingDraft(draft: WritingSessionDraft): void {
  try {
    localStorage.setItem(
      `${WRITING_SESSION_PREFIX}${draft.id}`,
      JSON.stringify(draft)
    );
  } catch {
    // session tracking must never break the app
  }
}

export function loadWritingDraft(id: string): WritingSessionDraft | null {
  try {
    const raw = localStorage.getItem(`${WRITING_SESSION_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as WritingSessionDraft) : null;
  } catch {
    return null;
  }
}
