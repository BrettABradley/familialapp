import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // seconds, default 120
}

export const VoiceRecorder = ({ onRecordingComplete, maxDuration = 120 }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which recorder path is actively running so stopRecording uses the
  // matching API. If the native plugin isn't compiled into the iOS bundle yet
  // we fall back to the WKWebView MediaRecorder and must NOT call the native
  // stop, which would throw "not implemented".
  const activeModeRef = useRef<"native" | "web" | null>(null);

  const stopRecording = useCallback(async () => {
    // Always clear the timer first so the elapsed counter freezes immediately.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (activeModeRef.current === "native") {
      try {
        const { VoiceRecorder } = await import("capacitor-voice-recorder");
        const result = await VoiceRecorder.stopRecording();
        setIsRecording(false);
        setElapsed(0);
        activeModeRef.current = null;
        const b64 = result?.value?.recordDataBase64;
        const mime = result?.value?.mimeType || "audio/aac";
        if (!b64) {
          toast.error("No audio recorded. Try holding the mic a bit longer.");
          return;
        }
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        if (blob.size === 0) {
          toast.error("Recording was empty. Please try again.");
          return;
        }
        onRecordingComplete(blob);
      } catch (err: any) {
        console.error("Native stopRecording error:", err);
        toast.error(err?.message || "Could not stop recording.");
        setIsRecording(false);
        setElapsed(0);
        activeModeRef.current = null;
      }
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setElapsed(0);
    activeModeRef.current = null;
  }, [onRecordingComplete]);

  useEffect(() => {
    // Preload the native voice-recorder plugin on mount so the very first tap
    // doesn't pay the dynamic-import cost (which on iOS adds 1-3s before the
    // OS permission prompt appears). Also warm up the permission check.
    if (Capacitor.isNativePlatform()) {
      import("capacitor-voice-recorder")
        .then(async ({ VoiceRecorder }) => {
          try {
            await VoiceRecorder.canDeviceVoiceRecord();
            await VoiceRecorder.hasAudioRecordingPermission();
          } catch {
            // ignore — handled at record time
          }
        })
        .catch(() => {});
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startWebRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        toast.error("Audio recording isn't supported on this device.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Safari / iOS WKWebView doesn't support audio/webm — pick the first
      // supported mime type so MediaRecorder construction doesn't throw.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/aac",
        "",
      ];
      const mimeType =
        candidates.find((t) => t === "" || (MediaRecorder.isTypeSupported?.(t) ?? false)) ??
        "";

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (err) {
        console.error("MediaRecorder init failed:", err);
        stream.getTracks().forEach((t) => t.stop());
        toast.error("Could not start recording on this device.");
        return;
      }

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 0) onRecordingComplete(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setElapsed(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= maxDuration) {
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("startWebRecording error:", err);
      toast.error(err?.message || "Could not start recording.");
    }
  };

  const startWebRecordingWithTracking = async () => {
    await startWebRecording();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      activeModeRef.current = "web";
    }
  };

  const startRecording = async () => {
    // On native iOS/Android, prefer the Capacitor voice-recorder plugin so
    // the OS surfaces its native microphone permission prompt instead of
    // relying on WKWebView's getUserMedia (which can hard-crash the app).
    if (Capacitor.isNativePlatform()) {
      try {
        const { VoiceRecorder } = await import("capacitor-voice-recorder");
        const can = await VoiceRecorder.canDeviceVoiceRecord();
        if (!can?.value) {
          console.warn("Native VoiceRecorder reports unavailable, falling back to web recorder");
          await startWebRecordingWithTracking();
          return;
        }
        const perm = await VoiceRecorder.hasAudioRecordingPermission();
        if (!perm?.value) {
          const req = await VoiceRecorder.requestAudioRecordingPermission();
          if (!req?.value) {
            toast.error("Microphone permission denied. Enable it in Settings → Familial → Microphone.");
            return;
          }
        }
        await VoiceRecorder.startRecording();
        activeModeRef.current = "native";
        setIsRecording(true);
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setElapsed((prev) => {
            if (prev + 1 >= maxDuration) {
              stopRecording();
              return 0;
            }
            return prev + 1;
          });
        }, 1000);
        return;
      } catch (err: any) {
        // Any failure on the native path — plugin missing, permission denied
        // at the OS level, an actively running recorder, etc. — falls back to
        // the WKWebView MediaRecorder so the mic always works.
        console.warn("Native VoiceRecorder failed, falling back to web recorder:", err);
        await startWebRecordingWithTracking();
        return;
      }
    }

    await startWebRecordingWithTracking();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
          <button
            type="button"
            onClick={stopRecording}
            className="h-7 w-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
            aria-label="Stop recording"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
          <div className="flex items-end gap-[2px] h-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[2px] bg-destructive rounded-full animate-pulse"
                style={{
                  height: `${40 + ((i * 17) % 60)}%`,
                  animationDelay: `${i * 120}ms`,
                  animationDuration: "900ms",
                }}
              />
            ))}
          </div>
          <span className="text-xs font-medium tabular-nums text-foreground/80">
            {formatTime(elapsed)}
          </span>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="icon" onClick={startRecording} className="h-9 w-9 flex-shrink-0">
          <Mic className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
