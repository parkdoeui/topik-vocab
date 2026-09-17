import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getPracticeSet } from "../data/practiceSets";
import {
  submitPracticeAttempt,
  type PracticeAttemptPayload,
} from "../services/api";
import { savePendingPracticeAttempt, removePendingPracticeAttempt } from "../services/practicePending";

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTimer(elapsedMs: number, targetSeconds: number): string {
  const targetMs = targetSeconds * 1000;
  if (elapsedMs >= targetMs) return `+${formatDuration(elapsedMs - targetMs)}`;
  const remainingSeconds = Math.ceil((targetMs - elapsedMs) / 1000);
  return `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
}

export function PracticeSession() {
  const { setId } = useParams<{ setId: string }>();
  const set = getPracticeSet(setId);
  const navigate = useNavigate();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [elapsedByQuestion, setElapsedByQuestion] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sessionStart] = useState(() => ({ at: new Date(), milliseconds: Date.now() }));
  const [questionOpenedAtMs, setQuestionOpenedAtMs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<PracticeAttemptPayload | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  if (!set) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <p>연습 세트를 찾을 수 없습니다.</p>
        <Link to="/practice" className="text-blue-600 hover:underline">빠른 훈련으로</Link>
      </div>
    );
  }

  const practiceSet = set;
  const question = practiceSet.questions[questionIndex];
  const currentElapsedMs =
    (elapsedByQuestion[question.id] ?? 0) + Math.max(0, nowMs - questionOpenedAtMs);
  const isOverTarget = currentElapsedMs >= practiceSet.target_seconds_per_question * 1000;
  const isAnswered = (questionId: string) =>
    practiceSet.questions
      .find((candidate) => candidate.id === questionId)!
      .blanks.every((blank) => (answers[questionId]?.[blank.marker] ?? "").trim().length > 0);
  const allAnswered = practiceSet.questions.every((candidate) => isAnswered(candidate.id));

  function changeQuestion(nextIndex: number): void {
    if (nextIndex === questionIndex || nextIndex < 0 || nextIndex >= practiceSet.questions.length) return;
    const timestamp = nowMs;
    const spent = Math.max(0, timestamp - questionOpenedAtMs);
    setElapsedByQuestion((current) => ({
      ...current,
      [question.id]: (current[question.id] ?? 0) + spent,
    }));
    setQuestionOpenedAtMs(timestamp);
    setNowMs(timestamp);
    setQuestionIndex(nextIndex);
  }

  function updateAnswer(marker: string, value: string): void {
    setAnswers((current) => ({
      ...current,
      [question.id]: {
        ...current[question.id],
        [marker]: value,
      },
    }));
    setSaveError(null);
    setRetryPayload(null);
  }

  async function finishAttempt(): Promise<void> {
    if (!allAnswered || submitting) return;

    const completedAtMs = nowMs;
    const completedAt = new Date(completedAtMs);
    const finalElapsedByQuestion = {
      ...elapsedByQuestion,
      [question.id]: (elapsedByQuestion[question.id] ?? 0) + Math.max(0, completedAtMs - questionOpenedAtMs),
    };
    const payload: PracticeAttemptPayload = retryPayload ?? {
      id: crypto.randomUUID(),
      set_id: practiceSet.id,
      set_title: practiceSet.title,
      question_type: practiceSet.question_type,
      started_at: sessionStart.at.toISOString(),
      completed_at: completedAt.toISOString(),
      total_time_ms: Math.max(0, completedAtMs - sessionStart.milliseconds),
      target_seconds_per_question: practiceSet.target_seconds_per_question,
      questions: practiceSet.questions.map((practiceQuestion) => ({
        id: practiceQuestion.id,
        prompt: practiceQuestion.prompt,
        elapsed_ms: finalElapsedByQuestion[practiceQuestion.id] ?? 0,
        blanks: practiceQuestion.blanks.map((blank) => ({
          marker: blank.marker,
          submitted_answer: (answers[practiceQuestion.id]?.[blank.marker] ?? "").trim(),
          model_answer: blank.model_answer,
          accepted_variants: blank.accepted_variants,
          focus: blank.focus,
          feedback: blank.feedback,
        })),
      })),
    };

    savePendingPracticeAttempt(payload);
    setSubmitting(true);
    setSaveError(null);
    try {
      const saved = await submitPracticeAttempt(payload);
      removePendingPracticeAttempt(payload.id);
      setRetryPayload(null);
      navigate(`/practice-attempts/${saved.id}`, { replace: true });
    } catch {
      setRetryPayload(payload);
      setSaveError("결과를 서버에 저장하지 못했습니다. 이 기기에 보관했으니 다시 저장해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/practice" className="text-xs font-medium text-blue-600 hover:underline">← 빠른 훈련</Link>
          <p className="mt-2 text-xs text-gray-400">{practiceSet.title}</p>
          <p className="text-sm font-semibold text-gray-700">{questionIndex + 1} / {practiceSet.questions.length}</p>
        </div>
        <div className={`rounded-xl px-3 py-2 text-right ${isOverTarget ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
          <p className="text-xs font-medium">{isOverTarget ? "시간 초과" : "남은 시간"}</p>
          <p className="mt-0.5 font-mono text-xl font-bold tabular-nums">
            {formatTimer(currentElapsedMs, practiceSet.target_seconds_per_question)}
          </p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${((questionIndex + 1) / practiceSet.questions.length) * 100}%` }}
        />
      </div>

      {isOverTarget && (
        <p role="status" className="text-center text-xs text-amber-700">
          1분이 지났습니다. 계속 답을 완성한 뒤 다음 문제로 넘어가세요.
        </p>
      )}

      <article className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            {practiceSet.question_type.startsWith("q51") ? "Q51" : "Q52"}
          </span>
          <span className="text-xs text-gray-400">한 문제에 집중해 보세요</span>
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="whitespace-pre-line text-sm leading-loose text-gray-800">{question.prompt}</p>
        </div>

        <div className="space-y-4">
          {question.blanks.map((blank) => (
            <div key={blank.marker} className="space-y-1.5">
              <label htmlFor={`${question.id}-${blank.marker}`} className="text-sm font-semibold text-gray-700">
                {blank.marker} 답안
              </label>
              <input
                id={`${question.id}-${blank.marker}`}
                type="text"
                autoComplete="off"
                value={answers[question.id]?.[blank.marker] ?? ""}
                onChange={(event) => updateAnswer(blank.marker, event.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-base text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                placeholder={`${blank.marker}에 들어갈 표현을 입력하세요`}
              />
            </div>
          ))}
        </div>
      </article>

      <div className="flex gap-3">
        {questionIndex > 0 && (
          <button
            type="button"
            onClick={() => changeQuestion(questionIndex - 1)}
            disabled={submitting}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            이전
          </button>
        )}
        {questionIndex < practiceSet.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => changeQuestion(questionIndex + 1)}
            disabled={submitting}
            className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finishAttempt()}
            disabled={!allAnswered || submitting}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {submitting ? "결과 저장 중…" : "답안 확인하기"}
          </button>
        )}
      </div>

      <div className="flex justify-center gap-2" aria-label="문제 이동">
        {practiceSet.questions.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => changeQuestion(index)}
            disabled={submitting}
            aria-label={`${index + 1}번 문제${isAnswered(item.id) ? ", 답안 입력 완료" : ""}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              index === questionIndex
                ? "bg-blue-600"
                : isAnswered(item.id)
                ? "bg-green-400"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {!allAnswered && questionIndex === practiceSet.questions.length - 1 && (
        <p className="text-center text-xs text-amber-700">
          모든 빈칸에 답을 입력하면 답안을 확인할 수 있습니다.
        </p>
      )}
      {saveError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs leading-relaxed text-red-700">
          <p>{saveError}</p>
          <button type="button" onClick={() => void finishAttempt()} className="mt-2 font-semibold underline">
            다시 저장하기
          </button>
        </div>
      )}
    </div>
  );
}
