import { useState, useRef, useCallback } from "react";
import { lookup } from "../services/dictionary";
import type { DictionaryResult, VocabEntry, VocabWord } from "../types";
import WordTooltip from "./WordTooltip";

interface ClickableWordProps {
  word: string;
  testId: string;
  questionNumber: number;
  theme?: string;
  exampleSentence: string;
  apiKey?: string;
  vocabMap?: VocabEntry[];
  isSaved: boolean;
  onSaved: () => void;
}

export default function ClickableWord({
  word,
  testId,
  questionNumber,
  theme = "",
  exampleSentence,
  apiKey,
  vocabMap,
  isSaved,
  onSaved,
}: ClickableWordProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const fetchAndShow = useCallback(async (): Promise<DictionaryResult | null> => {
    if (result) {
      setTooltipVisible(true);
      return result;
    }
    setLoading(true);
    setTooltipVisible(true);
    const res = await lookup(word, apiKey, vocabMap);
    setResult(res);
    setLoading(false);
    return res;
  }, [word, apiKey, vocabMap, result]);

  const saveWord = useCallback((res: DictionaryResult) => {
    if (isSaved) return;
    const id = `${res.korean}-${testId}-${questionNumber}`;
    const existing = getBasket().find((w) => w.id === id);
    if (existing) return;
    const vocabWord: VocabWord = {
      id,
      korean: res.korean,
      english: res.english,
      partOfSpeech: res.partOfSpeech,
      exampleSentence,
      testId,
      questionNumber,
      savedAt: Date.now(),
    };
    addWord(vocabWord);
    sendEvent({ type: "word_saved", testId, questionNumber, word: res.korean, theme });
    onSaved();
  }, [isSaved, testId, questionNumber, exampleSentence, onSaved]);

  const handleMouseEnter = () => {
    clearTimers();
    fetchAndShow();
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setTooltipVisible(false), 300);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchAndShow().then((res) => { if (res) saveWord(res); });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimers();
    fetchAndShow().then((res) => {
      if (!res) return;
      touchTimer.current = setTimeout(() => {
        saveWord(res);
        setTooltipVisible(false);
      }, 1500);
    });
  };

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        className={`cursor-pointer rounded px-0.5 transition-colors select-none ${
          isSaved
            ? "bg-yellow-200 text-yellow-900"
            : "hover:bg-blue-100 hover:text-blue-900"
        }`}
      >
        {word}
      </span>
      <WordTooltip result={result} loading={loading} visible={tooltipVisible} />
    </span>
  );
}
