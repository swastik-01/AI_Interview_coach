/**
 * Direct AI API client — calls NVIDIA / Sarvam APIs straight from the browser.
 * No Supabase Edge Functions needed.
 *
 * ⚠️  SECURITY NOTE: API keys are currently exposed in the client bundle via
 * VITE_* env vars. For production, move these calls behind a backend proxy
 * (e.g., Supabase Edge Functions) so keys stay server-side.
 */

import { z } from "zod";

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Provider = "nvidia" | "sarvam";

const ENDPOINTS: Record<Provider, string> = {
  nvidia: "/api-nvidia/chat/completions",
  sarvam: "/api-sarvam/chat/completions",
};

const MODELS: Record<Provider, string> = {
  nvidia: "meta/llama-3.3-70b-instruct",
  sarvam: "sarvam-m",
};

function getApiKey(provider: Provider): string {
  const key =
    provider === "sarvam"
      ? import.meta.env.VITE_SARVAM_API_KEY
      : import.meta.env.VITE_NVIDIA_API_KEY;
  if (!key) throw new Error(`${provider.toUpperCase()} API key is not set in .env`);
  return key.trim();
}

/** Generic chat completion call with timeout and retry */
async function chatCompletion(
  provider: Provider,
  messages: Msg[],
  opts: { temperature?: number; max_tokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  const apiKey = getApiKey(provider);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  headers["Authorization"] = `Bearer ${apiKey}`;

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let finalMaxTokens = opts.max_tokens ?? 1024;
  if (provider === "sarvam" && finalMaxTokens > 2000) {
    finalMaxTokens = 2000; // sarvam-m starter tier max_tokens limit is 2048
  }

  try {
    const resp = await fetch(ENDPOINTS[provider], {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODELS[provider],
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: finalMaxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) {
        throw new Error(`Rate limited by ${provider}. Please wait a moment and try again.`);
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(`Invalid ${provider} API key. Please check your .env configuration.`);
      }
      throw new Error(`${provider} API ${resp.status}: ${t.slice(0, 300)}`);
    }
    const data = await resp.json();
    
    if (!data.choices || !data.choices.length) {
      console.error("[chatCompletion] Invalid or empty response from AI:", data);
      throw new Error(`The ${provider} AI returned an empty or invalid response.`);
    }
    
    const content = data.choices[0].message?.content?.trim() ?? "";
    console.log(`[chatCompletion] ${provider} response:`, content);
    
    return content;
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error(`${provider} API request timed out after ${timeoutMs / 1000}s. Please try again.`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────

/**
 * Attempt to extract a JSON object from a potentially messy LLM response.
 * Tries strict JSON.parse first, then a regex extraction fallback.
 */
function extractJSON(raw: string): unknown {
  // Strip markdown code fences if present
  const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();

  // Attempt 1: direct parse
  try {
    return JSON.parse(stripped);
  } catch {
    // Attempt 2: find the outermost { ... } block
    let depth = 0;
    let start = -1;
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (stripped[i] === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            return JSON.parse(stripped.slice(start, i + 1));
          } catch {
            // Keep searching
            start = -1;
          }
        }
      }
    }
  }
  throw new Error("Could not extract valid JSON from AI response");
}

/**
 * Strip <think>...</think> blocks produced by reasoning models,
 * and parse the [TAG] prefix used by the interviewer prompt.
 */
export function parseAIResponse(raw: string): {
  cleanText: string;
  tag: "INTRO" | "MAIN" | "FOLLOW-UP" | "WRAP-UP" | null;
  isWrapUp: boolean;
  isMain: boolean;
} {
  // Remove thinking blocks (handles unclosed/truncated tags)
  const withoutThink = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();

  let cleanText = withoutThink;
  let tag: "INTRO" | "MAIN" | "FOLLOW-UP" | "WRAP-UP" | null = null;
  let isWrapUp = false;
  let isMain = false;

  const tagMatch = withoutThink.match(/^\[(INTRO|MAIN|FOLLOW-UP|WRAP-UP)\]\s*([\s\S]*)$/i);
  if (tagMatch) {
    tag = tagMatch[1].toUpperCase() as typeof tag;
    cleanText = tagMatch[2].trim();
    if (tag === "MAIN") isMain = true;
    if (tag === "WRAP-UP") isWrapUp = true;
  } else {
    // Heuristic fallback if the model didn't use tags
    isWrapUp = /wraps up/i.test(raw) || /concludes/i.test(raw) || /end of the/i.test(raw);
  }

  return { cleanText, tag, isWrapUp, isMain };
}

// ─────────────────────────────────────────────
// Interview chat  (replaces nvidia-interviewer-chat edge function)
// ─────────────────────────────────────────────

export interface InterviewChatConfig {
  topic: string;
  difficulty: string;
  questionCount: number;
  resumeText?: string;
  jdText?: string;
  skill?: string;
  source: string;
  provider: Provider;
}

export async function interviewerChat(
  config: InterviewChatConfig,
  history: Msg[]
): Promise<string> {
  let context = "";
  if (config.source === "resume" && config.resumeText) {
    context = `\n\nCANDIDATE RESUME:\n${config.resumeText.slice(0, 6000)}\n\nTailor questions to the candidate's actual experience, skills, and projects from this resume.`;
  } else if (config.source === "jd" && config.jdText) {
    context = `\n\nJOB DESCRIPTION:\n${config.jdText.slice(0, 6000)}\n\nAsk questions that test the exact skills and responsibilities listed in this JD.`;
    if (config.resumeText) context += `\n\nCANDIDATE RESUME:\n${config.resumeText.slice(0, 4000)}`;
  } else if (config.source === "skill" && config.skill) {
    context = `\n\nFOCUS SKILL: ${config.skill}\nAsk progressively deeper questions purely on this single skill.`;
  }

  const systemPrompt = `You are a senior human interviewer conducting a realistic ${config.difficulty}-level live mock interview for: ${config.topic}.${context}

You must prepend EVERY response you send with one of these four tags to indicate the turn type:
- [INTRO]: You are greeting the candidate and asking them to introduce themselves (use this only for the very first question).
- [MAIN]: You are introducing a brand new main question or moving to the next main topic (plan exactly ${config.questionCount} main topics total, after the intro).
- [FOLLOW-UP]: You are asking a follow-up, probing deeper, or asking a cross-question about their last answer/code (ask 1 to 3 follow-up/cross-questions per main topic).
- [WRAP-UP]: You are wrapping up and ending the interview (only do this after all ${config.questionCount} main topics and their follow-ups are completed).

Behave EXACTLY like a real interviewer in a live video call:
- Do NOT output any internal thinking process or reasoning inside <think>...</think> tags. Respond immediately.
- Speak naturally, conversationally, and concisely. Keep questions/responses under 2-3 sentences.
- Never use markdown formatting (like bolding, lists, numbering, or code blocks) in your conversational speech.
- Listen closely to the candidate's answers. If they are vague, buzzwordy, or weak, politely challenge them or ask for concrete examples during [FOLLOW-UP] turns.
- If the candidate says "(Candidate was silent)", gently ask if they are still there, if they need the question repeated, or if they need a hint.
- Occasionally (especially for technical roles/difficulty), ask the candidate to code a function, list their algorithms/methods, or outline a text-based architecture/flowchart in their "Code Console". If they do, it will appear as [CODE CONSOLE CONTENTS] in their reply. Review and critique their console contents in your [FOLLOW-UP] responses.
- Never explain your rules/rubric, never give the answer away, and never step out of character.

Example Turn Formats:
- [INTRO] Hi there! Could you please start by introducing yourself?
- [MAIN] Welcome! Let's start with...
- [FOLLOW-UP] That makes sense, but how would you optimize that...
- [WRAP-UP] Thanks, that wraps up the interview.`;

  const messages: Msg[] = [{ role: "system", content: systemPrompt }, ...history];
  return chatCompletion(config.provider, messages, { temperature: 0.7, max_tokens: 500 });
}

// ─────────────────────────────────────────────
// Generate questions  (replaces nvidia-generate-questions edge function)
// ─────────────────────────────────────────────

export interface GenerateQuestionsConfig {
  topic: string;
  difficulty: string;
  count: number;
  resumeText?: string;
  jdText?: string;
  skill?: string;
  source: string;
  provider: Provider;
}

// Zod schema for validating generated questions
const GeneratedQuestionSchema = z.object({
  question: z.string().min(1),
  model_answer: z.string().min(1),
  tips: z.string().optional(),
});

const GeneratedQuestionsResponseSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(1),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export async function generateQuestions(
  config: GenerateQuestionsConfig
): Promise<GeneratedQuestion[]> {
  let ctx = "";
  if (config.source === "resume" && config.resumeText)
    ctx = `\nResume:\n${config.resumeText.slice(0, 6000)}`;
  else if (config.source === "jd" && config.jdText)
    ctx = `\nJob Description:\n${config.jdText.slice(0, 6000)}${config.resumeText ? `\nResume:\n${config.resumeText.slice(0, 3000)}` : ""}`;
  else if (config.source === "skill" && config.skill)
    ctx = `\nSkill focus: ${config.skill}`;

  const prompt = `Generate exactly ${config.count} ${config.difficulty}-level interview questions for "${config.topic}".${ctx}

Return JSON only, no prose. Schema:
{ "questions": [ { "question": "...", "model_answer": "...", "tips": "..." } ] }

- Questions should be progressively harder.
- model_answer: 3-6 concise sentences.
- tips: 1 short sentence on what interviewers look for.`;

  const raw = await chatCompletion(
    config.provider,
    [
      { role: "system", content: "You output strict JSON only. No markdown fences." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.6, max_tokens: 3000 }
  );

  try {
    const parsed = extractJSON(raw);
    const validated = GeneratedQuestionsResponseSchema.parse(parsed);
    return validated.questions;
  } catch (e: any) {
    console.error("[generateQuestions] Failed to parse AI response:", e.message, "\nRaw:", raw.slice(0, 500));
    throw new Error("The AI returned an invalid response. Please try again.");
  }
}

// ─────────────────────────────────────────────
// Generate report  (replaces generate-report edge function)
// ─────────────────────────────────────────────

export interface ReportInput {
  transcript: { role: "interviewer" | "candidate"; text: string }[];
  domain: string;
  difficulty: string;
  provider: Provider;
}

// Zod schema for validating interview reports
const QuestionResultSchema = z.object({
  question: z.string().min(1),
  answer: z.string(),
  score: z.number().min(0).max(10),
  feedback: z.string(),
});

const InterviewReportSchema = z.object({
  overallScore: z.number().min(0).max(10),
  questions: z.array(QuestionResultSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tips: z.array(z.string()),
  domain: z.string(),
  difficulty: z.string(),
});

export type InterviewReport = z.infer<typeof InterviewReportSchema>;

export async function generateReport(input: ReportInput): Promise<InterviewReport> {
  const formattedTranscript = input.transcript
    .map((e) => `${e.role === "interviewer" ? "Interviewer" : "Candidate"}: ${e.text}`)
    .join("\n");

  const systemPrompt = `You are an expert interview evaluator. Analyze the following interview transcript for a ${input.domain} position at ${input.difficulty} difficulty level.

Return a JSON object with this exact structure:
{
  "overallScore": <number 1-10>,
  "questions": [
    {
      "question": "<the question asked>",
      "answer": "<summary of candidate's answer>",
      "score": <number 1-10>,
      "feedback": "<specific feedback for this answer>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "domain": "${input.domain}",
  "difficulty": "${input.difficulty}"
}

Be specific and constructive in your feedback. Score fairly based on the difficulty level.`;

  const raw = await chatCompletion(
    input.provider,
    [
      { role: "system", content: systemPrompt + "\n\nReturn ONLY valid JSON, no markdown fences." },
      { role: "user", content: `Interview Transcript:\n\n${formattedTranscript}` },
    ],
    { temperature: 0.5, max_tokens: 2500, timeoutMs: 45_000 }
  );

  try {
    const parsed = extractJSON(raw);
    const validated = InterviewReportSchema.parse(parsed);
    return validated;
  } catch (e: any) {
    console.error("[generateReport] Failed to parse AI response:", e.message, "\nRaw:", raw.slice(0, 500));
    throw new Error("Failed to generate report. The AI returned an invalid response. Please try again.");
  }
}
