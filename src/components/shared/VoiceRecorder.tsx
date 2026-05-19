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

  const isNative = Capacitor.isNativePlatform();

  const stopRecording = useCallback(async () => {
    // Always clear the timer first so the elapsed counter freezes immediately.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isNative) {
      try {
        const { VoiceRecorder } = await import("capacitor-voice-recorder");
        const result = await VoiceRecorder.stopRecording();
        setIsRecording(false);
        setElapsed(0);
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
      }
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setElapsed(0);
  }, [isNative, onRecordingComplete]);

  useEffect(() => {
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

  const startRecording = async () => {
    // On native iOS/Android, prefer the Capacitor voice-recorder plugin so
    // the OS surfaces its native microphone permission prompt instead of
    // relying on WKWebView's getUserMedia (which can hard-crash the app).
    if (isNative) {
      try {
        const { VoiceRecorder } = await import("capacitor-voice-recorder");
        const can = await VoiceRecorder.canDeviceVoiceRecord();
        if (!can?.value) {
          toast.error("Voice recording is not supported on this device");
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
        setIsRecording(true);
        setElapsed(0);
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
        const msg = String(err?.message || err?.code || err || "");
        // Plugin not installed in the native shell yet — fall back to the
        // WKWebView getUserMedia API so the mic still works on iOS/Android
        // until the user runs `npx cap sync` on the new plugin.
        const notInstalled =
          /not implemented|unimplemented|not available|UNIMPLEMENTED/i.test(msg);
        if (notInstalled) {
          console.warn("Native VoiceRecorder unavailable, falling back to web recorder:", msg);
          await startWebRecording();
          return;
        }
        console.error("Native startRecording error:", err);
        toast.error(msg || "Could not start recording");
        return;
      }
    }

    await startWebRecording();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
            <Square className="w-4 h-4 mr-1" />
            Stop
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse" />
            {formatTime(elapsed)} / {formatTime(maxDuration)}
          </div>
        </>
      ) : (
        <Button type="button" variant="ghost" size="icon" onClick={startRecording} className="h-9 w-9 flex-shrink-0">
          <Mic className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
