import {
 API_KEY,
 API_URL,
 AVATAR_ID,
 VOICE_ID,
 CONTEXT_ID,
 LANGUAGE,
 NEXT_PUBLIC_STT_API,
} from "./secrets";

// Full Mode Streaming Session Token
export async function startFullModeStreamingSessionToken() {
 let session_token = "";
 let session_id = "";
 try {
  const res = await fetch(`${API_URL}/v1/sessions/token`, {
   method: "POST",
   headers: {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json",
   },
   body: JSON.stringify({
    mode: "FULL",
    avatar_id: AVATAR_ID,
    avatar_persona: {
     voice_id: VOICE_ID,
     context_id: CONTEXT_ID,
     language: LANGUAGE || "en",
     disable_greeting: true
    },
    // Removed initial message to prevent default greeting
   }),
  });
  if (!res.ok) {
   const resp = await res.json();
   const errorMessage =
    resp.data[0].message ?? "Failed to retrieve session token";
   return new Response(JSON.stringify({ error: errorMessage }), {
    status: res.status,
   });
  }
  const data = await res.json();

  session_token = data.data.session_token;
  session_id = data.data.session_id;
 } catch (error) {
  console.error("Error retrieving session token:", error);
  return new Response(JSON.stringify({ error: (error as Error).message }), {
   status: 500,
  });
 }

 if (!session_token) {
  return new Response("Failed to retrieve session token", {
   status: 500,
  });
 }
 return new Response(JSON.stringify({ session_token, session_id }), {
  status: 200,
  headers: {
   "Content-Type": "application/json",
  },
 });
}

// Custom Mode Streaming Session Token
export async function startCustomModeStreamingSessionToken() {
 let session_token = "";
 let session_id = "";
 try {
  const res = await fetch(`${API_URL}/v1/sessions/token`, {
   method: "POST",
   headers: {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json",
   },
   body: JSON.stringify({
    mode: "CUSTOM",
    avatar_id: AVATAR_ID,
   }),
  });
  if (!res.ok) {
   const error = await res.json();
   if (error.error) {
    const resp = await res.json();
    const errorMessage =
     resp.data[0].message ?? "Failed to retrieve session token";
    return new Response(JSON.stringify({ error: errorMessage }), {
     status: res.status,
    });
   }

   return new Response(
    JSON.stringify({ error: "Failed to retrieve session token" }),
    {
     status: res.status,
    },
   );
  }
  const data = await res.json();
  console.log(data);

  session_token = data.data.session_token;
  session_id = data.data.session_id;
 } catch (error: unknown) {
  return new Response(JSON.stringify({ error: (error as Error).message }), {
   status: 500,
  });
 }

 if (!session_token) {
  return new Response(
   JSON.stringify({ error: "Failed to retrieve session token" }),
   {
    status: 500,
   },
  );
 }
 return new Response(JSON.stringify({ session_token, session_id }), {
  status: 200,
  headers: {
   "Content-Type": "application/json",
  },
 });
}

// Stop Streaming Session
export async function stopStreamingSession(request: Request) {
 try {
  const body = await request.json();
  const { session_token } = body;

  if (!session_token) {
   return new Response(
    JSON.stringify({ error: "session_token is required" }),
    {
     status: 400,
     headers: {
      "Content-Type": "application/json",
     },
    },
   );
  }

  const res = await fetch(`${API_URL}/v1/sessions`, {
   method: "DELETE",
   headers: {
    Authorization: `Bearer ${session_token}`,
    "Content-Type": "application/json",
   },
  });

  if (!res.ok) {
   const errorData = await res.json();
   console.error("Error stopping session:", errorData);
   return new Response(
    JSON.stringify({
     error: errorData.data?.message || "Failed to stop session",
    }),
    {
     status: res.status,
     headers: {
      "Content-Type": "application/json",
     },
    },
   );
  }

  return new Response(
   JSON.stringify({
    success: true,
    message: "Session stopped successfully",
   }),
   {
    status: 200,
    headers: {
     "Content-Type": "application/json",
    },
   },
  );
 } catch (error) {
  console.error("Error stopping session:", error);
  return new Response(JSON.stringify({ error: "Failed to stop session" }), {
   status: 500,
   headers: {
    "Content-Type": "application/json",
   },
  });
 }
}

// Custom Text to Speech
export async function customTextToSpeech(request: Request) {
 try {
  const body = await request.json();
  const {
   input,
   refId,
   module = "openai",
   model,
   voice,
  } = body;

  if (!input) {
   return new Response(JSON.stringify({ error: "input is required" }), {
    status: 400,
    headers: {
     "Content-Type": "application/json",
    },
   });
  }

  if (!NEXT_PUBLIC_STT_API) {
   return new Response(
    JSON.stringify({ error: "TTS API URL not configured" }),
    {
     status: 500,
     headers: {
      "Content-Type": "application/json",
     },
    },
   );
  }

  const requestBody = {
   refId,
   module,
   model,
   input,
   voice,
  };

  // Call custom TTS API
  const res = await fetch(`${NEXT_PUBLIC_STT_API}ai-voice-text/audio/tts`, {
   method: "POST",
   headers: {
    "Content-Type": "application/json",
   },
   body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
   let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
   try {
    const errorBody = await res.json();
    if (errorBody && errorBody.message) {
     errorMessage = errorBody.message;
    } else if (errorBody && typeof errorBody === "object") {
     errorMessage = JSON.stringify(errorBody);
    }
   } catch (e) {
    try {
     const textError = await res.text();
     if (textError) errorMessage = textError;
    } catch (innerE) {
     // Ignore
    }
   }
   console.error("Custom TTS API error:", errorMessage);
   return new Response(
    JSON.stringify({
     error: "Failed to generate speech",
     details: errorMessage,
    }),
    {
     status: res.status,
     headers: {
      "Content-Type": "application/json",
     },
    },
   );
  }

  const data = await res.json();

  // Extract audio from response - adjust based on your API's response format
  // The response might have audio_base64, audio, or a different field name
  const audio = data?.audio_base64 || data?.audio || data?.data?.audio_base64 || data?.data?.audio;

  return new Response(JSON.stringify({ audio }), {
   status: 200,
   headers: {
    "Content-Type": "application/json",
   },
  });
 } catch (error) {
  console.error("Error generating speech:", error);
  return new Response(
   JSON.stringify({ error: "Failed to generate speech" }),
   {
    status: 500,
    headers: {
     "Content-Type": "application/json",
    },
   },
  );
 }
}
