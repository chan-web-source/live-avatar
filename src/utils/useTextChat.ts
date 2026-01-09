import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import { sendAvatarSpeakText } from "./utils";
import { Room } from "livekit-client";
import { callCustomTTSAPI, processTTSResponseToAudio } from "./api";

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef, room, isStreamReady, sessionState } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        try {
          // Use the provided message
          const textToSpeak = message || "";

          if (!textToSpeak.trim()) {
            console.warn("Empty message, nothing to send");
            return;
          }

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
          // Use the provided message
          const textToSpeak = message || "";

          if (!textToSpeak.trim()) {
            console.warn("Empty message, nothing to send");
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
          console.error("Error generating audio:", error);
          console.error("Error details:", error instanceof Error ? error.stack : error);
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
