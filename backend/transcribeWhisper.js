// transcribeAssemblyAI.js
import fs from "fs";
import axios from "axios";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY ||"a3c453dc324345dba8d1a88807c00308";
if (!ASSEMBLYAI_API_KEY) {
  throw new Error("Missing AssemblyAI API key in ASSEMBLYAI_API_KEY env variable");
}

async function uploadAudio(filePath) {
  const readStream = fs.createReadStream(filePath);

  const response = await axios.post("https://api.assemblyai.com/v2/upload", readStream, {
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "Transfer-Encoding": "chunked",
    },
  });

  return response.data.upload_url;
}

async function requestTranscription(audioUrl) {
  const response = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    { audio_url: audioUrl },
    {
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.id;
}

async function getTranscriptionResult(transcriptId) {
  while (true) {
    const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
    });

    if (response.data.status === "completed") {
      return response.data.text;
    } else if (response.data.status === "error") {
      throw new Error("Transcription failed: " + response.data.error);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export async function transcribeAudioAssemblyAI(filePath) {
  try {
    const uploadUrl = await uploadAudio(filePath);
    const transcriptId = await requestTranscription(uploadUrl);
    const text = await getTranscriptionResult(transcriptId);
    return text;
  } catch (error) {
    console.error("AssemblyAI transcription error:", error);
    return "";
  }
}
