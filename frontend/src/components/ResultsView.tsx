import { useParams, Link } from "react-router";
import { loadSession } from "../services/session";
import { readingTests } from "../data/tests";
import { AnswerSheet } from "./AnswerSheet";

interface ResultsViewProps {
  section: "reading" | "listening";
}

export function ResultsView({ section }: ResultsViewProps) {
  const { id } = useParams<{ id: string }>();
  const session = id ? loadSession(id) : null;

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Results not found.{" "}
        <Link to="/" className="text-blue-600 ml-1 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const test =
    section === "reading"
      ? readingTests.find((t) => t.id === session.testId)
      : undefined;

  const correctAnswers: Record<string, number | null> =
    test && test.render_mode === "structured"
      ? Object.fromEntries(test.questions.map((q) => [String(q.number), q.answer]))
      : {};

  const pct = session.score.total > 0
    ? Math.round((session.score.correct / session.score.total) * 100)
    : 0;

  const durationMin = Math.round(session.totalTimeMs / 60000);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      {/* Score card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">
            {test?.title ?? session.testId}
          </h2>
          <span className="text-xs text-gray-400">
            {session.syncStatus === "synced" ? "✓ synced" : "local"}
          </span>
        </div>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-4xl font-bold text-blue-600">
            {session.score.correct}
          </span>
          <span className="text-xl text-gray-400">/ {session.score.total}</span>
          <span
            className={`text-2xl font-semibold ml-2 ${
              pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"
            }`}
          >
            {pct}%
          </span>
        </div>
        <p className="text-xs text-gray-400">{durationMin} min</p>
      </div>

      {/* Answer sheet review */}
      {test && test.render_mode === "structured" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Answer Review</h3>
          <AnswerSheet
            totalQuestions={test.questions.length}
            answers={Object.fromEntries(
              Object.entries(session.answers).map(([k, v]) => [k, v.selected])
            )}
            correctAnswers={correctAnswers}
            readOnly
          />
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> Wrong
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-400" /> Correct (not answered)
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          to="/"
          className="flex-1 text-center rounded-xl border border-gray-300 text-sm text-gray-700 py-2.5 hover:bg-gray-50"
        >
          Home
        </Link>
        <Link
          to="/progress"
          className="flex-1 text-center rounded-xl bg-blue-600 text-white text-sm font-medium py-2.5 hover:bg-blue-700"
        >
          View Progress
        </Link>
      </div>
    </div>
  );
}
