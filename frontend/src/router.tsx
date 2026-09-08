import { createBrowserRouter } from "react-router";
import { App } from "./App";
import { Dashboard } from "./components/Dashboard";
import { ReadingTest } from "./components/ReadingTest";
import { ResultsView } from "./components/ResultsView";
import { ProgressDashboard } from "./components/ProgressDashboard";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: "reading/:id", element: <ReadingTest /> },
        { path: "reading-results/:id", element: <ResultsView section="reading" /> },
        { path: "progress", element: <ProgressDashboard /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
