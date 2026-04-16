import type { TopikTest } from "../types";

interface TestSelectorProps {
  tests: TopikTest[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function TestSelector({
  tests,
  selectedId,
  onSelect,
}: TestSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Select Test
      </label>
      <div className="flex flex-wrap gap-2">
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              t.id === selectedId
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            <span className="mr-1.5">
              {t.level === "TOPIK I" ? "①" : "②"}
            </span>
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}
