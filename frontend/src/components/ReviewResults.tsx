import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getReviewResult, type ReviewResult } from "../services/reviewApi";

export function ReviewResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void getReviewResult(sessionId)
      .then((data) => { if (active) setResult(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [sessionId]);

  if (!result && !failed) return <p className="py-16 text-center text-sm text-gray-400">결과를 불러오는 중…</p>;
  if (!result) return <p className="py-16 text-center text-sm text-red-700">결과를 불러오지 못했습니다.</p>;
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <header>
        <p className="text-xs font-medium text-blue-600">{result.setTitle}</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">복습 결과</h1>
      </header>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">기본 세트 점수</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">{result.baseCorrectCount} / {result.initialQuestionCount}</p>
        {result.supplementalAttemptCount > 0 && <p className="mt-3 text-sm text-amber-700">추가 복습 {result.supplementalAttemptCount}문항 · 전체 풀이 {result.attemptedCount}문항</p>}
      </section>
      <section className="space-y-3" aria-label="문항별 결과">
        <h2 className="font-bold text-gray-900">문항별 결과</h2>
        {result.answers.map((answer, index) => (
          <article key={index} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-gray-900">{index + 1}. {answer.question}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${answer.correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {answer.correct ? "정답" : "오답"}
              </span>
            </div>
            {answer.isSupplemental && <p className="mt-2 text-xs text-gray-500">추가 복습 문항</p>}
            <p className="mt-3 text-sm text-gray-700">내 답: {answer.submittedAnswer}</p>
            {!answer.correct && <p className="mt-1 text-sm font-medium text-green-700">정답: {answer.correctAnswer}</p>}
            {answer.explanation && <p className="mt-2 text-sm leading-relaxed text-gray-500">{answer.explanation}</p>}
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-bold text-gray-900">다시 볼 표현</h2>
        {result.missedPatterns.length === 0 ? <p className="mt-3 text-sm text-green-700">이번 세트에서 다시 볼 표현이 없습니다.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">
            {result.missedPatterns.map((item) => <li key={item.pattern} className="py-3"><p className="font-semibold text-gray-900">{item.naturalExpression}</p><p className="mt-1 text-xs text-gray-500">{item.pattern}</p></li>)}
          </ul>
        )}
      </section>
      <div className="flex gap-3"><Link to="/review" className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700">복습 세트 목록</Link><Link to="/my-errors" className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">나의 오류</Link></div>
    </div>
  );
}
