import { Room } from "livekit-client";

/**
 * Sends avatar.speak_text event to the LiveKit room
 * This publishes a data message to the agent-control topic
 */
export function sendAvatarSpeakText(room: Room, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const payload = {
        event_type: "avatar.speak_text",
        text, // matches {"text": string}
      };

      const data = new TextEncoder().encode(JSON.stringify(payload));

      if (!room.localParticipant) {
        reject(new Error("Local participant not available"));
        return;
      }

      room.localParticipant.publishData(
        data,
        {
          reliable: true,
          topic: "agent-control", // command-topic from docs
        }
      ).then(() => {
        console.log("publishData resolved successfully");
        resolve();
      }).catch((error) => {
        console.error("publishData rejected:", error);
        reject(error);
      });
    } catch (error) {
      console.error("Error in sendAvatarSpeakText:", error);
      reject(error);
    }
  });
}

