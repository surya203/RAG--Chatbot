import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Options {
  /** Called with the latest transcript (interim or final). */
  onTranscript: (text: string, isFinal: boolean) => void;
  lang?: string;
}

interface UseSpeechRecognition {
  supported: boolean;
  /** Mic capture needs a secure context (https or localhost). */
  secureContext: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({
  onTranscript,
  lang = "en-US",
}: Options): UseSpeechRecognition {
  const ctor = getRecognitionCtor();
  const supported = !!ctor;
  const secureContext = typeof window !== "undefined" && window.isSecureContext;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!ctor) {
      setError("Speech recognition isn't supported in this browser.");
      return;
    }
    if (!secureContext) {
      setError("Microphone needs a secure page — open the app at http://localhost:5173.");
      return;
    }

    setError(null);
    const recognition = new ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let transcript = "";
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      callbackRef.current(transcript, isFinal);
    };
    recognition.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was denied."
          : `Speech recognition error: ${e.error}`
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [ctor, lang, secureContext]);

  // Clean up on unmount.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, secureContext, listening, error, start, stop };
}
