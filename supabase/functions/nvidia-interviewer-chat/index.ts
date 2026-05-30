import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Msg { role: "system" | "user" | "assistant"; content: string }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { config, history } = await req.json() as {
      config: {
        topic: string;
        difficulty: string;
        questionCount: number;
        resumeText?: string;
        jdText?: string;
        skill?: string;
        source: string;
        provider?: "nvidia" | "sarvam";
      };
      history: Msg[];
    };

    const provider = config.provider ?? "nvidia";
    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
    const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");
    if (provider === "nvidia" && !NVIDIA_API_KEY) {
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (provider === "sarvam" && !SARVAM_API_KEY) {
      return new Response(JSON.stringify({ error: "SARVAM_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

Behave EXACTLY like a real interviewer in a Zoom call:
- Speak naturally and conversationally. No preambles, no lists, no numbering, no "Question 1:".
- Ask ONE question per turn. Keep it 1–3 sentences, spoken-style.
- LISTEN carefully to the candidate's last answer. Decide whether to:
   (a) ask a CROSS-QUESTION / FOLLOW-UP that drills deeper into what they just said (probe vague claims, ask "why", ask for an example, challenge a trade-off), OR
   (b) move to the next main topic.
- Roughly 40–60% of your turns should be follow-ups / cross-questions, not new topics. Real interviewers dig in.
- If the answer is vague, wrong, or buzzwordy — politely push back and ask them to clarify or give a concrete example.
- If the answer is strong — briefly acknowledge ("Got it." / "Makes sense.") in <=5 words, then ask the next probing or new question.
- Never reveal you're an AI. Never explain the rubric. Never give the answer.
- Plan ~${config.questionCount} MAIN topics total (follow-ups don't count). After the candidate has answered the last main topic and any follow-ups feel resolved, end with exactly: "Thanks, that wraps up the interview."`;

    const messages: Msg[] = [{ role: "system", content: systemPrompt }, ...history];

    const endpoint = provider === "sarvam"
      ? "https://api.sarvam.ai/v1/chat/completions"
      : "https://integrate.api.nvidia.com/v1/chat/completions";
    const model = provider === "sarvam" ? "sarvam-m" : "meta/llama-3.3-70b-instruct";
    const apiKey = provider === "sarvam" ? SARVAM_API_KEY! : NVIDIA_API_KEY!;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.75,
        max_tokens: 400,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error(`${provider} error:`, resp.status, t);
      return new Response(JSON.stringify({ error: `${provider} API ${resp.status}: ${t.slice(0, 300)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message ?? "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});