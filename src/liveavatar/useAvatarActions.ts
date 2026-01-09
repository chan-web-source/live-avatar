import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import { fetchMp3AsBase64, fetchMp3AsPcmBase64 } from "./audioUtils";

// TTS API configuration
const TTS_API_URL = process.env.NEXT_PUBLIC_STT_API || "https://backend-ltedu.zeabur.app/";

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

          // Call your custom TTS API directly (matching useTextChat.ts pattern)
          const body = {
            refId: undefined,
            module: "minimax",
            model: "speech-01-turbo",
            input: textToSpeak,
            voice: "Chinese (Mandarin)_Male_Announcer",
          };

          const response = await fetch(`${TTS_API_URL}ai-voice-text/audio/tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorBody = await response.json();
              if (errorBody && errorBody.message) {
                errorMessage = errorBody.message;
              } else if (errorBody && typeof errorBody === "object") {
                errorMessage = JSON.stringify(errorBody);
              }
            } catch (e) {
              try {
                const textError = await response.text();
                if (textError) errorMessage = textError;
              } catch (innerE) {
                // Ignore
              }
            }
            console.error("Custom TTS API error:", errorMessage);
            // Continue without audio - avatar will still show video
            return;
          }

          const data = await response.json();

          // Handle new response format: { "audioId": "...", "url": "https://..." }
          const audioUrl = data?.url || data?.data?.url;

          console.log("Custom TTS API response:", { audioUrl, fullData: data });

          if (audioUrl) {
            try {
              console.log("Fetching audio from URL:", audioUrl);

              // Try different audio formats to find what works
              let audioBase64: string | null = null;
              let lastError: Error | null = null;

              // Option 1: Try PCM conversion (avatar SDK likely expects PCM like ElevenLabs at 24kHz)
              try {
                console.log("Attempting MP3 to PCM conversion (24kHz)...");
                audioBase64 = await fetchMp3AsPcmBase64(audioUrl);
                console.log("✅ Audio converted to PCM base64 (24kHz), length:", audioBase64?.length);
              } catch (pcmError) {
                console.warn("PCM conversion failed:", pcmError);
                lastError = pcmError as Error;
              }

              // Option 2: Fallback to regular MP3 base64 (in case SDK accepts MP3 directly)
              if (!audioBase64) {
                try {
                  console.log("Trying regular MP3 base64 conversion...");
                  audioBase64 = await fetchMp3AsBase64(audioUrl);
                  console.log("✅ Audio converted to MP3 base64, length:", audioBase64?.length);
                } catch (base64Error) {
                  console.error("Base64 conversion also failed:", base64Error);
                  lastError = base64Error as Error;
                }
              }

              if (!audioBase64) {
                console.error("❌ Failed to convert audio in any format. Last error:", lastError);
                return;
              }

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
                console.warn("Missing audioBase64 or sessionRef:", {
                  hasAudio: !!audioBase64,
                  hasSession: !!sessionRef.current,
                });
              }
            } catch (fetchError) {
              console.error("Error fetching audio from URL:", fetchError);
              console.error("Error details:", fetchError instanceof Error ? fetchError.stack : fetchError);
              // Continue without audio - avatar will still show video
            }
          } else {
            // Fallback to old format (base64 directly in response)
            const audio = data?.audio_base64 || data?.audio || data?.data?.audio_base64 || data?.data?.audio;
            console.log("Using fallback audio format:", { hasAudio: !!audio });

            if (audio && sessionRef.current) {
              console.log("Calling repeatAudio with fallback audio");
              const result = sessionRef.current.repeatAudio(audio);
              console.log("repeatAudio result:", result);
              return result;
            } else {
              console.warn("No audio found in response or session not available");
            }
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
