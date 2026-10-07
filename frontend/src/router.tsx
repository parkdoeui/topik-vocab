import { createBrowserRouter } from "react-router";
import { App } from "./App";
import { WritingHome } from "./components/WritingHome";
import { WritingTest } from "./components/WritingTest";
import { TranscriptionReview } from "./components/TranscriptionReview";
import { WritingResultsView } from "./components/WritingResultsView";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { PracticeHome } from "./components/PracticeHome";
import { PracticeSession } from "./components/PracticeSession";
import { PracticeAttemptReview } from "./components/PracticeAttemptReview";
import { ReviewHome } from "./components/ReviewHome";
import { ReviewSession } from "./components/ReviewSession";
import { ReviewResults } from "./components/ReviewResults";
import { MyErrors } from "./components/MyErrors";
import { ReadingPracticeHome } from "./components/ReadingPracticeHome";
import { ReadingPracticeSession } from "./components/ReadingPracticeSession";
import { ReadingPracticeReview } from "./components/ReadingPracticeReview";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <WritingHome /> },
        { path: "writing/:id", element: <WritingTest /> },
        { path: "writing/:id/transcribe", element: <TranscriptionReview /> },
        { path: "writing-results/:id", element: <WritingResultsView /> },
        { path: "progress", element: <ProgressDashboard /> },
        { path: "practice", element: <PracticeHome /> },
        { path: "practice/:setId", element: <PracticeSession /> },
        { path: "practice-attempts/:attemptId", element: <PracticeAttemptReview /> },
        { path: "reading", element: <ReadingPracticeHome /> },
        { path: "reading/:setId", element: <ReadingPracticeSession /> },
        { path: "reading-attempts/:attemptId", element: <ReadingPracticeReview /> },
        { path: "review", element: <ReviewHome /> },
        { path: "review/:setId", element: <ReviewSession /> },
        { path: "review-results/:sessionId", element: <ReviewResults /> },
        { path: "my-errors", element: <MyErrors /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
