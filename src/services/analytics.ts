// Google Sheets analytics via Apps Script web app.
// Set VITE_ANALYTICS_URL in your .env file to enable.
// If unset, events are logged to console only.

const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL as string | undefined;

export type AnalyticsEvent =
  | {
      type: "word_saved";
      testId: string;
      questionNumber: number;
      word: string;
      theme: string;
    }
  | {
      type: "word_removed";
      testId: string;
      questionNumber: number;
      word: string;
    }
  | {
      type: "question_changed";
      testId: string;
      questionNumber: number;
      theme: string;
    }
  | {
      type: "answer_selected";
      testId: string;
      questionNumber: number;
      choice: number;
      theme: string;
    };

export function sendEvent(event: AnalyticsEvent): void {
  const payload = { ...event, timestamp: new Date().toISOString() };

  if (!ANALYTICS_URL) {
    console.debug("[analytics]", payload);
    return;
  }

  // Fire-and-forget — don't block UI
  fetch(ANALYTICS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently swallow — analytics must never break the app
  });
}
