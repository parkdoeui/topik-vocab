import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  completeReviewSession,
  startReviewSession,
  submitReviewAnswer,
  type ReviewFeedback,
  type ReviewQuestion,
  type ReviewSessionResponse,
} from "../services/reviewApi";
import {
  answerPlaceholder,
  insertReplacementQuestion,
  isAnswerReady,
  isChoiceQuestion,
  submittedAnswer,
} from "../services/reviewSession";

function questionKind(question: ReviewQuestion): string {
  const labels: Record<ReviewQuestion["type"], string> = {
    particle_choice: "조사 선택",
    natural_sentence: "자연스러운 문장 선택",
    error_correction: "오류 교정",
    collocation_completion: "표현 완성",
  };
  return labels[question.type];
}

export function ReviewSession() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ReviewSessionResponse | null>(null);
  const [queue, setQueue] = useState<ReviewQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [answerIds, setAnswerIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId) return;
    let active = true;
    void startReviewSession({ id: crypto.randomUUID(), set_id: setId })
      .then((data) => {
        if (!active) return;
        setSession(data);
        setQueue(data.questions);
      })
      .catch(() => {
        if (active) setError("복습 세트를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setId]);

  const question = queue[index];

  async function grade(value: string): Promise<void> {
    if (!session || !question || feedback || submitting || !value.trim()) return;
    // Reuse this client-generated id after a transient network failure. The
    // backend can then return the original persisted feedback instead of
    // rejecting a second submission at the same queue position.
    const answerId = answerIds[question.id] ?? crypto.randomUUID();
    if (!answerIds[question.id]) {
      setAnswerIds((current) => ({ ...current, [question.id]: answerId }));
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextFeedback = await submitReviewAnswer(session.id, {
        id: answerId,
        question_id: question.id,
        sequence_index: index,
        submitted_answer: value,
        excluded_question_ids: answeredIds,
      });
      setFeedback(nextFeedback);
      setAnsweredIds((current) => [...current, question.id]);
      if (nextFeedback.replacementQuestion && nextFeedback.insertAfter) {
        setQueue((current) => insertReplacementQuestion(
          current,
          index,
          nextFeedback.replacementQuestion!,
          nextFeedback.insertAfter!,
        ));
      }
    } catch {
      setError("답안을 저장하지 못했습니다. 같은 답으로 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextQuestion(): Promise<void> {
    if (!session || !feedback) return;
    if (index + 1 >= queue.length) {
      setSubmitting(true);
      try {
        await completeReviewSession(session.id);
        navigate(`/review-results/${session.id}`, { replace: true });
      } catch {
        setError("결과를 완료 처리하지 못했습니다. 다시 시도해 주세요.");
        setSubmitting(false);
      }
      return;
    }
    setIndex((current) => current + 1);
    setChoice("");
    setTextAnswer("");
    setFeedback(null);
    setError(null);
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-400">복습 문제를 준비하는 중…</p>;
  }
  if (!session || !question) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        <p>{error ?? "복습 세트를 찾을 수 없습니다."}</p>
        <Link to="/review" className="mt-3 inline-block text-blue-600 hover:underline">복습 홈으로</Link>
      </div>
    );
  }
  const isChoice = isChoiceQuestion(question.type);
  const selected = submittedAnswer(question, choice, textAnswer);
  const percentage = Math.min(100, ((index + 1) / Math.max(session.initialQuestionCount, 1)) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/review" className="text-xs font-medium text-blue-600 hover:underline">← 표현 복습</Link>
          <p className="mt-2 text-xs text-gray-400">{session.setTitle}</p>
          <p className="text-sm font-semibold text-gray-700">오늘의 복습 · {Math.min(index + 1, session.initialQuestionCount)} / {session.initialQuestionCount}</p>
          {queue.length > session.initialQuestionCount && (
            <p className="mt-1 text-xs text-amber-700">추가 복습 {queue.length - session.initialQuestionCount}문항 포함</p>
          )}
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{questionKind(question)}</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${percentage}%` }} />
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
        <p className="whitespace-pre-line text-lg leading-loose text-gray-900">{question.question}</p>

        {isChoice ? (
          <div className="space-y-2" role="radiogroup" aria-label="답안 선택">
            {question.options?.map((option) => {
              const selectedOption = choice === option;
              const isCorrect = feedback?.correctAnswer === option;
              const isWrongSelection = feedback && selectedOption && !feedback.correct;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selectedOption}
                  disabled={Boolean(feedback) || submitting}
                  onClick={() => {
                    setChoice(option);
                    void grade(option);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isCorrect && feedback ? "border-green-300 bg-green-50 text-green-900" :
                    isWrongSelection ? "border-red-300 bg-red-50 text-red-900" :
                    selectedOption ? "border-blue-400 bg-blue-50 text-blue-900" :
                    "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40"
                  } disabled:cursor-default`}
                >
                  <span className="mr-3 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                    {isCorrect && feedback ? "✓" : isWrongSelection ? "×" : ""}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="review-answer" className="text-sm font-medium text-gray-700">답안</label>
            <textarea
              id="review-answer"
              value={textAnswer}
              disabled={Boolean(feedback) || submitting}
              onChange={(event) => setTextAnswer(event.target.value)}
              placeholder={answerPlaceholder(question.type)}
              className="min-h-28 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm leading-relaxed text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
            />
            {!feedback && (
              <button
                type="button"
                disabled={!isAnswerReady(question, choice, textAnswer) || submitting}
                onClick={() => void grade(selected)}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {submitting ? "확인 중…" : "정답 확인"}
              </button>
            )}
          </div>
        )}

        {feedback && (
          <section role="status" className={`rounded-xl border p-4 ${feedback.correct ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <p className={`text-sm font-bold ${feedback.correct ? "text-green-800" : "text-amber-800"}`}>
              {feedback.correct ? "✓ 정답입니다" : "✕ 다시 익혀 볼 표현입니다"}
            </p>
            {!feedback.correct && <p className="mt-2 text-sm text-gray-700">내 답: {selected}</p>}
            <p className="mt-2 text-base font-semibold text-gray-900">{feedback.correctAnswer}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{feedback.explanation}</p>
            {feedback.replacementQuestion && (
              <p className="mt-3 text-xs text-amber-800">이 패턴은 다른 문장으로 잠시 후 다시 나옵니다.</p>
            )}
            <button
              type="button"
              onClick={() => void nextQuestion()}
              disabled={submitting}
              className="mt-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
            >
              {index + 1 >= queue.length ? "결과 보기" : "다음 문제"}
            </button>
          </section>
        )}
      </article>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}
    </div>
  );
}
