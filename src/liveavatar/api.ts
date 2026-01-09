import { fetchMp3AsBase64, fetchMp3AsPcmBase64 } from "./audioUtils";

// TTS API configuration
const TTS_API_URL = process.env.NEXT_PUBLIC_STT_API || "https://backend-ltedu.zeabur.app/";

/**
 * Start a Full Mode streaming session
 * @returns Promise with session_token and session_id
 */
export async function startFullModeSession(): Promise<{ session_token: string; session_id?: string }> {
 const res = await fetch("/api/start-session", {
  method: "POST",
  body: JSON.stringify({}),
 });

 if (!res.ok) {
  const error = await res.json();
  throw new Error(error.error || "Failed to start full mode session");
 }

 const data = await res.json();
 return {
  session_token: data.session_token,
  session_id: data.session_id,
 };
}

/**
 * Start a Custom Mode streaming session
 * @returns Promise with session_token and session_id
 */
export async function startCustomModeSession(): Promise<{ session_token: string; session_id?: string }> {
 const res = await fetch("/api/start-custom-session", {
  method: "POST",
 });

 if (!res.ok) {
  const error = await res.json();
  throw new Error(error.error || "Failed to start custom mode session");
 }

 const data = await res.json();
 return {
  session_token: data.session_token,
  session_id: data.session_id,
 };
}

/**
 * Call custom TTS API to generate speech from text
 * @param text - The text to convert to speech
 * @param options - Optional parameters for TTS API
 * @returns Promise with audio URL or base64 audio
 */
export async function callCustomTTSAPI(
 text: string,
 options?: {
  refId?: string;
  module?: string;
  model?: string;
  voice?: string;
 }
) {
 const body = {
  refId: options?.refId || undefined,
  module: options?.module || "minimax",
  model: options?.model || "speech-01-turbo",
  input: text,
  voice: options?.voice || "Chinese (Mandarin)_Male_Announcer",
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
  throw new Error(errorMessage);
 }

 const data = await response.json();
 return data;
}

/**
 * Process TTS API response and convert to audio base64 format for avatar
 * Handles both URL and direct base64 responses
 * @param ttsResponse - Response from TTS API
 * @returns Promise with PCM base64 audio string
 */
export async function processTTSResponseToAudio(ttsResponse: any): Promise<string | null> {
 // Handle new response format: { "audioId": "...", "url": "https://..." }
 const audioUrl = ttsResponse?.url || ttsResponse?.data?.url;

 console.log("TTS API response:", { audioUrl, fullData: ttsResponse });

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
    return null;
   }

   return audioBase64;
  } catch (fetchError) {
   console.error("Error fetching audio from URL:", fetchError);
   console.error("Error details:", fetchError instanceof Error ? fetchError.stack : fetchError);
   return null;
  }
 } else {
  // Fallback to old format (base64 directly in response)
  const audio = ttsResponse?.audio_base64 || ttsResponse?.audio || ttsResponse?.data?.audio_base64 || ttsResponse?.data?.audio;
  console.log("Using fallback audio format:", { hasAudio: !!audio });
  return audio || null;
 }
}
