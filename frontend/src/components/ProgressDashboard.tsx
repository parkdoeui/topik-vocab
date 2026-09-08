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
        <p className="text-sm">No sessions yet. Take a test to see your progress.</p>
        <Link
          to="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Start a test
        </Link>
      </div>
    );
  }

  const { per_section_accuracy: psa, per_topic_accuracy: pta, score_history } = data;

  const pct = (c: number, t: number) =>
    t > 0 ? `${Math.round((c / t) * 100)}%` : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Progress</h2>

      {/* Section accuracy */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Section Accuracy</h3>
        <div className="space-y-2">
          {(["reading", "listening"] as const).map((section) => {
            const s = psa[section];
            return (
              <div key={section} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 capitalize">{section}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: s.total > 0 ? `${(s.correct / s.total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {s.correct}/{s.total} ({pct(s.correct, s.total)})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-topic accuracy */}
      {pta.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">By Topic (읽기)</h3>
          <div className="space-y-2">
            {pta
              .slice()
              .sort((a, b) => a.accuracy - b.accuracy)
              .map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 truncate">{t.topic}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full"
                      style={{ width: `${t.accuracy * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {Math.round(t.accuracy * 100)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {score_history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Sessions</h3>
          <div className="space-y-2">
            {score_history.slice(-10).reverse().map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{s.test_id}</span>
                  <span className="text-xs text-gray-400 ml-2 capitalize">{s.section}</span>
                </div>
                <div className="text-gray-600">
                  {s.correct}/{s.total}{" "}
                  <span className="text-xs text-gray-400">
                    ({new Date(s.date).toLocaleDateString()})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
