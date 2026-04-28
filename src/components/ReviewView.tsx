import { useState } from "react";
import type { QuizSet } from "../data/quizData";
import { markSetCleared } from "../data/quizData";
import FlashcardView from "./FlashcardView";
import QuizView from "./QuizView";
import ChallengeView from "./ChallengeView";

type Mode = "flashcard" | "quiz" | "challenge";

interface ReviewViewProps {
  quizSet: QuizSet;
  onBack: () => void;
  onSetCleared: (setId: number) => void;
}

export default function ReviewView({ quizSet, onBack, onSetCleared }: ReviewViewProps) {
  const [mode, setMode] = useState<Mode>("flashcard");

  const handleCleared = () => {
    markSetCleared(quizSet.id);
    onSetCleared(quizSet.id);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors"
          aria-label="Back to quiz sets"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{quizSet.title}</h2>
        <span className="text-sm text-gray-400">{quizSet.cards.length} words</span>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setMode("flashcard")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "flashcard"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Flashcard
        </button>
        <button
          onClick={() => setMode("quiz")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "quiz"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Take Quiz
        </button>
      </div>

      {/* Content */}
      {mode === "flashcard" ? (
        <FlashcardView cards={quizSet.cards} />
      ) : (
        <QuizView cards={quizSet.cards} onCleared={handleCleared} />
      )}
    </div>
  );
}
