import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useAvatarActions = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const interrupt = useCallback(() => {
    return sessionRef.current.interrupt();
  }, [sessionRef]);

  const repeat = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        // Use hardcoded message for FULL mode
        return sessionRef.current.repeat("hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you");
      } else if (mode === "CUSTOM") {
        try {
          const res = await fetch("/api/elevenlabs-text-to-speech", {
            method: "POST",
            body: JSON.stringify({
              text: "hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you",
            }),
          });

          if (!res.ok) {
            console.error("ElevenLabs API error:", res.status);
            // Continue without audio - avatar will still show video
            return;
          }

          const data = await res.json();
          const audio = data?.audio;

          if (audio && sessionRef.current) {
            return sessionRef.current.repeatAudio(audio);
          }
        } catch (error) {
          console.error("Error in repeat:", error);
          // Continue without audio - avatar will still show video
        }
      }
    },
    [sessionRef, mode],
  );

  const startListening = useCallback(() => {
    return sessionRef.current.startListening();
  }, [sessionRef]);

  const stopListening = useCallback(() => {
    return sessionRef.current.stopListening();
  }, [sessionRef]);

  return {
    interrupt,
    repeat,
    startListening,
    stopListening,
  };
};
