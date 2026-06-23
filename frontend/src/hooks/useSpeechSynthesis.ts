import { useCallback, useEffect, useState } from "react";

interface UseSpeechSynthesis {
  supported: boolean;
  /** Id of the message currently being spoken, or null. */
  speakingId: string | null;
  paused: boolean;
  speak: (id: string, text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** Strip Markdown so the synthesizer reads clean prose, not symbols. */
function toSpeakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code block) ") // fenced code
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      // Cancel anything in progress before starting a new utterance.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
      utterance.rate = 1;
      utterance.onend = () => {
        setSpeakingId(null);
        setPaused(false);
      };
      utterance.onerror = () => {
        setSpeakingId(null);
        setPaused(false);
      };
      setSpeakingId(id);
      setPaused(false);
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  // Stop speaking if the component using this unmounts.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, speakingId, paused, speak, pause, resume, stop };
}
