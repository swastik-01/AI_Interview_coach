import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InterviewConfig, TranscriptEntry, DOMAIN_LABELS, DIFFICULTY_LABELS } from "@/types/interview";
import { generateReport, type InterviewReport } from "@/lib/aiClient";
import { ArrowLeft, RotateCcw, CheckCircle2, AlertCircle, Lightbulb, Loader2, Download } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";

const ReportPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { transcript: TranscriptEntry[]; config: InterviewConfig } | null;

  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const doGenerateReport = async () => {
    if (!state) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateReport({
        transcript: state.transcript,
        domain: state.config.domain === "custom" ? (state.config.customDomain || "Custom") : DOMAIN_LABELS[state.config.domain],
        difficulty: DIFFICULTY_LABELS[state.config.difficulty],
        provider: state.config.provider,
      });
      setReport(result);
    } catch (err: any) {
      console.error("Report generation failed:", err);
      setError(err.message || "An unexpected error occurred while generating the report.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!state) {
      navigate("/setup");
      return;
    }
    doGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, navigate]);

  const handleRetry = () => {
    setRetrying(true);
    doGenerateReport();
  };

  const handleExportTranscript = () => {
    if (!state) return;
    const lines = state.transcript.map(
      (t) => `[${t.role === "interviewer" ? "Interviewer" : "You"}] ${t.text}`
    );
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!state) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            {retrying ? "Retrying report generation..." : "Generating your interview report..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">This may take up to 30 seconds</p>
        </div>
      </div>
    );
  }

  // Error state — show retry UI instead of fake data
  if (error && !report) {
    return (
      <div className="min-h-screen bg-background">
        <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
        <div className="container mx-auto px-6 py-12 max-w-2xl">
          <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Home
          </Button>

          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold font-display mb-2">Report Generation Failed</h1>
            <p className="text-muted-foreground mb-2 max-w-md mx-auto">{error}</p>
            <p className="text-xs text-muted-foreground mb-8">Your transcript is preserved — you can retry without losing your interview data.</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleRetry} disabled={retrying} className="rounded-xl">
                {retrying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Retry Report
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={handleExportTranscript}>
                <Download className="w-4 h-4 mr-2" />
                Download Transcript
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate("/setup")}>
                New Interview
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const scoreColor =
    report.overallScore >= 8
      ? "text-success"
      : report.overallScore >= 6
      ? "text-warning"
      : "text-destructive";

  const scoreLabel =
    report.overallScore >= 8
      ? "Excellent"
      : report.overallScore >= 6
      ? "Good"
      : report.overallScore >= 4
      ? "Needs Improvement"
      : "Poor";

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Home
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">Interview Report</h1>
            <p className="text-muted-foreground">
              {report.domain} · {report.difficulty}
            </p>
          </div>

          {/* Overall Score */}
          <Card className="mb-8 text-center">
            <CardContent className="pt-8 pb-8">
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-medium">Overall Score</p>
              <p className={`text-6xl font-bold font-display ${scoreColor}`}>
                {report.overallScore}
                <span className="text-2xl text-muted-foreground">/10</span>
              </p>
              <p className={`text-sm font-medium mt-1 ${scoreColor}`}>{scoreLabel}</p>
              <Progress value={report.overallScore * 10} className="mt-4 max-w-xs mx-auto h-2" />
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {report.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific strengths identified.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  Areas to Improve
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.weaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {report.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific areas identified.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Question Breakdown */}
          {report.questions.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Question Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {report.questions.map((q, i) => {
                  const qScoreColor = q.score >= 8 ? "text-success" : q.score >= 6 ? "text-warning" : "text-destructive";
                  const qScoreLabel = q.score >= 8 ? "Excellent" : q.score >= 6 ? "Good" : q.score >= 4 ? "Needs Work" : "Poor";
                  return (
                    <div key={i} className="border-b border-border last:border-0 pb-5 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm flex-1 pr-4">
                          <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                          {q.question}
                        </p>
                        <span className={`text-sm font-bold shrink-0 ${qScoreColor}`} title={qScoreLabel}>
                          {q.score}/10
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">Your answer:</span> {q.answer}
                      </p>
                      <p className="text-sm text-muted-foreground italic">{q.feedback}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          {report.tips.length > 0 && (
            <Card className="mb-12">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Improvement Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
              onClick={handleExportTranscript}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Transcript
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
              onClick={() => navigate("/setup")}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              New Interview
            </Button>
            <Button
              size="lg"
              className="h-12 rounded-xl bg-primary hover:bg-primary/90"
              onClick={() => navigate("/setup", { state: { config: state.config } })}
            >
              Retry Same Settings
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReportPage;
