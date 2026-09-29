import themedSets from "./writing-practice/q51-q52-themed-sets.json";

export interface PracticeBlankDefinition {
  marker: string;
  model_answer: string;
  accepted_variants: string[];
  focus: string;
  feedback: string;
}

export interface PracticeQuestionDefinition {
  id: string;
  question_number?: 51 | 52 | 53 | 54;
  prompt: string;
  blanks: PracticeBlankDefinition[];
}

export interface PracticeSetDefinition {
  id: string;
  title: string;
  question_type: string;
  target_seconds_per_question: number;
  description: string;
  accepted_variants_policy: string;
  questions: PracticeQuestionDefinition[];
}

export const practiceSets: PracticeSetDefinition[] = themedSets as PracticeSetDefinition[];

export function getPracticeSet(id: string | undefined): PracticeSetDefinition | undefined {
  return practiceSets.find((set) => set.id === id);
}
