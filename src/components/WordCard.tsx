import { removeWord } from "../services/storage";
import { sendEvent } from "../services/analytics";
import type { VocabWord } from "../types";

interface WordCardProps {
  word: VocabWord;
  onRemoved: () => void;
}

export default function WordCard({ word, onRemoved }: WordCardProps) {
  const handleRemove = () => {
    removeWord(word.id);
    sendEvent({ type: "word_removed", testId: word.testId, questionNumber: word.questionNumber, word: word.korean });
    onRemoved();
  };

  return (
    <div className="flex items-start gap-2 py-3 border-b border-gray-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-gray-900 text-base">{word.korean}</span>
          {word.partOfSpeech && (
            <span className="text-[10px] text-gray-400">{word.partOfSpeech}</span>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-0.5">{word.english}</div>
        <div className="text-xs text-gray-400 mt-1 line-clamp-2 italic">
          {word.exampleSentence}
        </div>
      </div>
      <button
        onClick={handleRemove}
        aria-label={`Remove ${word.korean}`}
        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
