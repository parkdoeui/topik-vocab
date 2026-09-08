import { Link } from "react-router";
import { writingTests } from "../data/tests";

const TYPE_LABELS: Record<string, string> = {
  "short-blank": "단문 쓰기",
  "chart-description": "도표 설명",
  "essay": "논설문",
};

export function WritingHome() {
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
              <Link
                to={`/writing/${test.id}`}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                시작
              </Link>
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
