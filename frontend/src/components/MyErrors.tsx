import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getMyReviewErrors, type MyReviewError } from "../services/reviewApi";

export function MyErrors() {
  const [errors, setErrors] = useState<MyReviewError[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void getMyReviewErrors().then((data) => { if (active) setErrors(data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <header><Link to="/review" className="text-xs font-medium text-blue-600 hover:underline">← 표현 복습</Link><h1 className="mt-3 text-2xl font-bold text-gray-900">나의 반복 오류</h1><p className="mt-2 text-sm text-gray-500">실제 쓰기 답안과 복습에서 많이 틀린 표현 순서입니다.</p></header>
      {failed ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">오류 목록을 불러오지 못했습니다.</p> : errors.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">아직 기록된 오류가 없습니다.</p> : <section className="space-y-3">{errors.map((item) => <article key={item.pattern} className="rounded-2xl border border-gray-200 bg-white p-5"><p className="text-sm text-red-700 line-through">{item.incorrectExpression}</p><p className="mt-1 text-lg font-semibold text-gray-900">→ {item.naturalExpression}</p><p className="mt-2 text-xs text-gray-500">{item.pattern}</p><p className="mt-3 text-sm text-gray-600">실제 답안 {item.historicalErrorCount}회 · 복습 오답 {item.quizIncorrectCount}회</p></article>)}</section>}
    </div>
  );
}
