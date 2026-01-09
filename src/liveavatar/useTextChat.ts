import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import { sendAvatarSpeakText } from "./utils";
import { Room } from "livekit-client";
import { fetchMp3AsBase64, fetchMp3AsPcmBase64 } from "./audioUtils";

// TTS API configuration
const TTS_API_URL = process.env.NEXT_PUBLIC_STT_API || "https://backend-ltedu.zeabur.app/";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef, room, isStreamReady, sessionState } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        try {
          // Use hardcoded message
          const textToSpeak = "hi lucky 你怎麽樣 hi lucky 你怎麽樣 hi lucky 你怎麽樣 hi lucky 你怎麽樣 ";

          // Helper function to get room and check if it's ready
          const getReadyRoom = (): Room | null => {
            // First try room from context
            if (room && room.localParticipant) {
              // Check if room is connected
              if (room.state === "connected" || room.state === "reconnecting") {
                return room;
              } else {
                console.warn("Room from context exists but not connected, state:", room.state);
              }
            }

            // If room not in context or not ready, try to get it from session
            const session = sessionRef.current;
            if (!session) {
              return null;
            }

            const sessionAny = session as any;
            let foundRoom: Room | null = null;

            // Try different property names
            if (sessionAny.room) {
              foundRoom = sessionAny.room as Room;
            } else if (sessionAny._room) {
              foundRoom = sessionAny._room as Room;
            } else if (sessionAny.livekitRoom) {
              foundRoom = sessionAny.livekitRoom as Room;
            } else if (sessionAny.voiceChat?.room) {
              foundRoom = sessionAny.voiceChat.room as Room;
            } else if (sessionAny.getRoom && typeof sessionAny.getRoom === "function") {
              foundRoom = sessionAny.getRoom() as Room;
            }

            if (foundRoom && foundRoom.localParticipant) {
              // Check if room is connected
              if (foundRoom.state === "connected" || foundRoom.state === "reconnecting") {
                return foundRoom;
              } else {
                console.warn("Room found but not connected, state:", foundRoom.state);
              }
            }

            return null;
          };

          // Try to get ready room
          let readyRoom = getReadyRoom();

          // If room not ready, wait a bit and retry (room might be connecting)
          if (!readyRoom && isStreamReady) {
            console.log("Room not immediately available, waiting 200ms and retrying...");
            await new Promise(resolve => setTimeout(resolve, 200));
            readyRoom = getReadyRoom();
          }

          if (readyRoom && readyRoom.localParticipant) {
            console.log("✅ Room ready, publishing speak_text event. Room state:", readyRoom.state);
            try {
              await sendAvatarSpeakText(readyRoom, textToSpeak);
              console.log("✅ Published speak_text event to agent-control:", textToSpeak);
            } catch (publishError) {
              console.error("Failed to publish data:", publishError);
            }
            return;
          } else {
            console.error("❌ Cannot access LiveKit room. Details:", {
              sessionState,
              isStreamReady,
              roomFromContext: !!room,
              roomState: room?.state,
              localParticipant: room?.localParticipant ? "exists" : "missing",
            });
            return;
          }
        } catch (error) {
          console.error("Error publishing speak_text event:", error);
          console.error("Error details:", error instanceof Error ? error.stack : error);
        }
      } else if (mode === "CUSTOM") {
        try {
          // Use hardcoded message directly
          const textToSpeak = "hey lucky你好嗎，hey lucky你好嗎，hey lucky你好嗎";

          // Call your TTS API directly (matching textToSpeechTranscriptions function)
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
            console.error("TTS API error:", errorMessage);
            // Continue without audio - avatar will still show video
            return;
          }

          const data = await response.json();

          // Handle new response format: { "audioId": "...", "url": "https://..." }
          const audioUrl = data?.url || data?.data?.url;

          console.log("TTS API response:", { audioUrl, fullData: data });

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
          console.error("Error generating audio:", error);
          // Continue without audio - avatar will still show video
        }
      }
    },
    [sessionRef, mode, room, isStreamReady, sessionState],
  );

  return {
    sendMessage,
  };
};
