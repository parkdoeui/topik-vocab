export type WritingQuestionType = "short-blank" | "chart-description" | "essay";

export interface WritingQuestion {
  number: number;
  type: WritingQuestionType;
  instruction: string;
  prompt: string;
  image_url?: string;
  blanks?: string[];
  min_chars?: number;
  max_chars?: number;
  max_points: number;
}

export interface WritingTest {
  id: string;
  title: string;
  level: "TOPIK II";
  round: number;
  section: "writing";
  questions: WritingQuestion[];
  time_limit_minutes: number;
  source?: string;
}
