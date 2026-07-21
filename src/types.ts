export type LanguageCode = "en" | "es" | "it" | "tr" | "ru" | "zh" | "hi" | "pl" | "ko" | "fr";

export interface Exercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Partial<Record<LanguageCode, string>>;
  instruction_steps: Partial<Record<LanguageCode, string[]>>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
  created_at: string;
}

export interface IndexedExercise extends Exercise {
  searchIndex: string;
}
