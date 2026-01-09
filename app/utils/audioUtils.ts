/**
 * Audio utility functions for fetching and converting MP3 files
 */

// Get the exact MP3 as a Blob from its URL.
// This uses fetch and will usually hit the browser cache if the file was just played.
export const fetchMp3Blob = async (url: string): Promise<Blob> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch MP3: ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();
  console.log("Fetched MP3 Blob:", blob);
  return blob;
};

// Load TTS MP3 as Blob and return it
export const loadTtsMp3Blob = async (url: string): Promise<Blob> => {
  try {
    const mp3Blob = await fetchMp3Blob(url);
    console.log("TTS MP3 Blob loaded:", mp3Blob);
    return mp3Blob;
  } catch (blobErr) {
    console.error("Failed to fetch TTS MP3 Blob:", blobErr);
    throw blobErr;
  }
};

// Convert Blob to base64 string (for use with avatar repeatAudio)
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/mp3;base64,")
      const base64 = base64String.split(",")[1] || base64String;
      console.log("Blob converted to base64:", {
        originalLength: base64String.length,
        base64Length: base64.length,
        blobType: blob.type,
        blobSize: blob.size,
      });
      resolve(base64);
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(error);
    };
    reader.readAsDataURL(blob);
  });
};

// Convert Blob to ArrayBuffer
export const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      console.log("Blob converted to ArrayBuffer:", {
        blobType: blob.type,
        blobSize: blob.size,
        arrayBufferSize: arrayBuffer.byteLength,
      });
      resolve(arrayBuffer);
    };
    reader.onerror = (error) => {
      console.error("FileReader error (ArrayBuffer):", error);
      reject(error);
    };
    reader.readAsArrayBuffer(blob);
  });
};

// Fetch MP3 from URL and convert to base64 for avatar use
export const fetchMp3AsBase64 = async (url: string): Promise<string> => {
  try {
    const blob = await loadTtsMp3Blob(url);
    const base64 = await blobToBase64(blob);
    console.log("MP3 converted to base64, length:", base64.length);
    return base64;
  } catch (error) {
    console.error("Failed to fetch and convert MP3 to base64:", error);
    throw error;
  }
};

// Alternative: Fetch MP3 as ArrayBuffer (if avatar SDK accepts it)
export const fetchMp3AsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  try {
    const blob = await loadTtsMp3Blob(url);
    const arrayBuffer = await blobToArrayBuffer(blob);
    console.log("MP3 converted to ArrayBuffer, size:", arrayBuffer.byteLength);
    return arrayBuffer;
  } catch (error) {
    console.error("Failed to fetch and convert MP3 to ArrayBuffer:", error);
    throw error;
  }
};

// Resample audio to target sample rate (24kHz for avatar SDK)
const resampleAudio = (audioBuffer: AudioBuffer, targetSampleRate: number): Float32Array => {
  const sourceSampleRate = audioBuffer.sampleRate;
  const targetLength = Math.round(audioBuffer.length * (targetSampleRate / sourceSampleRate));
  const sourceData = audioBuffer.getChannelData(0);
  const targetData = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = (i * sourceSampleRate) / targetSampleRate;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, sourceData.length - 1);
    const t = sourceIndex - sourceIndexFloor;

    // Linear interpolation
    targetData[i] = sourceData[sourceIndexFloor] * (1 - t) + sourceData[sourceIndexCeil] * t;
  }

  return targetData;
};

// Decode MP3 to PCM using Web Audio API (if avatar SDK needs PCM format)
// Avatar SDK expects PCM at 24kHz sample rate (like ElevenLabs pcm_24000)
export const decodeMp3ToPcm = async (blob: Blob, targetSampleRate: number = 24000): Promise<Float32Array> => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const fileReader = new FileReader();

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        let pcmData = audioBuffer.getChannelData(0); // Get first channel

        // Resample to target sample rate if needed (avatar SDK expects 24kHz)
        if (audioBuffer.sampleRate !== targetSampleRate) {
          console.log(`Resampling from ${audioBuffer.sampleRate}Hz to ${targetSampleRate}Hz`);
          pcmData = resampleAudio(audioBuffer, targetSampleRate);
        }

        console.log("MP3 decoded to PCM:", {
          originalSampleRate: audioBuffer.sampleRate,
          targetSampleRate,
          length: pcmData.length,
          duration: audioBuffer.duration,
        });
        resolve(pcmData);
      } catch (error) {
        console.error("Error decoding MP3:", error);
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(blob);
  });
};

// Convert PCM Float32Array to base64 (for avatar SDK)
// Avatar SDK expects 16-bit PCM in base64 format (like ElevenLabs)
export const pcmToBase64 = (pcmData: Float32Array): string => {
  // Convert Float32Array to Int16Array (16-bit PCM)
  const int16Array = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit integer
    // Standard conversion: multiply by 32767 and round
    const sample = Math.max(-1, Math.min(1, pcmData[i]));
    int16Array[i] = Math.round(sample * 32767);
  }

  // Convert Int16Array to Uint8Array (little-endian)
  // The buffer view automatically handles the conversion
  const uint8Array = new Uint8Array(int16Array.buffer);

  // Convert to base64 using a more reliable method
  // Build binary string in chunks to avoid stack overflow
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    // Use spread operator with slice to avoid Array.from overhead
    binaryString += String.fromCharCode.apply(null, [...chunk]);
  }

  const base64 = btoa(binaryString);

  console.log("PCM converted to base64:", {
    pcmLength: pcmData.length,
    int16Length: int16Array.length,
    uint8Length: uint8Array.length,
    base64Length: base64.length,
  });

  return base64;
};

// Fetch MP3 and convert to PCM base64 (for avatar SDK that expects PCM)
export const fetchMp3AsPcmBase64 = async (url: string): Promise<string> => {
  try {
    const blob = await loadTtsMp3Blob(url);
    const pcmData = await decodeMp3ToPcm(blob);
    const base64 = pcmToBase64(pcmData);
    console.log("MP3 converted to PCM base64, length:", base64.length);
    return base64;
  } catch (error) {
    console.error("Failed to fetch and convert MP3 to PCM base64:", error);
    throw error;
  }
};

// Example helper: fetch MP3 as Blob, play it via Howler, and auto-cleanup URL.
// Note: Requires 'howler' package to be installed
// Uncomment and use if you need to play audio directly with Howler
/*
import { Howl } from 'howler';

export const playGCSMp3 = async (url: string) => {
  const blob = await fetchMp3Blob(url);
  const audioUrl = URL.createObjectURL(blob);

  const sound = new Howl({
    src: [audioUrl],
    format: ['mp3'],
    onload: () => URL.revokeObjectURL(audioUrl), // Auto-cleanup
  });

  sound.play();
};
*/

