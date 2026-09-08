import { Link } from "react-router";
import { readingTests } from "../data/tests";

export function Dashboard() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      <h2 className="text-xl font-bold text-gray-900 mb-1">읽기 (Reading)</h2>
      <p className="text-sm text-gray-500 mb-4">TOPIK II 읽기 practice tests</p>
      <div className="space-y-2">
        {readingTests.map((test) => (
          <Link
            key={test.id}
            to={`/reading/${test.id}`}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">{test.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {test.render_mode === "structured"
                  ? `${test.questions.length}문제 · ${test.time_limit_minutes}분`
                  : `PDF · ${test.time_limit_minutes}분`}
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      <div className="mt-8 space-y-2 opacity-50 pointer-events-none">
        <h2 className="text-xl font-bold text-gray-900 mb-1">듣기 (Listening)</h2>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400">
          Coming soon — add a listening test via ingest/
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1 mt-6">쓰기 (Writing)</h2>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400">
          Coming soon — add a writing test via ingest/
        </div>
      </div>
    </div>
  );
}
