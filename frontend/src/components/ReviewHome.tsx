import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getReviewSets, type ReviewSetSummary } from "../services/reviewApi";

export function ReviewHome() {
  const [sets, setSets] = useState<ReviewSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void getReviewSets()
      .then((data) => {
        if (active) setSets(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-7">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">표현 복습</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            쓰기 답안에서 자주 틀린 조사와 명사·동사 결합을 선택형 문제로 다시 익혀 보세요.
          </p>
        </div>
        <Link to="/my-errors" className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          나의 오류
        </Link>
      </header>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">복습 세트를 불러오는 중…</p>
      ) : failed ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          복습 세트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <section className="space-y-3" aria-label="복습 세트">
          {sets.map((set) => (
            <article key={set.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{set.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{set.description}</p>
                  <p className="mt-3 text-xs text-gray-400">
                    기본 {set.questionCount}문항 · 모두 4지선다 · 조사 선택 6 · 문장 선택 6 · 오류 교정 4 · 완성 4
                  </p>
                  {set.latestBaseCorrectCount !== null && (
                    <p className="mt-1 text-xs font-medium text-green-700">
                      최근 기본 점수 {set.latestBaseCorrectCount} / {set.questionCount}
                    </p>
                  )}
                </div>
                <Link
                  to={`/review/${set.id}`}
                  className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  시작하기
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
