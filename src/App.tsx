import { useState, useCallback, useRef, useEffect } from "react";
import { tests } from "./data/tests";
import { sendSessionData } from "./services/analytics";
import { saveSession } from "./services/session";
import type { SavedWordRecord } from "./services/session";
import type { VocabWord } from "./types";
import Header from "./components/Header";
import TestSelector from "./components/TestSelector";
import QuestionView from "./components/QuestionView";
import QuestionNav from "./components/QuestionNav";
import Sidebar from "./components/Sidebar";
import BasketDrawer from "./components/BasketDrawer";
import AccessGate, { isAccessGranted } from "./components/AccessGate";
import CompletionView from "./components/CompletionView";

export default function App() {
  const [accessGranted, setAccessGranted] = useState(() => isAccessGranted());
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0].id);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [basket, setBasket] = useState<VocabWord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("krdict-api-key") ?? ""
  );
  const [answers, setAnswers] = useState<Record<string, { selected: number; correct: boolean; timeSpentMs: number }>>({});

  // Session timing refs (don't trigger re-renders)
  const sessionStartRef = useRef<number>(Date.now());
  const questionEnteredAtRef = useRef<number>(Date.now());

  const selectedTest = tests.find((t) => t.id === selectedTestId) ?? tests[0];
  const question = selectedTest.questions[questionIndex];
  console.log(selectedTest, question)
  // Auto-save session whenever answers, timings, or basket change
  useEffect(() => {
    const now = Date.now();
    const savedWords: SavedWordRecord[] = basket
      .filter((w) => w.testId === selectedTestId)
      .map((w) => ({ korean: w.korean, english: w.english, questionNumber: w.questionNumber }));

    let correct = 0;
    const answerRecords: Record<string, { selected: number; correct: boolean }> = {};
    for (const q of selectedTest.questions) {
      const key = `${selectedTestId}-${q.문제_번호}`;
      if (key in answers) {
        const selected = answers[key];
        const isCorrect = selected === q.정답;
        if (isCorrect) correct++;
        answerRecords[String(q.문제_번호)] = { selected, correct: isCorrect };
      }
    }

    saveSession({
      testId: selectedTestId,
      startedAt: new Date(sessionStartRef.current).toISOString(),
      completedAt: new Date(now).toISOString(),
      totalTimeMs: now - sessionStartRef.current,
      questionTimings: Object.fromEntries(
        Object.entries(questionTimings).map(([k, ms]) => [k, { timeSpentMs: ms }])
      ),
      answers: answerRecords,
      savedWords,
      score: { correct, total: selectedTest.questions.length },
    });
  }, [answers, questionTimings, basket, selectedTestId, selectedTest]);

  const refreshBasket = useCallback(() => {
    setBasket(getBasket());
  }, []);

  const handleSelectTest = (id: string) => {
    setSelectedTestId(id);
    setQuestionIndex(0);
    setQuestionTimings({});
    sessionStartRef.current = Date.now();
    questionEnteredAtRef.current = Date.now();
    const newTest = tests.find((t) => t.id === id) ?? tests[0];
    const firstQ = newTest.questions[0];
    sendEvent({ type: "question_changed", testId: id, questionNumber: firstQ.문제_번호, theme: firstQ.주제 });
  };

  const handleQuestionChange = (newIndex: number) => {
    const now = Date.now();
    const elapsed = now - questionEnteredAtRef.current;
    const prevQNum = String(question.문제_번호);
    setQuestionTimings((prev) => ({
      ...prev,
      [prevQNum]: (prev[prevQNum] ?? 0) + elapsed,
    }));
    questionEnteredAtRef.current = now;
    setQuestionIndex(newIndex);
    const q = selectedTest.questions[newIndex];
    sendEvent({ type: "question_changed", testId: selectedTestId, questionNumber: q.문제_번호, theme: q.주제 });
  };

  const answerKey = `${selectedTestId}-${question.문제_번호}`;
  const selectedAnswer = answers[answerKey] ?? null;

  const handleSelectAnswer = (choice: number) => {
    setAnswers((prev) => ({ ...prev, [answerKey]: choice }));
    sendEvent({ type: "answer_selected", testId: selectedTestId, questionNumber: question.문제_번호, choice, theme: question.주제 });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        basketCount={basket.length}
        onBasketClick={() => setDrawerOpen(true)}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <TestSelector
              tests={tests}
              selectedId={selectedTestId}
              onSelect={handleSelectTest}
            />
            <QuestionNav
              current={questionIndex + 1}
              total={selectedTest.questions.length}
              onPrev={() => handleQuestionChange(Math.max(0, questionIndex - 1))}
              onNext={() => handleQuestionChange(Math.min(selectedTest.questions.length - 1, questionIndex + 1))}
            />
            <QuestionView
              question={question}
              testId={selectedTestId}
              basket={basket}
              apiKey={apiKey}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={handleSelectAnswer}
              onWordSaved={refreshBasket}
            />
          </div>
        </main>

        <Sidebar basket={basket} onWordRemoved={refreshBasket} />
      </div>

      <BasketDrawer
        open={drawerOpen}
        basket={basket}
        onClose={() => setDrawerOpen(false)}
        onWordRemoved={refreshBasket}
      />
    </div>
  );
}
