export interface ChallengeWord {
  korean: string;
  expectedEnglish: string;
  userAnswer: string;
}

export interface GradedWord {
  korean: string;
  userAnswer: string;
  correct: boolean;
  feedback: string;
}

function buildPrompt(words: ChallengeWord[]): string {
  const list = words
    .map((w, i) => `${i + 1}. Korean: "${w.korean}" | Expected: "${w.expectedEnglish}" | User answered: "${w.userAnswer || "(blank)"}"`)
    .join("\n");

  return `You are grading a Korean vocabulary quiz. For each word, decide if the user's answer is correct.
Be lenient: accept synonyms, partial matches, and reasonable paraphrases. Mark as incorrect only if the meaning is clearly wrong or blank.

Return a JSON array — one object per word — in this exact format:
[{"korean":"...","userAnswer":"...","correct":true,"feedback":"..."}]

The "feedback" field should be one short sentence: confirm correct answers briefly, and for wrong answers explain the actual meaning.

Words to grade:
${list}`;
}

export async function gradeChallenge(words: ChallengeWord[]): Promise<GradedWord[]> {
  const apiKey =
    localStorage.getItem("gemini-api-key") ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    "";

  if (!apiKey) {
    throw new Error("No Gemini API key set. Add one in Settings.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(words) }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const graded = JSON.parse(text) as GradedWord[];
  return graded;
}
