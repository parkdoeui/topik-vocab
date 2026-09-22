import type { ReviewQuestion, ReviewQuestionType } from "./reviewApi";

export function isChoiceQuestion(type: ReviewQuestionType): boolean {
  switch (type) {
    case "particle_choice":
    case "natural_sentence":
      return true;
    case "error_correction":
    case "collocation_completion":
      return false;
  }
}

export function answerPlaceholder(type: ReviewQuestionType): string {
  switch (type) {
    case "collocation_completion":
      return "자연스러운 동사를 입력하세요";
    case "error_correction":
      return "고친 문장을 입력하세요";
    case "particle_choice":
    case "natural_sentence":
      throw new Error("Choice questions do not use a text-answer placeholder.");
  }
}

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

export function isAnswerReady(
  question: ReviewQuestion,
  choice: string,
  textAnswer: string
): boolean {
  return isChoiceQuestion(question.type)
    ? choice.trim().length > 0
    : textAnswer.trim().length > 0;
}

export function submittedAnswer(
  question: ReviewQuestion,
  choice: string,
  textAnswer: string
): string {
  return isChoiceQuestion(question.type) ? choice.trim() : textAnswer.trim();
}
