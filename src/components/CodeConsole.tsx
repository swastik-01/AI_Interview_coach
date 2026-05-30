import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check, RotateCcw } from "lucide-react";

interface CodeConsoleProps {
  visible: boolean;
  code: string;
  setCode: (code: string) => void;
}

const CodeConsole = ({ visible, code, setCode }: CodeConsoleProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => setCode("");

  if (!visible) return null;

  return (
    <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-border w-full lg:w-[480px]">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-sm">Code Console</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="// Write your code here..."
          spellCheck={false}
          className="w-full h-full min-h-[300px] lg:min-h-0 resize-none bg-[hsl(var(--muted)/0.15)] text-foreground font-mono text-sm p-4 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          style={{ tabSize: 2 }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newVal = code.substring(0, start) + "  " + code.substring(end);
              setCode(newVal);
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />
        <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/40 font-mono">
          {code.split("\n").length} lines
        </div>
      </div>
    </div>
  );
};

export default CodeConsole;
