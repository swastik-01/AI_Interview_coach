import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, domain, difficulty, provider: rawProvider } = await req.json();
    const provider = rawProvider ?? "nvidia";

    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
    const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");

    if (provider === "nvidia" && !NVIDIA_API_KEY) throw new Error("Missing NVIDIA_API_KEY");
    if (provider === "sarvam" && !SARVAM_API_KEY) throw new Error("Missing SARVAM_API_KEY");

    // Format transcript for the prompt
    const formattedTranscript = transcript
      .map((entry: any) => `${entry.role === "interviewer" ? "Interviewer" : "Candidate"}: ${entry.text}`)
      .join("\n");

    const systemPrompt = `You are an expert interview evaluator. Analyze the following interview transcript for a ${domain} position at ${difficulty} difficulty level.

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
  "domain": "${domain}",
  "difficulty": "${difficulty}"
}

Be specific and constructive in your feedback. Score fairly based on the difficulty level.`;

    const endpoint = provider === "sarvam"
      ? "https://api.sarvam.ai/v1/chat/completions"
      : "https://integrate.api.nvidia.com/v1/chat/completions";
    const model = provider === "sarvam" ? "sarvam-m" : "meta/llama-3.3-70b-instruct";
    const apiKey = provider === "sarvam" ? SARVAM_API_KEY! : NVIDIA_API_KEY!;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt + "\n\nReturn ONLY valid JSON, no markdown fences." },
          { role: "user", content: `Interview Transcript:\n\n${formattedTranscript}` },
        ],
        temperature: 0.5,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} API error: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    let raw: string = result.choices[0].message.content ?? "{}";
    raw = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let reportContent: unknown;
    try { reportContent = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      reportContent = m ? JSON.parse(m[0]) : {};
    }

    return new Response(JSON.stringify(reportContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
