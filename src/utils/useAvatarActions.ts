import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import { callCustomTTSAPI, processTTSResponseToAudio } from "./api";

export const useAvatarActions = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const interrupt = useCallback(() => {
    return sessionRef.current.interrupt();
  }, [sessionRef]);

  const repeat = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        // Use the provided message for FULL mode
        const textToSpeak = message || "";

        if (!textToSpeak.trim()) {
          console.warn("Empty message, nothing to repeat");
          return;
        }

        return sessionRef.current.repeat(textToSpeak);
      } else if (mode === "CUSTOM") {
        try {
          // Use the provided message
          const textToSpeak = message || "";

          if (!textToSpeak.trim()) {
            console.warn("Empty message, nothing to repeat");
            return;
          }

          // Call custom TTS API
          const ttsResponse = await callCustomTTSAPI(textToSpeak, {
            module: "minimax",
            model: "speech-01-turbo",
            voice: "Chinese (Mandarin)_Male_Announcer",
          });

          // Process TTS response and convert to audio base64
          const audioBase64 = await processTTSResponseToAudio(ttsResponse);

          if (audioBase64 && sessionRef.current) {
            console.log("Calling repeatAudio with base64 audio");
            try {
              const result = sessionRef.current.repeatAudio(audioBase64);
              console.log("✅ repeatAudio called successfully, result:", result);
              return result;
            } catch (repeatError) {
              console.error("❌ repeatAudio threw an error:", repeatError);
              console.error("Error details:", repeatError instanceof Error ? repeatError.stack : repeatError);
              // Continue without audio - avatar will still show video
            }
          } else {
            console.warn("No audio found in response or session not available");
          }
        } catch (error) {
          console.error("Error in repeat:", error);
          console.error("Error details:", error instanceof Error ? error.stack : error);
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
