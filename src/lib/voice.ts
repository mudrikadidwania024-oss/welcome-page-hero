// Shared voice utility: TTS and STT helpers
//
// Two TTS engines:
// 1. Sarvam AI TTS (speakSarvam) — high quality, server-side, used on login page
// 2. Browser speechSynthesis (speak) — fallback, used elsewhere
//
// STT uses the browser's Web Speech API (SpeechRecognition).

import { supabase } from "@/integrations/supabase/client";

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let ttsWarmedUp = false;
let currentAudio: HTMLAudioElement | null = null;

/**
 * Call this once from any click/tap handler to unlock the speech synthesis
 * engine for the rest of the page session.
 */
export function warmUpTTS() {
  if (ttsWarmedUp || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  ttsWarmedUp = true;
}

/**
 * High-quality TTS via Sarvam AI edge function.
 * Returns base64 MP3 audio and plays it. No gesture restrictions since
 * it uses HTMLAudioElement (unlocked by warmUpTTS or any prior user tap).
 */
export async function speakSarvam(text: string, language = "en-IN"): Promise<void> {
  stopSpeaking();

  try {
    const { data, error } = await supabase.functions.invoke("sarvam-tts", {
      body: { text, language },
    });

    if (error || !data) {
      console.warn("Sarvam TTS failed, falling back to browser TTS:", error);
      return speak(text, language);
    }

    // Sarvam returns { audios: ["base64..."] }
    const base64Audio = data.audios?.[0];
    if (!base64Audio) {
      console.warn("No audio in Sarvam response, falling back");
      return speak(text, language);
    }

    return new Promise<void>((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      currentAudio = audio;
      audio.onended = () => { currentAudio = null; resolve(); };
      audio.onerror = (e) => {
        console.warn("Audio playback error:", e);
        currentAudio = null;
        resolve();
      };
      audio.play().catch(() => {
        // If autoplay blocked, fall back to browser TTS
        console.warn("Audio autoplay blocked, falling back to browser TTS");
        currentAudio = null;
        speak(text, language).then(resolve);
      });
    });
  } catch (err) {
    console.warn("Sarvam TTS error:", err);
    return speak(text, language);
  }
}

/**
 * Browser-based TTS (fallback). Works from any context as long as warmUpTTS()
 * was called at least once during a user gesture.
 */
export function speak(text: string, lang = "en-IN"): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.volume = 1;

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (keepAlive) clearInterval(keepAlive);
        resolve();
      };

      utterance.onend = cleanup;
      utterance.onerror = (e) => {
        console.warn("TTS error:", e.error || e);
        cleanup();
      };

      window.speechSynthesis.speak(utterance);

      keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          cleanup();
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 5000);
    }, 50);
  });
}

export function stopSpeaking() {
  // Stop Sarvam audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  // Stop browser TTS
  window.speechSynthesis?.cancel();
}

/**
 * Listen for speech input once. Returns the transcript.
 * Resolves with empty string if no speech detected within timeout.
 * Rejects on errors like "not-allowed".
 */
export function listenOnce(lang = "en-IN", timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) {
      reject(new Error("Speech recognition not supported"));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const done = (value: string) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      resolve(value);
    };

    const fail = (err: Error) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      done(text);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        done(""); // No speech is not an error, just empty
      } else {
        fail(new Error(event.error));
      }
    };

    recognition.onend = () => {
      done(""); // If ended without result, resolve empty
    };

    // Timeout fallback
    timeoutId = setTimeout(() => {
      try { recognition.stop(); } catch {}
      done("");
    }, timeoutMs);

    try {
      recognition.start();
    } catch (err) {
      fail(err as Error);
    }
  });
}

// Extract digits from speech like "nine eight seven six five four three two one zero"
const WORD_TO_DIGIT: Record<string, string> = {
  zero: "0", oh: "0", o: "0",
  one: "1", won: "1",
  two: "2", too: "2", to: "2",
  three: "3", tree: "3",
  four: "4", for: "4", fore: "4",
  five: "5",
  six: "6", sex: "6",
  seven: "7",
  eight: "8", ate: "8",
  nine: "9", nein: "9", mine: "9",
};

export function extractDigits(speech: string): string {
  const rawDigits = speech.replace(/[^0-9]/g, "");
  if (rawDigits.length >= 3) return rawDigits;

  const words = speech.toLowerCase().split(/[\s,.-]+/);
  let digits = "";
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      digits += word;
    } else if (WORD_TO_DIGIT[word]) {
      digits += WORD_TO_DIGIT[word];
    }
  }
  return digits || rawDigits;
}

export function extractAmount(speech: string): number | null {
  const text = speech.toLowerCase();
  const match = text.match(/(?:rs\.?|₹|rupees?|rupay)?\s*(\d+)/i);
  if (match) return parseInt(match[1], 10);
  
  const digits = extractDigits(text);
  if (digits) return parseInt(digits, 10);
  return null;
}
