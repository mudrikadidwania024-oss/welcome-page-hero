import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaymentSuccessProps {
  amount: string;
  recipientName: string;
  onClose: () => void;
}

const PaymentSuccess = ({ amount, recipientName, onClose }: PaymentSuccessProps) => {
  const [showCheck, setShowCheck] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play success sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // First tone
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.value = 523.25; // C5
      osc1.type = "sine";
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.3);

      // Second tone (higher)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.value = 659.25; // E5
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.45);

      // Third tone (highest)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.frequency.value = 783.99; // G5
      osc3.type = "sine";
      gain3.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc3.start(audioCtx.currentTime + 0.3);
      osc3.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.log("Audio not supported");
    }

    setTimeout(() => setShowCheck(true), 200);
    setTimeout(() => setShowDetails(true), 800);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      {/* Animated checkmark */}
      <div className={`relative mb-8 transition-all duration-700 ${showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
        <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)]">
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </div>
        {/* Ripple effect */}
        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
        <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDelay: "0.2s" }} />
      </div>

      {/* Details */}
      <div className={`text-center transition-all duration-500 ${showDetails ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <p className="text-lg font-bold text-emerald-500 mb-2">Payment Successful!</p>
        <p className="text-4xl font-extrabold text-foreground mb-2">₹{amount}</p>
        <p className="text-sm text-muted-foreground">
          Paid to <span className="font-semibold text-foreground">{recipientName}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      {/* Done button */}
      <div className={`mt-12 w-full max-w-xs transition-all duration-500 delay-300 ${showDetails ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <button
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
