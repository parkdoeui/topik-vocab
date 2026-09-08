import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { writingTests } from "../data/tests";
import { getWritingSession } from "../services/api";
import type { WritingSessionResponse } from "../services/api";

const CRITERIA_LABELS: Record<string, string> = {
  "내용_및_과제수행": "내용 및 과제 수행",
  "전개구조": "글의 전개 구조",
  "언어사용": "언어 사용",
};

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-600 w-14 text-right">
        {score}/{max}
      </span>
    </div>
  );
}

export function WritingResultsView() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<WritingSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try localStorage first (fast path)
    const cached = localStorage.getItem(`topik-writing-result-${id}`);
    if (cached) {
      try {
        setResult(JSON.parse(cached) as WritingSessionResponse);
        setLoading(false);
        return;
      } catch {
        // fall through to API fetch
      }
    }
    // Fetch from API
    if (id) {
      getWritingSession(id).then((r) => {
        setResult(r);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        결과 불러오는 중…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500 text-sm">
        <p>결과를 찾을 수 없습니다.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          홈으로
        </Link>
      </div>
    );
  }

  const test = writingTests.find((t) => t.id === result.test_id);
  const grading = result.grading ?? {};

  const totalScore = Object.values(grading).reduce((s, g) => s + g.score, 0);
  const maxScore = test
    ? test.questions.reduce((s, q) => s + q.max_points, 0)
    : Object.values(grading).reduce((s, g) => s + g.max_score, 0);

  const scorePct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
      {/* Total score */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">총점</p>
        <p className="text-5xl font-bold text-gray-900 my-2">
          {totalScore}
          <span className="text-2xl text-gray-400">/{maxScore}</span>
        </p>
        <p className="text-sm text-gray-400">{scorePct}%</p>
        {test && (
          <p className="text-xs text-gray-400 mt-1">{test.title}</p>
        )}
      </div>

      {/* Per-question breakdown */}
      {(test?.questions ?? []).map((q) => {
        const g = grading[String(q.number)];
        if (!g) return null;

        return (
          <div key={q.number} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">{q.number}번</span>
              <span className="text-sm font-semibold text-gray-700">
                {g.score}/{g.max_score}점
              </span>
            </div>

            <ScoreBar score={g.score} max={g.max_score} />

            {/* Criteria */}
            {Object.entries(g.criteria ?? {}).map(([key, c]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {CRITERIA_LABELS[key] ?? key}
                  </span>
                  <span className="text-xs tabular-nums text-gray-500">
                    {c.score}/{c.max}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${c.max > 0 ? (c.score / c.max) * 100 : 0}%` }}
                  />
                </div>
                {c.comment && (
                  <p className="text-xs text-gray-500 leading-relaxed">{c.comment}</p>
                )}
              </div>
            ))}

            {/* Overall feedback */}
            {g.feedback && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-800 leading-relaxed">{g.feedback}</p>
              </div>
            )}

            {/* Submitted transcription */}
            {result.answers?.[String(q.number)]?.transcription && (
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600">
                  제출한 답안 보기
                </summary>
                <p className="mt-2 leading-relaxed whitespace-pre-wrap text-gray-600 bg-gray-50 rounded-lg p-3">
                  {result.answers[String(q.number)].transcription}
                </p>
              </details>
            )}
          </div>
        );
      })}

      <Link
        to="/"
        className="block w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-center text-gray-600 hover:bg-gray-50 transition-colors"
      >
        홈으로
      </Link>
    </div>
  );
}
