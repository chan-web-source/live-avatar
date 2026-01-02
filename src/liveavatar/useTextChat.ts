import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import { sendAvatarSpeakText } from "./utils";
import { Room } from "livekit-client";

// TTS API configuration
const TTS_API_URL = process.env.NEXT_PUBLIC_STT_API || "https://backend-ltedu.zeabur.app/";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef, room, isStreamReady, sessionState } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        try {
          // Use hardcoded message
          const textToSpeak = "hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you";

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
          const textToSpeak = "hi lucky how are you";

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
          // Extract audio from various possible response formats
          const audio = data?.audio_base64 || data?.audio || data?.data?.audio_base64 || data?.data?.audio;

          if (audio && sessionRef.current) {
            // Have the avatar repeat the audio
            return sessionRef.current.repeatAudio(audio);
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
