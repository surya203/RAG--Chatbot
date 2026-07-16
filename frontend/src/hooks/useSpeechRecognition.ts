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
  /** Keep listening until stop() — needed for speaking practice. */
  continuous?: boolean;
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
  continuous = false,
}: Options): UseSpeechRecognition {
  const ctor = getRecognitionCtor();
  const supported = !!ctor;
  const secureContext = typeof window !== "undefined" && window.isSecureContext;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;
  const wantListeningRef = useRef(false);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
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

    // Abort any previous recognizer before starting a new one.
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    setError(null);
    wantListeningRef.current = true;
    const recognition = new ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
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
      if (e.error === "aborted" || e.error === "no-speech") {
        // Common during continuous sessions; keep going unless we stopped.
        if (!wantListeningRef.current) setListening(false);
        return;
      }
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was denied."
          : `Speech recognition error: ${e.error}`
      );
      setListening(false);
      wantListeningRef.current = false;
    };
    recognition.onend = () => {
      // Chrome often ends continuous recognition; restart while session is active.
      if (wantListeningRef.current && continuous) {
        try {
          recognition.start();
          return;
        } catch {
          // fall through
        }
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [ctor, lang, secureContext, continuous]);

  // Clean up on unmount.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, secureContext, listening, error, start, stop };
}
