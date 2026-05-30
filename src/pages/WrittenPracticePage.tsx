import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Lightbulb, ChevronDown, RotateCcw, AlertCircle } from "lucide-react";
import { InterviewConfig, DOMAIN_LABELS, DIFFICULTY_LABELS } from "@/types/interview";
import { generateQuestions, type GeneratedQuestion } from "@/lib/aiClient";
import { ThemeToggle } from "@/components/ThemeToggle";

type Q = GeneratedQuestion;

const WrittenPracticePage = () => {
  const navigate = useNavigate();
  const config = (useLocation().state as { config: InterviewConfig } | null)?.config;
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError(null);

    const topic = config.source === "skill" ? (config.skill || "Skill")
      : config.source === "jd" ? "Job Description"
      : config.source === "resume" ? "Resume-based"
      : (config.domain === "custom" ? (config.customDomain || "Custom") : DOMAIN_LABELS[config.domain]);

    try {
      const qs = await generateQuestions({
        topic,
        difficulty: DIFFICULTY_LABELS[config.difficulty],
        count: config.questionCount,
        resumeText: config.resumeText,
        jdText: config.jdText,
        skill: config.skill,
        source: config.source,
        provider: config.provider,
      });
      setQuestions(qs);
    } catch (e: any) {
      setError(e.message || "Failed to generate questions.");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (!config) { navigate("/setup"); return; }
    fetchQuestions();
  }, [config, navigate, fetchQuestions]);

  if (!config) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <Button variant="ghost" className="mb-6 text-muted-foreground" onClick={() => navigate("/setup")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">Practice Questions</h1>
        <p className="text-muted-foreground mb-8">{DIFFICULTY_LABELS[config.difficulty]} · {questions.length || config.questionCount} questions</p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <p>Generating questions…</p>
            <p className="text-xs mt-1">This may take a few seconds</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="font-medium mb-1">Failed to generate questions</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">{error}</p>
            <div className="flex gap-3">
              <Button onClick={fetchQuestions} className="rounded-xl">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate("/setup")}>
                Back to Setup
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => {
              const open = openIdx === i;
              return (
                <Card key={i} className="overflow-hidden">
                  <button onClick={() => setOpenIdx(open ? null : i)} className="w-full text-left p-5 flex items-start gap-3 hover:bg-muted/40 transition">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="flex-1 font-medium text-sm">{q.question}</p>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <CardContent className="border-t border-border bg-muted/20 pt-4 space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Model Answer</p>
                        <p className="text-sm whitespace-pre-wrap">{q.model_answer}</p>
                      </div>
                      {q.tips && (
                        <div className="flex gap-2 items-start text-sm text-muted-foreground">
                          <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                          <span>{q.tips}</span>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WrittenPracticePage;