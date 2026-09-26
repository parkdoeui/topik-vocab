import type { ReviewQuestion } from "./reviewApi";

/**
 * Put a wrong-pattern variation after 3–7 intervening questions. The server
 * owns the offset; the UI only applies it. When the replacement already occurs
 * later in the base queue, move it rather than presenting it twice.
 */
export function insertReplacementQuestion(
  queue: ReviewQuestion[],
  currentIndex: number,
  replacement: ReviewQuestion,
  insertAfter: number
): ReviewQuestion[] {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= queue.length) {
    throw new Error("Replacement question requires a current queue index.");
  }
  if (!Number.isInteger(insertAfter) || insertAfter < 3 || insertAfter > 7) {
    throw new Error("Replacement questions must be delayed by 3–7 intervening questions.");
  }
  const existingIndexes = queue.flatMap((question, position) => (
    question.id === replacement.id ? [position] : []
  ));
  const firstSeenIndex = existingIndexes.find((position) => position <= currentIndex);
  if (firstSeenIndex !== undefined) {
    // The pattern variation was already presented. Keep that occurrence and
    // remove any accidental future duplicate rather than scheduling it twice.
    return queue.filter((question, position) => (
      question.id !== replacement.id || position === firstSeenIndex
    ));
  }
  const withoutReplacement = existingIndexes.length > 0
    ? queue.filter((question) => question.id !== replacement.id)
    : queue;
  const insertionIndex = Math.min(
    withoutReplacement.length,
    Math.max(currentIndex + 1, currentIndex + 1 + insertAfter)
  );
  return [
    ...withoutReplacement.slice(0, insertionIndex),
    replacement,
    ...withoutReplacement.slice(insertionIndex),
  ];
}
