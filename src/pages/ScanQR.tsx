import { ArrowLeft, MoreVertical, Image as ImageIcon, QrCode, SwitchCamera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import MobileLayout from "@/components/MobileLayout";
import { toast } from "sonner";
import { speak } from "@/lib/voice";
import jsQR from "jsqr";

const ScanQR = () => {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef<boolean>(false);
  const animFrameRef = useRef<number>(0);
  const hasSpoken = useRef(false);

  // Speak on mount
  useEffect(() => {
    if (!hasSpoken.current) {
      hasSpoken.current = true;
      speak("Point your camera at a QR code to scan and pay.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleScanResult = useCallback(async (text: string) => {
    setScanResult(text);
    stopCamera();
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === "vaanipay" && parsed.qr_code_id) {
        await speak("QR code scanned successfully. Opening payment.");
        navigate(`/pay-qr?qr=${encodeURIComponent(parsed.qr_code_id)}`);
        return;
      }
    } catch {
      // Not a VaaniPay QR
    }
    await speak("Scanned a QR code, but it's not a VaaniPay code.");
    toast.info("Scanned a non-VaaniPay QR code");
  }, [navigate, stopCamera]);

  const scanFrame = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      scanningRef.current = false;
      handleScanResult(code.data);
      return;
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleScanResult]);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanningRef.current = true;
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setHasPermission(false);
      speak("Camera permission denied. Please enable it in your browser settings.");
      toast.error("Camera permission denied.");
    }
  }, [facingMode, stopCamera, scanFrame]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen bg-black text-white">
        <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-10 bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">Scan any QR</h1>
          </div>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <MoreVertical className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-[350px] aspect-square rounded-2xl overflow-hidden border-2 border-primary/30 relative bg-black">
            {hasPermission === false ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <QrCode className="w-12 h-12 text-white/40" />
                <p className="text-sm text-white/60">Camera permission is required to scan QR codes</p>
                <button
                  onClick={startCamera}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold"
                >
                  Grant Permission
                </button>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                {!scanResult && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1" />
                    <div className="w-full h-0.5 bg-primary absolute top-1/2 left-0 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_10px_theme('colors.primary.DEFAULT')]" />
                  </div>
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {scanResult ? (
            <div className="mt-8 p-4 bg-white/10 rounded-xl max-w-full overflow-hidden text-ellipsis animate-fade-in-up">
              <p className="text-xs text-white/60 mb-1">Result:</p>
              <p className="text-sm font-mono break-all">{scanResult}</p>
              <button
                onClick={() => { setScanResult(null); startCamera(); }}
                className="mt-4 w-full bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold"
              >
                Scan Again
              </button>
            </div>
          ) : (
            <p className="mt-8 text-sm text-white/80 font-medium animate-fade-in-up">Point at any QR code to pay</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-12 pb-12 pt-6 bg-gradient-to-t from-black to-transparent">
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">Gallery</span>
          </button>
          <button onClick={toggleCamera} className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <SwitchCamera className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">{facingMode === "environment" ? "Front" : "Back"}</span>
          </button>
          <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">My QR</span>
          </button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default ScanQR;
