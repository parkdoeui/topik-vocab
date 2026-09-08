import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getProgress } from "../services/api";
import type { ProgressData } from "../services/api";

export function ProgressDashboard() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgress().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!data || data.total_sessions === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
        <p className="text-sm">아직 제출한 답안이 없습니다.</p>
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          시험 시작하기
        </Link>
      </div>
    );
  }

  const avgPct =
    data.average_score > 0 ? Math.round(data.average_score) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Progress</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{data.total_sessions}</p>
          <p className="text-xs text-gray-400 mt-1">총 제출 횟수</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{avgPct}%</p>
          <p className="text-xs text-gray-400 mt-1">평균 점수</p>
        </div>
      </div>

      {/* Session history */}
      {data.sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">최근 세션</h3>
          <div className="space-y-3">
            {data.sessions
              .slice()
              .reverse()
              .slice(0, 10)
              .map((s) => {
                const pct =
                  s.max_score > 0
                    ? Math.round((s.total_score / s.max_score) * 100)
                    : 0;
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{s.test_id}</span>
                      <span className="text-gray-500 tabular-nums">
                        {s.total_score}/{s.max_score}점
                        <span className="text-xs text-gray-400 ml-1">
                          ({new Date(s.date).toLocaleDateString("ko-KR")})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 80
                            ? "bg-green-400"
                            : pct >= 60
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
