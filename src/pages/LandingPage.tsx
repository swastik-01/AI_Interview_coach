import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, Brain, BarChart3, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Mic,
    title: "Voice Conversation",
    description: "Real-time speech-to-speech with an AI interviewer that listens and responds naturally.",
  },
  {
    icon: Brain,
    title: "Multiple Domains",
    description: "Software Engineering, Data Science, Cloud, Product Management, or your own custom domain.",
  },
  {
    icon: Layers,
    title: "5 Difficulty Levels",
    description: "From Beginner fundamentals to Expert-level architecture and edge case discussions.",
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Get scored feedback with strengths, weaknesses, and actionable improvement tips.",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="container mx-auto px-6 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-medium tracking-wider uppercase rounded-full bg-primary/10 text-primary border border-primary/20">
              AI-Powered Mock Interviews
            </span>
            <h1 className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-6">
              Ace Your Next
              <br />
              <span className="gradient-text">Interview</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Practice with an AI interviewer that speaks, listens, and evaluates your responses in real time. Choose your domain, set the difficulty, and get instant feedback.
            </p>
            <Button
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg"
              onClick={() => navigate("/setup")}
            >
              Start Interview
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Features */}
      <section className="container mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
