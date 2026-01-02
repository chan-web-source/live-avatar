"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useTextChat,
  useVoiceChat,
} from "../liveavatar";
import { SessionState } from "@heygen/liveavatar-web-sdk";
import { useAvatarActions } from "../liveavatar/useAvatarActions";

const Button: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-white text-black px-4 py-2 rounded-md"
    >
      {children}
    </button>
  );
};

const LiveAvatarSessionComponent: React.FC<{
  mode: "FULL" | "CUSTOM";
  onSessionStopped: () => void;
}> = ({ mode, onSessionStopped }) => {
  const [message, setMessage] = useState("");
  const {
    sessionState,
    isStreamReady,
    startSession,
    stopSession,
    connectionQuality,
    keepAlive,
    attachElement,
  } = useSession();
  const {
    isAvatarTalking,
    isUserTalking,
    isMuted,
    isActive,
    isLoading,
    start,
    stop,
    mute,
    unmute,
  } = useVoiceChat();

  const { interrupt, repeat, startListening, stopListening } =
    useAvatarActions(mode);

  const { sendMessage } = useTextChat(mode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [attachElement, isStreamReady]);

  // Chroma key background removal effect
  useEffect(() => {
    if (!isStreamReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Set canvas size to match video
    const updateCanvasSize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      } else {
        // Fallback to container size
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
      }
    };

    // Wait for video metadata
    const handleLoadedMetadata = () => {
      updateCanvasSize();
    };

    if (video.readyState >= video.HAVE_METADATA) {
      updateCanvasSize();
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Chroma key color to remove (#7ac769)
    const chromaColor = { r: 122, g: 199, b: 105 };
    const threshold = 50; // Color matching threshold

    let animationFrameId: number;

    const drawFrame = () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        // Update canvas size if video dimensions changed
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Calculate color distance
          const distance = Math.sqrt(
            Math.pow(r - chromaColor.r, 2) +
            Math.pow(g - chromaColor.g, 2) +
            Math.pow(b - chromaColor.b, 2)
          );

          // If color is close to chroma key, make it transparent
          if (distance < threshold) {
            data[i + 3] = 0; // Set alpha to 0 (transparent)
          }
        }

        ctx.putImageData(imageData, 0, 0);
      }
      animationFrameId = requestAnimationFrame(drawFrame);
    };

    // Start drawing after a small delay to ensure video is ready
    const timeoutId = setTimeout(() => {
      drawFrame();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isStreamReady]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      startSession();
    }
  }, [startSession, sessionState]);

  const VoiceChatComponents = (
    <>
      <p>Voice Chat Active: {isActive ? "true" : "false"}</p>
      <p>Voice Chat Loading: {isLoading ? "true" : "false"}</p>
      {isActive && <p>Muted: {isMuted ? "true" : "false"}</p>}
      <Button
        onClick={() => {
          if (isActive) {
            stop();
          } else {
            start();
          }
        }}
        disabled={isLoading}
      >
        {isActive ? "Stop Voice Chat" : "Start Voice Chat"}
      </Button>
      {isActive && (
        <Button
          onClick={() => {
            if (isMuted) {
              unmute();
            } else {
              mute();
            }
          }}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>
      )}
    </>
  );

  return (
    <div className="w-[1080px] max-w-full h-full flex flex-col items-center justify-center gap-4 py-4">
      <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        />
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ position: "relative", zIndex: 1 }}
        />
        <button
          className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 rounded-md"
          onClick={() => stopSession()}
        >
          Stop
        </button>
      </div>
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <p>Session state: {sessionState}</p>
        <p>Connection quality: {connectionQuality}</p>
        {mode === "FULL" && (
          <p>User talking: {isUserTalking ? "true" : "false"}</p>
        )}
        <p>Avatar talking: {isAvatarTalking ? "true" : "false"}</p>
        {mode === "FULL" && VoiceChatComponents}
        <Button
          onClick={() => {
            keepAlive();
          }}
        >
          Keep Alive
        </Button>
        <div className="w-full h-full flex flex-row items-center justify-center gap-4">
          <Button
            onClick={() => {
              startListening();
            }}
          >
            Start Listening
          </Button>
          <Button
            onClick={() => {
              stopListening();
            }}
          >
            Stop Listening
          </Button>
          <Button
            onClick={() => {
              interrupt();
            }}
          >
            Interrupt
          </Button>
        </div>
        <div className="w-full h-full flex flex-row items-center justify-center gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-[400px] bg-white text-black px-4 py-2 rounded-md"
          />
          <Button
            onClick={() => {
              // Always use hardcoded message
              sendMessage("hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you");
              setMessage("");
            }}
          >
            Send
          </Button>
          <Button
            onClick={() => {
              // Always use hardcoded message
              repeat("hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you hi lucky how are you");
              setMessage("");
            }}
          >
            Repeat
          </Button>
        </div>
      </div>
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  mode: "FULL" | "CUSTOM";
  sessionAccessToken: string;
  onSessionStopped: () => void;
}> = ({ mode, sessionAccessToken, onSessionStopped }) => {
  return (
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken}>
      <LiveAvatarSessionComponent
        mode={mode}
        onSessionStopped={onSessionStopped}
      />
    </LiveAvatarContextProvider>
  );
};
