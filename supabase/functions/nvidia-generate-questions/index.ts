import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { topic, difficulty, count, resumeText, jdText, skill, source, provider: rawProvider } = await req.json();
    const provider = rawProvider ?? "nvidia";

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

    let ctx = "";
    if (source === "resume" && resumeText) ctx = `\nResume:\n${String(resumeText).slice(0, 6000)}`;
    else if (source === "jd" && jdText) ctx = `\nJob Description:\n${String(jdText).slice(0, 6000)}${resumeText ? `\nResume:\n${String(resumeText).slice(0, 3000)}` : ""}`;
    else if (source === "skill" && skill) ctx = `\nSkill focus: ${skill}`;

    const prompt = `Generate exactly ${count} ${difficulty}-level interview questions for "${topic}".${ctx}

Return JSON only, no prose. Schema:
{ "questions": [ { "question": "...", "model_answer": "...", "tips": "..." } ] }

- Questions should be progressively harder.
- model_answer: 3-6 concise sentences.
- tips: 1 short sentence on what interviewers look for.`;

    const endpoint = provider === "sarvam"
      ? "https://api.sarvam.ai/v1/chat/completions"
      : "https://integrate.api.nvidia.com/v1/chat/completions";
    const model = provider === "sarvam" ? "sarvam-m" : "meta/llama-3.3-70b-instruct";
    const apiKey = provider === "sarvam" ? SARVAM_API_KEY! : NVIDIA_API_KEY!;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You output strict JSON only. No markdown fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 3000,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `${provider} ${resp.status}: ${t.slice(0,300)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    let raw = data.choices?.[0]?.message?.content ?? "{}";
    raw = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { questions: [] };
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});