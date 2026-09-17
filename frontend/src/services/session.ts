const WRITING_DRAFT_PREFIX = "topik-writing-";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export interface WritingImageEntry {
  data: string; // base64-encoded
  mime_type: string;
}

/**
 * Uploaded photos are held in memory only — base64-encoded phone photos are
 * several MB each and would blow the ~5MB localStorage origin quota. They live
 * for the duration of the SPA session (upload → transcribe → review); on a hard
 * refresh the thumbnails are lost but the confirmed transcriptions persist.
 */
const imageStore = new Map<string, Record<number, WritingImageEntry[]>>();

export function setSessionImages(
  id: string,
  images: Record<number, WritingImageEntry[]>
): void {
  imageStore.set(id, images);
}

export function getSessionImages(
  id: string
): Record<number, WritingImageEntry[]> | null {
  return imageStore.get(id) ?? null;
}

/** Small, persistable draft metadata (no images). */
export interface WritingDraft {
  id: string;
  testId: string;
  transcriptions: Record<number, string>;
  charCounts: Record<number, number>;
}

export function saveWritingDraft(draft: WritingDraft): void {
  try {
    localStorage.setItem(
      `${WRITING_DRAFT_PREFIX}${draft.id}`,
      JSON.stringify(draft)
    );
  } catch {
    // draft persistence must never break the flow
  }
}

export function loadWritingDraft(id: string): WritingDraft | null {
  try {
    const raw = localStorage.getItem(`${WRITING_DRAFT_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as WritingDraft) : null;
  } catch {
    return null;
  }
}
