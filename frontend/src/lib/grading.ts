import type { StructuredQuestion, AnswerKeyItem } from "../types";

export interface GradeResult {
  correct: number;
  total: number;
  answers: Record<string, { selected: number; correct: boolean; timeSpentMs: number; topic?: string }>;
}

export function gradeStructured(
  questions: StructuredQuestion[],
  userAnswers: Record<string, number>,
  timings: Record<string, number>
): GradeResult {
  let correct = 0;
  const answers: GradeResult["answers"] = {};

  for (const q of questions) {
    const key = String(q.number);
    const selected = userAnswers[key];
    if (selected === undefined) continue;

    const isCorrect = q.answer !== null && selected === q.answer;
    if (isCorrect) correct++;

    answers[key] = {
      selected,
      correct: isCorrect,
      timeSpentMs: timings[key] ?? 0,
      topic: q.topic ?? undefined,
    };
  }

  const total = questions.filter((q) => q.answer !== null).length;
  return { correct, total, answers };
}

export function gradePdf(
  answerKey: AnswerKeyItem[],
  userAnswers: Record<string, number>,
  timings: Record<string, number>
): GradeResult {
  let correct = 0;
  const answers: GradeResult["answers"] = {};

  for (const item of answerKey) {
    const key = String(item.number);
    const selected = userAnswers[key];
    if (selected === undefined) continue;

    const isCorrect = selected === item.answer;
    if (isCorrect) correct++;

    answers[key] = {
      selected,
      correct: isCorrect,
      timeSpentMs: timings[key] ?? 0,
      topic: item.topic ?? undefined,
    };
  }

  return { correct, total: answerKey.length, answers };
}
