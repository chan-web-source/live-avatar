"use client";

import { useState } from "react";
import { LiveAvatarSession } from "./streaming-avatar";
import { startFullModeSession } from "../utils/api";
import { startCustomModeSession } from "../hooks/api";

export const LiveAvatarSection = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [error, setError] = useState<string | null>(null);

  const handleStartFullModeSession = async () => {
    try {
      const { session_token } = await startFullModeSession();
      setSessionToken(session_token);
      setMode("FULL");
    } catch (error: unknown) {
      setError((error as Error).message);
    }
  };

  const handleStartCustomModeSession = async () => {
    try {
      const { session_token } = await startCustomModeSession();
      setSessionToken(session_token);
      setMode("CUSTOM");
    } catch (error: unknown) {
      setError((error as Error).message);
    }
  };

  const onSessionStopped = () => {
    // Reset the FE state
    setSessionToken("");
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-xl">
      {!sessionToken ? (
        <>
          {error && (
            <div className="text-red-500 text-2xl">
              {"Error getting session token: " + error}
            </div>
          )}
          <button
            onClick={handleStartFullModeSession}
            className="w-fit bg-white text-black px-6 py-3 rounded-md text-xl font-semibold"
          >
            Start Full Avatar Session
          </button>

          <button
            onClick={handleStartCustomModeSession}
            className="w-fit bg-white text-black px-6 py-3 rounded-md text-xl font-semibold"
          >
            Start Custom Avatar Session
          </button>
        </>
      ) : (
        <LiveAvatarSession
          mode={mode}
          sessionAccessToken={sessionToken}
          onSessionStopped={onSessionStopped}
        />
      )}
    </div>
  );
};
