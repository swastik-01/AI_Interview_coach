import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import InterviewAvatar from "@/components/InterviewAvatar";
import CodeConsole from "@/components/CodeConsole";
import { InterviewConfig, TranscriptEntry, DOMAIN_LABELS, DIFFICULTY_LABELS } from "@/types/interview";
import { interviewerChat, parseAIResponse } from "@/lib/aiClient";
import { Mic, MicOff, PhoneOff, Code2, Loader2, Pause, Play, Clock, SkipForward } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

type AvatarState = "idle" | "speaking" | "listening" | "thinking";
type Msg = { role: "system" | "user" | "assistant"; content: string };

// Web Speech API typings
const SR: any =
  (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

// ─── Session Storage helpers ───────────────────────────────────
const SESSION_KEY = "interview-session";

interface InterviewSession {
  config: InterviewConfig;
  transcript: TranscriptEntry[];
  history: Msg[];
  questionIndex: number;
  code: string;
  startedAt: number;
}

function saveSession(session: InterviewSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded — silently ignore
  }
}

function loadSession(): InterviewSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Timer hook ────────────────────────────────────────────────
function useElapsedTime(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────
const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Restore from sessionStorage or location.state
  const savedSession = loadSession();
  const configFromNav = (location.state as { config: InterviewConfig } | null)?.config;
  const config = configFromNav || savedSession?.config;

  const [transcript, setTranscript] = useState<TranscriptEntry[]>(savedSession?.transcript ?? []);
  const [history, setHistory] = useState<Msg[]>(savedSession?.history ?? []);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [showCodeConsole, setShowCodeConsole] = useState(false);
  const [code, setCode] = useState(savedSession?.code ?? "");
  const [questionIndex, setQuestionIndex] = useState(savedSession?.questionIndex ?? 0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [started, setStarted] = useState(!!savedSession?.transcript.length);
  const [isMuted, setIsMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(savedSession?.startedAt ?? null);
  const [sttUnsupported, setSttUnsupported] = useState(!SR);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);
  const finalRef = useRef<string>("");
  const silenceTimerRef = useRef<number | null>(null);
  const noSoundTimerRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const mountedRef = useRef(true);
  const sttRestartCountRef = useRef(0);
  const SILENCE_MS = 15000; // 15 seconds of silence after speaking triggers auto-submit
  const MAX_STT_RESTARTS = 5;

  // ─── Redirect if no config ─────────────────────────────────
  useEffect(() => {
    if (!config) navigate("/setup");
  }, [config, navigate]);

  // ─── Track mount/unmount for cleanup ────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cleanup on unmount
      shouldListenRef.current = false;
      clearSilence();
      if (noSoundTimerRef.current) clearTimeout(noSoundTimerRef.current);
      try { recogRef.current?.stop(); } catch { /* ignore */ }
      window.speechSynthesis?.cancel();
      // Reset voices handler
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // ─── Persist state to sessionStorage ────────────────────────
  useEffect(() => {
    if (config && started) {
      saveSession({
        config,
        transcript,
        history,
        questionIndex,
        code,
        startedAt: startedAt ?? Date.now(),
      });
    }
  }, [config, started, transcript, history, questionIndex, code, startedAt]);

  // ─── Auto-scroll transcript ─────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, interim]);

  // ─── Load voices ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const updateVoices = () => {
        const list = window.speechSynthesis.getVoices();
        setVoices(list);

        // Auto-select default voice
        if (list.length > 0 && !selectedVoiceName) {
          const isSarvam = config?.provider === "sarvam";
          let defaultVoice: SpeechSynthesisVoice | undefined;
          
          if (isSarvam) {
            defaultVoice = list.find(v => /en-IN/i.test(v.lang)) || list.find(v => /hi-IN/i.test(v.lang));
          }
          
          if (!defaultVoice) {
            defaultVoice = list.find(v => /en-(US|GB)/i.test(v.lang) && /female|samantha|google|zira|hazel/i.test(v.name))
              || list.find(v => /en/i.test(v.lang));
          }
          
          if (defaultVoice) {
            setSelectedVoiceName(defaultVoice.name);
          }
        }
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, [config, selectedVoiceName]);

  // ─── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in code console or inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      if (e.key === "Enter" && !e.shiftKey && avatarState === "listening") {
        e.preventDefault();
        stopListeningAndSubmit();
      } else if (e.key === " " && !e.shiftKey) {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Escape") {
        e.preventDefault();
        endInterview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, avatarState]);

  // ─── Speak (TTS) ───────────────────────────────────────────
  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window) || !mountedRef.current) { resolve(); return; }
      
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1; u.volume = 1;

      // Store globally to prevent garbage collection bug
      (window as any)._interviewUtterance = u;

      const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const selected = currentVoices.find(v => v.name === selectedVoiceName);
      if (selected) {
        u.voice = selected;
      } else {
        const fallback = currentVoices.find(v => /en-(US|GB)/i.test(v.lang) && /female|samantha|google|zira|hazel/i.test(v.name)) 
          || currentVoices.find(v => /en/i.test(v.lang));
        if (fallback) u.voice = fallback;
      }
      
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        if (mountedRef.current) setAvatarState("idle");
        resolve();
      };

      u.onstart = () => { if (mountedRef.current) setAvatarState("speaking"); };
      u.onend = done;
      u.onerror = (e) => {
        console.warn("Speech synthesis error:", e);
        done();
      };

      // Safety timeout: in case speechSynthesis gets stuck (notorious Chrome bug on Windows)
      const safetyTimeout = window.setTimeout(done, Math.max(10000, text.length * 80));

      const doSpeak = () => {
        window.speechSynthesis.speak(u);

        // Chrome sometimes doesn't fire onend if utterance is too long — force resume
        const keepAlive = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(keepAlive);
          }
        }, 14000);

        // Cleanup interval when done
        const origDone = done;
        const wrappedDone = () => {
          clearInterval(keepAlive);
          clearTimeout(safetyTimeout);
          origDone();
        };
        u.onend = wrappedDone;
        u.onerror = wrappedDone;
      };

      // Workaround for Chrome bug where speak() right after cancel() fails
      setTimeout(doSpeak, 50);
    });
  }, [voices, selectedVoiceName]);

  // ─── Ask AI ─────────────────────────────────────────────────
  const askAI = useCallback(async (newHistory: Msg[]): Promise<string> => {
    if (!config) return "";
    const topic = config.source === "skill"
      ? (config.skill || "Skill Interview")
      : config.source === "jd" ? "Job Description Interview"
      : config.source === "resume" ? "Resume-based Interview"
      : (config.domain === "custom" ? (config.customDomain || "Custom") : DOMAIN_LABELS[config.domain]);

    return interviewerChat(
      {
        topic,
        difficulty: DIFFICULTY_LABELS[config.difficulty],
        questionCount: config.questionCount,
        resumeText: config.resumeText,
        jdText: config.jdText,
        skill: config.skill,
        source: config.source,
        provider: config.provider,
      },
      newHistory
    );
  }, [config]);

  // ─── Helpers ────────────────────────────────────────────────
  const clearSilence = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (noSoundTimerRef.current) {
      window.clearTimeout(noSoundTimerRef.current);
      noSoundTimerRef.current = null;
    }
  };

  const endInterview = useCallback(() => {
    shouldListenRef.current = false;
    clearSilence();
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    clearSession();
    navigate("/report", { state: { transcript, config } });
  }, [transcript, config, navigate]);

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    if (next) {
      shouldListenRef.current = false;
      clearSilence();
      try { recogRef.current?.stop(); } catch { /* ignore */ }
      window.speechSynthesis?.cancel();
    } else if (started && avatarState !== "speaking" && !busy) {
      startListening();
    }
  }, [paused, started, avatarState, busy]);

  // ─── Stop listening & submit answer ─────────────────────────
  const stopListeningAndSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    shouldListenRef.current = false;
    clearSilence();
    const r = recogRef.current;
    if (r) try { r.stop(); } catch { /* ignore */ }
    const answer = (finalRef.current + " " + interim).trim();
    finalRef.current = "";
    setInterim("");
    
    // If empty text and no code, let AI handle it by sending "(Candidate was silent)"
    const hasCode = !!code.trim();
    if (!answer && !hasCode && !shouldListenRef.current && avatarState === "idle") { 
       submittingRef.current = false; 
       return; 
    }

    const spokenText = answer || (hasCode ? "(Sent code from Code Console)" : "(Candidate was silent)");
    const candidateEntry: TranscriptEntry = { role: "candidate", text: spokenText, timestamp: Date.now() };
    setTranscript((p) => [...p, candidateEntry]);

    let userMessageContent = spokenText;
    if (code.trim()) {
      userMessageContent += `\n\n[CODE CONSOLE CONTENTS]:\n\`\`\`\n${code}\n\`\`\``;
    }

    const newHistory: Msg[] = [...history, { role: "user", content: userMessageContent }];
    setHistory(newHistory);

    setAvatarState("thinking");
    setBusy(true);
    try {
      const reply = await askAI(newHistory);
      if (!mountedRef.current) return;

      const { cleanText, isWrapUp, isMain } = parseAIResponse(reply);
      const finalReplyText = cleanText.trim() || "Let me think about that. Could you elaborate?";

      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      setTranscript((p) => [...p, { role: "interviewer", text: finalReplyText, timestamp: Date.now() }]);

      let nextQ = questionIndex;
      if (isMain) {
        nextQ = questionIndex + 1;
        setQuestionIndex(nextQ);
      }

      await speak(finalReplyText);

      // End interview if AI wraps up OR we hit a safety limit (questionCount * 3)
      if (isWrapUp || nextQ > config!.questionCount * 3) {
        endInterview();
      } else if (!paused && mountedRef.current) {
        startListening();
      }
    } catch (e: any) {
      if (mountedRef.current) {
        toast({ variant: "destructive", title: "Interviewer error", description: e.message });
        setAvatarState("idle");
      }
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }, [askAI, history, interim, speak, toast, paused, code, questionIndex, config, endInterview]);

  // ─── Start listening (STT) ─────────────────────────────────
  const startListening = useCallback(() => {
    if (paused || isMuted || sttUnsupported) return;
    shouldListenRef.current = true;

    if (!SR) {
      setSttUnsupported(true);
      toast({ variant: "destructive", title: "Speech recognition unavailable", description: "Please use Chrome or Edge." });
      return;
    }

    try { recogRef.current?.stop(); } catch { /* ignore */ }
    finalRef.current = "";
    setInterim("");
    sttRestartCountRef.current = 0;

    const r = new SR();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;

    r.onstart = () => {
      // If no speech is detected at all within 20 seconds, submit silence
      if (noSoundTimerRef.current) clearTimeout(noSoundTimerRef.current);
      noSoundTimerRef.current = window.setTimeout(() => {
        if (!finalRef.current.trim() && !interim.trim() && mountedRef.current) {
          stopListeningAndSubmit();
        }
      }, 20000);
    };

    r.onresult = (ev: any) => {
      sttRestartCountRef.current = 0; // Reset on successful result
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const tr = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalRef.current += tr + " ";
        else interimText += tr;
      }
      setInterim(interimText);
      // Reset silence timer on any speech activity
      clearSilence();
      if (finalRef.current.trim() || interimText.trim()) {
        silenceTimerRef.current = window.setTimeout(() => {
          stopListeningAndSubmit();
        }, SILENCE_MS);
      }
    };

    r.onerror = (e: any) => {
      console.warn("STT error", e.error || e);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast({ variant: "destructive", title: "Microphone blocked", description: "Please allow microphone access in your browser settings." });
        shouldListenRef.current = false;
        setAvatarState("idle");
      }
    };

    r.onend = () => {
      if (shouldListenRef.current && mountedRef.current) {
        sttRestartCountRef.current++;
        if (sttRestartCountRef.current > MAX_STT_RESTARTS) {
          toast({ variant: "destructive", title: "Microphone issue", description: "Speech recognition keeps disconnecting. Try refreshing the page." });
          shouldListenRef.current = false;
          setAvatarState("idle");
          return;
        }
        // Exponential backoff on restarts
        const delay = Math.min(100 * Math.pow(2, sttRestartCountRef.current - 1), 2000);
        setTimeout(() => {
          if (shouldListenRef.current && mountedRef.current) {
            try { r.start(); } catch { /* ignore */ }
          }
        }, delay);
      } else {
        setAvatarState((s) => (s === "listening" ? "idle" : s));
      }
    };

    recogRef.current = r;
    setAvatarState("listening");
    try { r.start(); } catch (e) { console.warn(e); }
  }, [toast, isMuted, paused, sttUnsupported, stopListeningAndSubmit]);

  // ─── Skip question ─────────────────────────────────────────
  const skipQuestion = useCallback(async () => {
    if (busy) return;
    shouldListenRef.current = false;
    clearSilence();
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    finalRef.current = "";
    setInterim("");

    const skipMsg = "I'd like to skip this question and move to the next one.";
    const candidateEntry: TranscriptEntry = { role: "candidate", text: "(Skipped)", timestamp: Date.now() };
    setTranscript((p) => [...p, candidateEntry]);

    const newHistory: Msg[] = [...history, { role: "user", content: skipMsg }];
    setHistory(newHistory);

    setAvatarState("thinking");
    setBusy(true);
    try {
      const reply = await askAI(newHistory);
      if (!mountedRef.current) return;

      const { cleanText, isWrapUp, isMain } = parseAIResponse(reply);

      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      setTranscript((p) => [...p, { role: "interviewer", text: cleanText, timestamp: Date.now() }]);

      let nextQ = questionIndex;
      if (isMain) {
        nextQ = questionIndex + 1;
        setQuestionIndex(nextQ);
      }

      await speak(cleanText);

      if (isWrapUp || nextQ > config!.questionCount * 3) {
        endInterview();
      } else if (!paused && mountedRef.current) {
        startListening();
      }
    } catch (e: any) {
      if (mountedRef.current) {
        toast({ variant: "destructive", title: "Error", description: e.message });
        setAvatarState("idle");
      }
    } finally {
      setBusy(false);
    }
  }, [askAI, history, speak, toast, paused, questionIndex, config, endInterview, busy, startListening]);

  // ─── Start interview ───────────────────────────────────────
  const startInterview = useCallback(async () => {
    if (!config) return;

    // Check STT support early
    if (!SR) {
      setSttUnsupported(true);
      toast({
        variant: "destructive",
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition. Please use Chrome or Edge for the voice interview.",
      });
      return;
    }

    // Trigger microphone permission prompt IMMEDIATELY on click
    // Browsers often block mic access if it's requested after an async await.
    try {
      const dummySR = new SR();
      dummySR.onstart = () => { try { dummySR.stop(); } catch(e){} };
      dummySR.start();
    } catch (e) {
      // ignore
    }

    // Unlock Speech Synthesis immediately on user interaction
    if (window.speechSynthesis) {
      const dummyUtterance = new SpeechSynthesisUtterance("");
      dummyUtterance.volume = 0;
      window.speechSynthesis.speak(dummyUtterance);
    }

    try {
      // Prime voices
      window.speechSynthesis?.getVoices();
      const now = Date.now();
      setStarted(true);
      setStartedAt(now);
      setAvatarState("thinking");
      setBusy(true);
      const opener = await askAI([{ role: "user", content: "Please start the interview by asking the candidate to briefly introduce themselves. Begin your response with the [INTRO] tag." }]);
      
      if (!mountedRef.current) return;

      const { cleanText: cleanOpener } = parseAIResponse(opener);
      const finalOpener = cleanOpener.trim() || "Hi there! Could you please start by introducing yourself?";

      setHistory([
        { role: "user", content: "Please start the interview." },
        { role: "assistant", content: finalOpener }
      ]);
      setTranscript([{ role: "interviewer", text: finalOpener, timestamp: Date.now() }]);
      // questionIndex remains 0 during the Intro
      await speak(finalOpener);
      if (!paused && mountedRef.current) startListening();
    } catch (e: any) {
      if (mountedRef.current) {
        toast({ variant: "destructive", title: "Could not start", description: e.message });
        setStarted(false);
        setStartedAt(null);
        setAvatarState("idle");
      }
    } finally {
      setBusy(false);
    }
  }, [askAI, config, speak, toast, paused, startListening]);

  // ─── Timer display ─────────────────────────────────────────
  const elapsedDisplay = useElapsedTime(startedAt);

  if (!config) return null;
  const domainLabel = config.source === "skill" ? config.skill
    : config.source === "jd" ? "Job Description"
    : config.source === "resume" ? "Resume-based"
    : (config.domain === "custom" ? config.customDomain : DOMAIN_LABELS[config.domain]);

  const isListening = avatarState === "listening";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-display font-semibold text-sm">{domainLabel}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {DIFFICULTY_LABELS[config.difficulty]}
          </span>
          {started && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {elapsedDisplay}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground mr-1">
            {questionIndex === 0 ? "Intro" : `Q ${Math.min(questionIndex, config.questionCount)} / ${config.questionCount}`}
          </span>
          {voices.filter(v => /^(en|hi)/i.test(v.lang)).length > 0 && (
            <select
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              aria-label="Select interviewer voice"
              className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground font-medium max-w-[200px]"
            >
              {voices.filter(v => /^(en|hi)/i.test(v.lang)).map((v) => {
                let label = v.name;
                if (/en-IN/i.test(v.lang)) label = `🇮🇳 English (India) - ${v.name}`;
                else if (/hi-IN/i.test(v.lang)) label = `🇮🇳 Hindi - ${v.name}`;
                else if (/en-US/i.test(v.lang)) label = `🇺🇸 English (US) - ${v.name}`;
                else if (/en-GB/i.test(v.lang)) label = `🇬🇧 English (UK) - ${v.name}`;
                
                return (
                  <option key={v.name} value={v.name}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <InterviewAvatar state={avatarState} />

          {/* STT unsupported banner */}
          {sttUnsupported && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2 rounded-xl max-w-md text-center">
              Speech recognition is not supported in this browser. Please use <strong>Chrome</strong> or <strong>Edge</strong> for voice interviews.
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {!started ? (
              <Button size="lg" className="h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 font-semibold" onClick={startInterview} disabled={busy || sttUnsupported}>
                {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Mic className="w-5 h-5 mr-2" />}
                {busy ? "Connecting…" : "Start Interview"}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className={`h-12 px-6 rounded-xl font-semibold ${
                    isListening 
                      ? "bg-primary hover:bg-primary/90" 
                      : (avatarState === "idle" && !busy)
                        ? "bg-primary hover:bg-primary/90"
                        : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                  onClick={
                    isListening 
                      ? stopListeningAndSubmit 
                      : (avatarState === "idle" && !busy)
                        ? startListening
                        : undefined
                  }
                  disabled={busy || isMuted || (avatarState !== "listening" && avatarState !== "idle")}
                  title={isListening ? "Submit answer early (Enter)" : "Tap to speak"}
                >
                  {isListening ? (
                    <><Mic className="w-4 h-4 mr-2 animate-pulse" /> Listening…</>
                  ) : busy ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking…</>
                  ) : avatarState === "speaking" ? (
                    "Interviewer speaking…"
                  ) : isMuted ? (
                    <><MicOff className="w-4 h-4 mr-2" /> Mic muted</>
                  ) : avatarState === "idle" ? (
                    <><Mic className="w-4 h-4 mr-2" /> Tap to Speak</>
                  ) : (
                    "…"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={togglePause}
                  title={paused ? "Resume (Space)" : "Pause (Space)"}
                >
                  {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (next && isListening) {
                      // Stop listening when muting
                      shouldListenRef.current = false;
                      clearSilence();
                      try { recogRef.current?.stop(); } catch { /* ignore */ }
                      setAvatarState("idle");
                    }
                  }}
                  title={isMuted ? "Unmute mic" : "Mute mic"}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={skipQuestion}
                  disabled={busy || avatarState === "speaking"}
                  title="Skip this question"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
                <Button variant={showCodeConsole ? "secondary" : "outline"} size="icon" className="h-12 w-12 rounded-full" onClick={() => setShowCodeConsole((p) => !p)} title="Code console">
                  <Code2 className="w-5 h-5" />
                </Button>
                <Button variant="destructive" size="lg" className="h-12 px-6 rounded-xl font-semibold" onClick={endInterview} title="End interview (Escape)">
                  <PhoneOff className="w-4 h-4 mr-2" /> End
                </Button>
              </>
            )}
          </div>
          {isListening && interim && (
            <p className="text-sm text-muted-foreground italic max-w-xl text-center">"{interim}"</p>
          )}
          {/* Keyboard shortcut hints */}
          {started && !busy && (
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Enter = submit · Space = pause · Esc = end
            </p>
          )}
        </div>

        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-sm">Live Transcript</h2>
          </div>
          <ScrollArea className="flex-1 h-[300px] lg:h-auto">
            <div className="p-5 space-y-4" ref={scrollRef} aria-live="polite" aria-label="Interview transcript">
              {transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  {started ? "Listening for the first question…" : "Click 'Start Interview' to begin"}
                </p>
              ) : (
                transcript.map((entry, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${entry.role === "interviewer" ? "" : "flex-row-reverse"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${entry.role === "interviewer" ? "bg-muted text-foreground rounded-tl-md" : "bg-primary text-primary-foreground rounded-tr-md"}`}>
                      {entry.text}
                      <span className="block text-[10px] opacity-50 mt-1">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <CodeConsole visible={showCodeConsole} code={code} setCode={setCode} />
      </div>
    </div>
  );
};

export default InterviewPage;