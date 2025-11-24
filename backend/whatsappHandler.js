import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { transcribeAudioAssemblyAI } from "./transcribeWhisper.js";
import { parseOrderFromText, formatOrderConfirmation } from "./utils.js";
import { addOrder } from "./orderStore.js";

const __dirname = process.cwd();

// Ensure uploads dir exists
const UPLOADS_DIR = path.join(__dirname, "uploads", "voices");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Convert OGG/Opus to MP3
function convertOggToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .on("error", reject)
      .on("end", () => resolve(outputPath))
      .save(outputPath);
  });
}

export async function handleTwilioWebhook(req, res) {
  const io = req.app.get("io");

  console.log("------ Incoming WhatsApp Message ------");
  console.log(`📩 Payload: ${JSON.stringify(req.body, null, 2)}`);

  const from = req.body.From || req.body.from || "unknown";
  const bodyText = (req.body.Body || req.body.body || "").trim();
  const numMedia = parseInt(req.body.NumMedia || req.body.numMedia || "0", 10);

  const mediaUrl =
    req.body.MediaUrl0 ||
    req.body.mediaUrl0 ||
    req.body.MediaUrl ||
    req.body.mediaUrl ||
    null;

  const contentType =
    req.body.MediaContentType0 ||
    req.body.mediaContentType0 ||
    req.body.MediaContentType ||
    req.body.mediaContentType ||
    "";

  console.log(`➡ From: ${from}`);
  console.log(`➡ Text: "${bodyText}"`);
  console.log(`➡ Media Count: ${numMedia}`);
  if (numMedia > 0) {
    console.log(`🎵 Media URL: ${mediaUrl}`);
    console.log(`📄 Content-Type: ${contentType}`);
  }
  console.log("---------------------------------------");

  let finalText = bodyText;

  if (numMedia > 0 && mediaUrl) {
    try {
      const auth = {
        username: process.env.TWILIO_ACCOUNT_SID || "",
        password: process.env.TWILIO_AUTH_TOKEN || "",
      };

      const mediaRes = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth,
      });

      console.log(`📥 Media downloaded: ${mediaRes.data.byteLength} bytes`);

      const lowerType = (contentType || "").toLowerCase();
      let ext = "bin";
      if (lowerType.includes("ogg") || lowerType.includes("opus")) ext = "ogg";
      else if (lowerType.includes("mp3")) ext = "mp3";
      else if (lowerType.includes("wav")) ext = "wav";
      else if (lowerType.includes("mpeg")) ext = "mp3";

      const fileName = `voice_${Date.now()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      fs.writeFileSync(filePath, mediaRes.data);
      console.log(`🎙 Voice message saved: ${filePath}`);

      let mp3Path = filePath;

      // Convert if OGG
      if (ext === "ogg") {
        try {
          mp3Path = filePath.replace(/\.ogg$/, ".mp3");
          await convertOggToMp3(filePath, mp3Path);
          console.log(`🎵 Converted ${filePath} to MP3: ${mp3Path}`);
        } catch (convErr) {
          console.error("🚨 Error converting OGG to MP3:", convErr.message);
        }
      }

      // Transcribe if audio
      if (
        lowerType.startsWith("audio") ||
        ["ogg", "mp3", "wav"].includes(ext)
      ) {
        try {
          console.log(`🗣 Starting transcription with Whisper on file: ${mp3Path}`);
          finalText = await transcribeAudioAssemblyAI(mp3Path);
          console.log(`📝 Transcription Result: "${finalText}"`);
        } catch (err) {
          console.error("🚨 Whisper transcription error:", err?.message || err);
          finalText = bodyText || "";
        }
      } else {
        console.log("❌ Media is not audio — using text body instead.");
        finalText = bodyText;
      }
    } catch (err) {
      console.error(
        "🚨 Error downloading media from Twilio:",
        err?.response?.data || err?.message || err
      );
      io?.emit("message", { from, text: "[media download error]" });
      return res.sendStatus(200);
    }
  }

  // Emit raw message
  io?.emit("message", { from, text: finalText });

  // Parse order
  const order = parseOrderFromText(finalText || "");
  if (!order) {
    console.log("❌ Could not parse order from text.");
    try {
      await replyViaTwilio(
        from,
        "Sorry, I couldn't understand your order. Example: '2 parota' or 'one parota'."
      );
    } catch (err) {
      console.error(
        "🚨 Failed to send Twilio reply:",
        err?.response?.data || err?.message || err
      );
    }
    return res.sendStatus(200);
  }

  console.log("✅ Parsed order:", order);

  const saved = addOrder({ from, ...order });

  const confirmationText = formatOrderConfirmation(saved);
  try {
    console.log("📤 Sending confirmation to user...");
    await replyViaTwilio(from, confirmationText);
    console.log("✅ Confirmation sent.");
  } catch (err) {
    console.error(
      "🚨 Failed to send Twilio confirmation:",
      err?.response?.data || err?.message || err
    );
  }

  io?.emit("order", saved);

  return res.sendStatus(200);
}

// Twilio WhatsApp reply helper
async function replyViaTwilio(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not set in env");
  }

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", `whatsapp:${fromNumber}`);
  params.append("Body", message);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: { username: accountSid, password: authToken },
  });
  return res.data;
}
