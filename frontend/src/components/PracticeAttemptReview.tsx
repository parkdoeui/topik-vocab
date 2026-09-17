import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getPracticeAttempt, type PracticeAttemptResponse } from "../services/api";

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PracticeAttemptReview() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<PracticeAttemptResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(attemptId));

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    getPracticeAttempt(attemptId).then((result) => {
      if (cancelled) return;
      setAttempt(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        풀이 결과를 불러오는 중…
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <p>풀이 결과를 찾을 수 없습니다.</p>
        <Link to="/practice" className="text-blue-600 hover:underline">빠른 훈련으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
        <p className="text-xs text-gray-400">{new Date(attempt.completed_at).toLocaleString("ko-KR")}</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{attempt.set_title}</h1>
        <p className="mt-2 text-sm text-gray-500">제출한 답과 예시 답안을 비교해 보세요.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400">총 풀이 시간</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{formatDuration(attempt.total_time_ms)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-blue-600">1분 안에 푼 문제</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-blue-800">
              {attempt.within_target_count}<span className="text-sm font-medium">/{attempt.question_count}</span>
            </p>
          </div>
        </div>
      </header>

      <p className="rounded-xl bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
        예시 답안과 다른 자연스러운 표현도 가능합니다. 이 화면은 자동 채점 결과가 아니라 복습을 위한 안내입니다.
      </p>

      <div className="space-y-4">
        {attempt.questions.map((question, questionIndex) => {
          const withinTarget = question.elapsed_ms <= attempt.target_seconds_per_question * 1000;
          return (
            <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-gray-900">{questionIndex + 1}번</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${withinTarget ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                  {formatDuration(question.elapsed_ms)} {withinTarget ? "· 1분 안" : "· 시간 초과"}
                </span>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="whitespace-pre-line text-sm leading-loose text-gray-800">{question.prompt}</p>
              </div>

              <div className="space-y-4">
                {question.blanks.map((blank) => (
                  <section key={blank.marker} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                    <p className="text-sm font-bold text-gray-800">{blank.marker}</p>
                    <div className="mt-2 grid gap-2 text-sm">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-400">내 답안</p>
                        <p className="mt-1 text-gray-800">{blank.submitted_answer}</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-600">예시 답안</p>
                        <p className="mt-1 font-medium text-blue-950">{blank.model_answer}</p>
                      </div>
                    </div>
                    {blank.accepted_variants.length > 0 && (
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">
                        다른 자연스러운 답: {blank.accepted_variants.join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 rounded-xl border border-gray-100 p-3 text-xs leading-relaxed text-gray-600">
                      <p className="font-semibold text-gray-700">{blank.focus}</p>
                      <p className="mt-1">{blank.feedback}</p>
                    </div>
                  </section>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link
          to="/practice"
          className="rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          풀이 기록
        </Link>
        <Link
          to={`/practice/${attempt.set_id}`}
          className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          다시 풀기
        </Link>
      </div>
    </div>
  );
}
