import { useState, useEffect } from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { NeuralBrain } from "./NeuralBrain";
import { Brain, MessageSquare } from "lucide-react";

export function AgentsFlipCard() {
  const [flipped, setFlipped] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="relative flex-1 min-h-0 w-full" style={{ perspective: "2000px" }}>
      {/* Flip button (always on top, fixed to the card) */}
      <button
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label="Flip agents view"
        className={
          isCompact
            ? "absolute bottom-20 right-3 z-30 flex items-center justify-center w-11 h-11 rounded-full bg-black/80 backdrop-blur-md border border-[#69af00]/50 hover:border-[#69af00] text-[#69af00] hover:text-[#ffd700] hover:bg-black/95 transition-all shadow-[0_0_20px_rgba(105,175,0,0.35)]"
            : "absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-[#69af00]/40 hover:border-[#69af00] text-[10px] font-mono tracking-[0.25em] uppercase text-[#69af00] hover:text-[#ffd700] hover:bg-black/90 transition-all shadow-[0_0_20px_rgba(105,175,0,0.25)]"
        }
      >
        {isCompact ? (
          flipped ? <MessageSquare className="w-4 h-4" /> : <Brain className="w-4 h-4" />
        ) : flipped ? (
          <>
            <MessageSquare className="w-3 h-3" />
            <span>Neural ⟳ Chat</span>
          </>
        ) : (
          <>
            <Brain className="w-3 h-3" />
            <span>Chat ⟳ Neural</span>
          </>
        )}
      </button>

      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT — Chat */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          aria-hidden={flipped}
        >
          <ChatContainer />
        </div>

        {/* BACK — Neural brain */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
          aria-hidden={!flipped}
        >
          {flipped && <NeuralBrain />}
        </div>
      </div>
    </div>
  );
}