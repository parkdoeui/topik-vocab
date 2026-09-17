import type { PracticeAttemptPayload } from "./api";

const PENDING_ATTEMPTS_KEY = "topik-practice-pending-attempts";

type PendingAttempts = Record<string, PracticeAttemptPayload>;

function readPendingAttempts(): PendingAttempts {
  try {
    const raw = localStorage.getItem(PENDING_ATTEMPTS_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as PendingAttempts;
  } catch {
    return {};
  }
}

function writePendingAttempts(attempts: PendingAttempts): void {
  try {
    localStorage.setItem(PENDING_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // The active review still remains on screen if browser storage is unavailable.
  }
}

export function savePendingPracticeAttempt(payload: PracticeAttemptPayload): void {
  const attempts = readPendingAttempts();
  attempts[payload.id] = payload;
  writePendingAttempts(attempts);
}

export function removePendingPracticeAttempt(id: string): void {
  const attempts = readPendingAttempts();
  if (!(id in attempts)) return;
  delete attempts[id];
  writePendingAttempts(attempts);
}

export function getPendingPracticeAttempts(): PracticeAttemptPayload[] {
  return Object.values(readPendingAttempts()).sort(
    (a, b) => a.completed_at.localeCompare(b.completed_at)
  );
}
