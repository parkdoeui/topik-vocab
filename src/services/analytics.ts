// Google Sheets analytics via Apps Script web app.
// Set VITE_ANALYTICS_URL in your .env file to enable.
// If unset, session data is logged to console only.

import type { TestSession } from "./session";

const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL as string | undefined;

export function sendSessionData(session: TestSession): void {
  const payload = JSON.stringify(session);

  if (!ANALYTICS_URL) {
    console.debug("[analytics] session submitted:", payload);
    return;
  }

  try {
    const url = `${ANALYTICS_URL}?data=${encodeURIComponent(payload)}`;
    fetch(url, {
      mode: "no-cors",
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Silently swallow — analytics must never break the app
  }
}
