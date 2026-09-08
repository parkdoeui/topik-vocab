import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { writingTests } from "../data/tests";
import { getWritingSession } from "../services/api";
import type { QuestionGrading, WritingSessionResponse } from "../services/api";

const CRITERIA_ORDER = ["내용_및_과제수행", "전개구조", "언어사용"] as const;
const CRITERIA_LABELS: Record<string, string> = {
  "내용_및_과제수행": "내용 및 과제 수행",
  "전개구조": "글의 전개 구조",
  "언어사용": "언어 사용",
};

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
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
      <span className="text-xs tabular-nums text-gray-600 w-16 text-right">
        {score}/{max}
      </span>
    </div>
  );
}

function QuestionCard({
  number,
  maxPoints,
  grading,
  transcription,
}: {
  number: number;
  maxPoints: number;
  grading: QuestionGrading;
  transcription?: string;
}) {
  const maxScore = grading.max_score || maxPoints;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900">{number}번</span>
        <span className="text-sm font-semibold text-gray-700">
          {grading.score}/{maxScore}점
        </span>
      </div>

      <ScoreBar score={grading.score} max={maxScore} />

      {/* Current state / next goal */}
      {(grading.current_state || grading.primary_goal) && (
        <div className="space-y-2">
          {grading.current_state && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {grading.current_state}
            </p>
          )}
          {grading.primary_goal && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">다음 목표</p>
              <p className="text-xs text-blue-800 leading-relaxed">
                {grading.primary_goal}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Criteria breakdown */}
      <div className="space-y-3 pt-1">
        {CRITERIA_ORDER.map((key) => {
          const score = grading.criteria?.[key];
          if (score === undefined) return null;
          const evidence = grading.criterion_evidence?.[key];
          const points = grading.detailed_improvement_points?.[key] ?? [];
          return (
            <div key={key} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {CRITERIA_LABELS[key] ?? key}
                </span>
                <span className="text-sm tabular-nums text-gray-500">{score}점</span>
              </div>
              {evidence && (
                <p className="text-xs text-gray-500 leading-relaxed mt-1">{evidence}</p>
              )}
              {points.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {points.map((p, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                      <span className="text-gray-300">•</span>
                      <span className="leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Sample answer */}
      {grading.sample_answer && (
        <details className="text-xs">
          <summary className="cursor-pointer text-blue-600 hover:underline">
            예시 답안 보기
          </summary>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap text-gray-700 bg-blue-50/50 rounded-lg p-3">
            {grading.sample_answer}
          </p>
        </details>
      )}

      {/* Submitted answer */}
      {transcription && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600">제출한 답안 보기</summary>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap text-gray-600 bg-gray-50 rounded-lg p-3">
            {transcription}
          </p>
        </details>
      )}
    </div>
  );
}

export function WritingResultsView() {
  const { id } = useParams<{ id: string }>();

  const cached = (() => {
    try {
      const raw = localStorage.getItem(`topik-writing-result-${id}`);
      return raw ? (JSON.parse(raw) as WritingSessionResponse) : null;
    } catch {
      return null;
    }
  })();

  const [result, setResult] = useState<WritingSessionResponse | null>(cached);
  const [loading, setLoading] = useState(!cached && !!id);

  useEffect(() => {
    if (cached || !id) return;
    getWritingSession(id).then((r) => {
      setResult(r);
      setLoading(false);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const grading = result.grading;
  const questions = grading?.questions ?? {};

  const totalScore = grading?.total_score ?? 0;
  const maxScore = test
    ? test.questions.reduce((s, q) => s + q.max_points, 0)
    : Object.values(questions).reduce((s, g) => s + g.max_score, 0);
  const scorePct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const actionPoints = grading?.action_points ?? [];

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
        {test && <p className="text-xs text-gray-400 mt-1">{test.title}</p>}
      </div>

      {/* Per-question breakdown */}
      {(test?.questions ?? []).map((q) => {
        const g = questions[String(q.number)];
        if (!g) return null;
        return (
          <QuestionCard
            key={q.number}
            number={q.number}
            maxPoints={q.max_points}
            grading={g}
            transcription={result.answers?.[String(q.number)]?.transcription}
          />
        );
      })}

      {/* Overall action points */}
      {actionPoints.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">종합 조언</h3>
          <ul className="space-y-2">
            {actionPoints.map((p, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-blue-400 font-semibold">{i + 1}.</span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to="/"
        className="block w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-center text-gray-600 hover:bg-gray-50 transition-colors"
      >
        홈으로
      </Link>
    </div>
  );
}
