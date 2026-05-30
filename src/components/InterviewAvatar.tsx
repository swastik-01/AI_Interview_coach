import { motion } from "framer-motion";

interface InterviewAvatarProps {
  state: "idle" | "speaking" | "listening" | "thinking";
}

const InterviewAvatar = ({ state }: InterviewAvatarProps) => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className={`absolute w-48 h-48 rounded-full transition-all duration-700 ${
          state === "speaking"
            ? "bg-primary/10 scale-110"
            : state === "listening"
            ? "bg-accent/10 scale-105 animate-listen-pulse"
            : state === "thinking"
            ? "bg-warning/10 scale-105"
            : "bg-muted/30 scale-100"
        }`}
      />

      {/* Avatar container */}
      <motion.div
        className="relative w-40 h-40 rounded-full bg-card border-2 border-border overflow-hidden shadow-lg"
        animate={{
          scale: state === "speaking" ? [1, 1.02, 1] : 1,
        }}
        transition={{
          duration: 0.6,
          repeat: state === "speaking" ? Infinity : 0,
        }}
      >
        {/* Face */}
        <svg viewBox="0 0 160 160" className="w-full h-full">
          {/* Head background */}
          <circle cx="80" cy="80" r="70" fill="hsl(var(--secondary))" />

          {/* Hair */}
          <ellipse cx="80" cy="45" rx="55" ry="35" fill="hsl(var(--foreground) / 0.8)" />
          <rect x="25" y="40" width="110" height="15" rx="5" fill="hsl(var(--foreground) / 0.8)" />

          {/* Face skin */}
          <ellipse cx="80" cy="85" rx="45" ry="42" fill="hsl(30 50% 78%)" />

          {/* Left eye */}
          <g className="animate-blink" style={{ transformOrigin: "58px 78px" }}>
            <ellipse cx="58" cy="78" rx="8" ry="9" fill="white" />
            <circle cx="58" cy="78" r="4.5" fill="hsl(var(--foreground))" />
            <circle cx="56" cy="76" r="1.5" fill="white" />
          </g>

          {/* Right eye */}
          <g className="animate-blink" style={{ transformOrigin: "102px 78px" }}>
            <ellipse cx="102" cy="78" rx="8" ry="9" fill="white" />
            <circle cx="102" cy="78" r="4.5" fill="hsl(var(--foreground))" />
            <circle cx="100" cy="76" r="1.5" fill="white" />
          </g>

          {/* Eyebrows */}
          <line x1="46" y1="66" x2="66" y2="64" stroke="hsl(var(--foreground) / 0.6)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="94" y1="64" x2="114" y2="66" stroke="hsl(var(--foreground) / 0.6)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Nose */}
          <path d="M78 88 Q80 94 82 88" stroke="hsl(30 30% 60%)" strokeWidth="1.5" fill="none" />

          {/* Mouth */}
          <g
            className={state === "speaking" ? "animate-speak" : ""}
            style={{ transformOrigin: "80px 108px" }}
          >
            {state === "speaking" ? (
              <ellipse cx="80" cy="108" rx="12" ry="6" fill="hsl(0 50% 45%)" />
            ) : (
              <path
                d="M68 106 Q80 116 92 106"
                stroke="hsl(0 50% 45%)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* Collar / shirt hint */}
          <path d="M40 140 Q80 125 120 140 L130 160 L30 160 Z" fill="hsl(var(--primary))" />
          <path d="M70 128 L80 140 L90 128" stroke="hsl(var(--primary-foreground) / 0.5)" strokeWidth="1.5" fill="none" />
        </svg>
      </motion.div>

      {/* Status indicator */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            state === "speaking"
              ? "bg-primary/10 text-primary border-primary/20"
              : state === "listening"
              ? "bg-accent/10 text-accent border-accent/20"
              : state === "thinking"
              ? "bg-warning/10 text-warning border-warning/20"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state === "speaking"
                ? "bg-primary animate-pulse"
                : state === "listening"
                ? "bg-accent animate-pulse"
                : state === "thinking"
                ? "bg-warning animate-pulse"
                : "bg-muted-foreground"
            }`}
          />
          {state === "speaking"
            ? "Speaking"
            : state === "listening"
            ? "Listening"
            : state === "thinking"
            ? "Thinking..."
            : "Ready"}
        </span>
      </div>
    </div>
  );
};

export default InterviewAvatar;
