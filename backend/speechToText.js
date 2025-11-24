import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient();

function convertOggToWav(inputPath) {
  const outputPath = inputPath.replace(/\.ogg$/i, ".wav"); // case-insensitive
  try {
    execSync(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${outputPath}"`);
    console.log(`Converted OGG to WAV: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error("Error converting OGG to WAV:", err);
    return null;
  }
}

export async function transcribeAudio(filePath) {
  try {
    let wavFile = filePath;
    if (filePath.toLowerCase().endsWith(".ogg")) {
      wavFile = convertOggToWav(filePath);
      if (!wavFile) throw new Error("Failed to convert audio");
    }

    console.log("Reading audio file:", wavFile);
    const file = fs.readFileSync(wavFile);
    console.log("File size (bytes):", file.length);

    const audioBytes = file.toString("base64");
    const audio = { content: audioBytes };

    const config = {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      audioChannelCount: 1,
    };

    const request = { audio, config };

    console.log("Sending audio to Google Speech-to-Text API...");
    const [response] = await client.recognize(request);
    console.log("Received response from Google Speech API.");

    if (!response.results || response.results.length === 0) {
      console.warn("No transcription results returned.");
      return "";
    }

    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    console.log("Transcription:", transcription);
    return transcription.trim();
  } catch (err) {
    console.error("Google Speech-to-Text transcription error:", err);
    if (err.stack) console.error(err.stack);
    return "";
  }
}
