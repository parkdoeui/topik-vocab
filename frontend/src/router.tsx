import { createBrowserRouter } from "react-router";
import { App } from "./App";
import { WritingHome } from "./components/WritingHome";
import { WritingTest } from "./components/WritingTest";
import { TranscriptionReview } from "./components/TranscriptionReview";
import { WritingResultsView } from "./components/WritingResultsView";
import { ProgressDashboard } from "./components/ProgressDashboard";

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
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
