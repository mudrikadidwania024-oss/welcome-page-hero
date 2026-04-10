// Shared voice utility: TTS and STT helpers
//
// Chrome/Safari block speechSynthesis.speak() when called outside a direct
// user-gesture.  To work around this we "warm up" the engine with a zero-length
// utterance on the first user tap (see warmUpTTS below) and then reuse the
// warmed-up state for later calls.

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let ttsWarmedUp = false;

/**
 * Call this once from any click/tap handler to unlock the speech synthesis
 * engine for the rest of the page session.  It speaks a silent utterance so
 * that subsequent programmatic calls are allowed.
 */
export function warmUpTTS() {
  if (ttsWarmedUp || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  ttsWarmedUp = true;
}

/**
 * Speak text aloud.  Works from any context as long as warmUpTTS() was called
 * at least once during a user gesture.
 */
export function speak(text: string, lang = "en-IN"): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    // Cancel anything in-flight
    window.speechSynthesis.cancel();

    // Small delay after cancel() to let Chrome clean up
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.volume = 1;

      // Chrome bug: synthesis can get stuck paused after cancel()
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Chrome suspends long utterances — keep-alive timer
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
        // Prevent Chrome from pausing long utterances
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 5000);
    }, 50);
  });
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

export function listenOnce(lang = "en-IN"): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) {
      reject(new Error("Speech recognition not supported"));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      resolve(text);
    };
    recognition.onerror = (event: any) => {
      reject(new Error(event.error));
    };
    recognition.onend = () => {
      // If no result came, resolve empty
    };

    try {
      recognition.start();
    } catch (err) {
      reject(err);
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
