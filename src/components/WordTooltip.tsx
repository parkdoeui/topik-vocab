import type { DictionaryResult } from "../types";

interface WordTooltipProps {
  result: DictionaryResult | null;
  loading: boolean;
  visible: boolean;
}

export default function WordTooltip({ result, loading, visible }: WordTooltipProps) {
  if (!visible) return null;

  return (
    <span
      role="tooltip"
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 pointer-events-none"
    >
      <span className="block whitespace-nowrap bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg leading-tight">
        {loading ? (
          <span className="opacity-60">…</span>
        ) : result ? (
          <>
            <span className="font-semibold">{result.korean}</span>
            <span className="opacity-60 mx-1">·</span>
            <span>{result.english}</span>
            {result.partOfSpeech && (
              <span className="opacity-50 ml-1 text-[10px]">
                ({result.partOfSpeech})
              </span>
            )}
          </>
        ) : (
          <span className="opacity-60">not found</span>
        )}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
