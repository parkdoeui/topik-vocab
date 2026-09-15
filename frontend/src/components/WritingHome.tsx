import { useEffect, useState } from "react";
import { Link } from "react-router";
import { writingTests } from "../data/tests";
import { getProgress } from "../services/api";

const TYPE_LABELS: Record<string, string> = {
  "short-blank": "단문 쓰기",
  "chart-description": "도표 설명",
  "essay": "논설문",
};

export function WritingHome() {
  const [latestResultByTest, setLatestResultByTest] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    getProgress().then((progress) => {
      if (cancelled || !progress) return;

      const latest: Record<string, { id: string; date: string }> = {};
      for (const session of progress.sessions) {
        const current = latest[session.test_id];
        if (!current || session.date > current.date) {
          latest[session.test_id] = { id: session.id, date: session.date };
        }
      }
      setLatestResultByTest(
        Object.fromEntries(
          Object.entries(latest).map(([testId, session]) => [testId, session.id])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">TOPIK II 쓰기</h1>
      <p className="text-sm text-gray-500 mb-8">
        손으로 쓴 답안 사진을 업로드하면 AI가 채점합니다.
      </p>

      <div className="space-y-3">
        {writingTests.map((test) => {
          const types = [...new Set(test.questions.map((q) => TYPE_LABELS[q.type] ?? q.type))];
          const totalPoints = test.questions.reduce((s, q) => s + q.max_points, 0);
          const resultId = latestResultByTest[test.id];

          return (
            <div
              key={test.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{test.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {test.questions.length}문제 · {totalPoints}점 · {test.time_limit_minutes}분
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {types.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Link
                  to={`/writing/${test.id}`}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {resultId ? "다시 풀기" : "시작"}
                </Link>
                {resultId && (
                  <Link
                    to={`/writing-results/${resultId}`}
                    className="rounded-xl border border-blue-200 px-4 py-2 text-center text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                  >
                    채점 결과 보기
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {writingTests.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            등록된 시험이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
