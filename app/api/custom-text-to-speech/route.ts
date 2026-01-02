import { NEXT_PUBLIC_STT_API } from "../secrets";

export async function POST(request: Request) {
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

