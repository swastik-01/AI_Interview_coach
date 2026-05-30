import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Domain,
  DifficultyLevel,
  DOMAIN_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_DESCRIPTIONS,
  InterviewConfig,
  InterviewMode,
  InterviewSource,
  LLMProvider,
} from "@/types/interview";
import { Code2, Database, Cloud, Briefcase, PenLine, ArrowLeft, Upload, FileText, Loader2, Mic, ListChecks, Cpu, Languages } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { parseFileToText } from "@/lib/parseDocument";
import { useToast } from "@/hooks/use-toast";

const DOMAIN_ICONS: Record<Domain, React.ReactNode> = {
  "software-engineering": <Code2 className="w-5 h-5" />,
  "data-science": <Database className="w-5 h-5" />,
  "cloud-infrastructure": <Cloud className="w-5 h-5" />,
  "product-management": <Briefcase className="w-5 h-5" />,
  custom: <PenLine className="w-5 h-5" />,
};

const QUESTION_COUNTS = [5, 10, 15];

const SetupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [source, setSource] = useState<InterviewSource>("domain");
  const [domain, setDomain] = useState<Domain>("software-engineering");
  const [customDomain, setCustomDomain] = useState("");
  const [skill, setSkill] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [provider, setProvider] = useState<LLMProvider>("nvidia");
  const [parsing, setParsing] = useState<"resume" | "jd" | null>(null);

  const resumeRef = useRef<HTMLInputElement>(null);
  const jdRef = useRef<HTMLInputElement>(null);

  const handleFile = async (kind: "resume" | "jd", file: File | null) => {
    if (!file) return;
    setParsing(kind);
    try {
      const text = await parseFileToText(file);
      if (kind === "resume") setResumeText(text);
      else setJdText(text);
      toast({ title: "Parsed", description: `${file.name} (${text.length} chars)` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Parse failed", description: e.message });
    } finally {
      setParsing(null);
    }
  };

  const isValid = (() => {
    if (source === "domain") return domain !== "custom" || customDomain.trim().length > 0;
    if (source === "resume") return resumeText.trim().length > 50;
    if (source === "jd") return jdText.trim().length > 50;
    if (source === "skill") return skill.trim().length > 1;
    return false;
  })();

  const handleStart = () => {
    const config: InterviewConfig = {
      domain,
      customDomain: domain === "custom" ? customDomain : undefined,
      difficulty,
      questionCount,
      mode,
      source,
      provider,
      resumeText: resumeText || undefined,
      jdText: jdText || undefined,
      skill: source === "skill" ? skill : undefined,
    };
    navigate(mode === "voice" ? "/interview" : "/practice", { state: { config } });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">Set Up Your Interview</h1>
          <p className="text-muted-foreground mb-8">
            Choose how you want to be interviewed — by domain, your resume, a job description, or a single skill.
          </p>

          {/* Source Tabs */}
          <Tabs value={source} onValueChange={(v) => setSource(v as InterviewSource)} className="mb-8">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="domain">Domain</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="jd">Job Description</TabsTrigger>
              <TabsTrigger value="skill">Single Skill</TabsTrigger>
            </TabsList>

            <TabsContent value="domain" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.keys(DOMAIN_LABELS) as Domain[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDomain(d)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                      domain === d ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      domain === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{DOMAIN_ICONS[d]}</div>
                    <span className="font-medium text-sm">{DOMAIN_LABELS[d]}</span>
                  </button>
                ))}
              </div>
              {domain === "custom" && (
                <Input className="mt-4" placeholder="e.g., Machine Learning, DevOps" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} />
              )}
            </TabsContent>

            <TabsContent value="resume" className="mt-6 space-y-4">
              <FileDrop label="Upload resume (PDF, DOCX, TXT)" parsing={parsing === "resume"} onPick={() => resumeRef.current?.click()} />
              <input ref={resumeRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFile("resume", e.target.files?.[0] ?? null)} />
              <Textarea placeholder="…or paste your resume text here" rows={8} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
              {resumeText && <p className="text-xs text-muted-foreground">{resumeText.length} characters loaded</p>}
            </TabsContent>

            <TabsContent value="jd" className="mt-6 space-y-4">
              <FileDrop label="Upload job description (PDF, DOCX, TXT)" parsing={parsing === "jd"} onPick={() => jdRef.current?.click()} />
              <input ref={jdRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFile("jd", e.target.files?.[0] ?? null)} />
              <Textarea placeholder="…or paste the job description here" rows={8} value={jdText} onChange={(e) => setJdText(e.target.value)} />
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Optional: also paste your resume for tailored questions</summary>
                <Textarea className="mt-3" placeholder="Paste resume (optional)" rows={6} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
              </details>
            </TabsContent>

            <TabsContent value="skill" className="mt-6">
              <Label className="text-sm mb-2 block">Skill</Label>
              <Input placeholder="e.g., React Hooks, SQL Joins, System Design Caching" value={skill} onChange={(e) => setSkill(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-2">We'll generate progressively harder questions on this single skill.</p>
            </TabsContent>
          </Tabs>

          {/* Mode */}
          <div className="mb-8">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              <ModeCard active={mode === "voice"} onClick={() => setMode("voice")} icon={<Mic className="w-4 h-4" />} title="Voice Interview" desc="Speak with the AI interviewer." />
              <ModeCard active={mode === "written"} onClick={() => setMode("written")} icon={<ListChecks className="w-4 h-4" />} title="Written Practice" desc="See questions + model answers." />
            </div>
          </div>

          {/* AI Provider */}
          <div className="mb-8">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">AI Interviewer Model</Label>
            <div className="grid grid-cols-2 gap-3">
              <ModeCard active={provider === "nvidia"} onClick={() => setProvider("nvidia")} icon={<Cpu className="w-4 h-4" />} title="NVIDIA Llama 3.3 70B" desc="Strong English reasoning, fast." />
              <ModeCard active={provider === "sarvam"} onClick={() => setProvider("sarvam")} icon={<Languages className="w-4 h-4" />} title="Sarvam M (Indic)" desc="Best for Hindi & Indian languages." />
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-8">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Difficulty</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((d, i) => (
                <button key={d} onClick={() => setDifficulty(d)} className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                  difficulty === d ? "border-primary bg-primary/5 font-semibold" : "border-border bg-card hover:border-primary/30"
                }`}>
                  <span className="text-xs text-muted-foreground mr-1">{i + 1}.</span>
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{DIFFICULTY_DESCRIPTIONS[difficulty]}</p>
          </div>

          {/* Question Count */}
          <div className="mb-10">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Number of Questions</Label>
            <div className="flex gap-3">
              {QUESTION_COUNTS.map((c) => (
                <button key={c} onClick={() => setQuestionCount(c)} className={`w-16 h-12 rounded-xl border text-sm font-semibold transition-all ${
                  questionCount === c ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                }`}>{c}</button>
              ))}
            </div>
          </div>

          <Button size="lg" className="h-14 px-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg w-full sm:w-auto" disabled={!isValid} onClick={handleStart}>
            {mode === "voice" ? "Begin Interview" : "Generate Practice Set"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

function FileDrop({ label, parsing, onPick }: { label: string; parsing: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-6 flex flex-col items-center gap-2 text-sm text-muted-foreground transition-colors">
      {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
      <span className="font-medium text-foreground">{parsing ? "Parsing…" : label}</span>
      <span className="text-xs">Click to choose a file</span>
    </button>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-xl border text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
      <div className="flex items-center gap-2 mb-1 font-medium text-sm">{icon}{title}</div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

export default SetupPage;