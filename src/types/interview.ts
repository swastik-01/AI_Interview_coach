export type Domain =
  | "software-engineering"
  | "data-science"
  | "cloud-infrastructure"
  | "product-management"
  | "custom";

export type DifficultyLevel =
  | "beginner"
  | "elementary"
  | "intermediate"
  | "advanced"
  | "expert";

export type InterviewMode = "voice" | "written";
export type InterviewSource = "domain" | "resume" | "jd" | "skill";
export type LLMProvider = "nvidia" | "sarvam";

export interface InterviewConfig {
  domain: Domain;
  customDomain?: string;
  difficulty: DifficultyLevel;
  questionCount: number;
  mode: InterviewMode;
  source: InterviewSource;
  provider: LLMProvider;
  resumeText?: string;
  jdText?: string;
  skill?: string;
}

export interface TranscriptEntry {
  role: "interviewer" | "candidate";
  text: string;
  timestamp: number;
}

export interface QuestionResult {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

// InterviewReport is defined via Zod validation in @/lib/aiClient.ts
// Re-export it here for backward compatibility
export type { InterviewReport } from "@/lib/aiClient";


export const DOMAIN_LABELS: Record<Domain, string> = {
  "software-engineering": "Software Engineering",
  "data-science": "Data Science & Analytics",
  "cloud-infrastructure": "Cloud & Infrastructure",
  "product-management": "Product Management",
  custom: "Custom Domain",
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  beginner: "Fundamental concepts & definitions",
  elementary: "Applied basics & simple problems",
  intermediate: "Multi-step reasoning & real-world scenarios",
  advanced: "Complex problems & trade-off analysis",
  expert: "Architecture decisions & edge cases",
};
