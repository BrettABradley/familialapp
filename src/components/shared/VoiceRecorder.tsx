import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

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

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        console.warn("Audio recording not supported on this device");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Safari / iOS WKWebView doesn't support audio/webm — pick the first
      // supported mime type so MediaRecorder construction doesn't throw and
      // crash the WebView (which on iOS can boot the user out of the app).
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

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= maxDuration) {
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("startRecording error:", err);
    }
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
