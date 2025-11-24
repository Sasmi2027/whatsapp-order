// server.js
import { File } from "node:buffer";

// Polyfill global File if not present (needed for some SDKs on Node <20)
if (!globalThis.File) {
  globalThis.File = File;
}

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { handleTwilioWebhook } from "./whatsappHandler.js";
import { getOrders } from "./orderStore.js";

dotenv.config();

const app = express();

// CORS config - allow frontend origin or default to localhost:3000
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:300
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Twilio sends application/x-www-form-urlencoded by default.
// Allow both urlencoded and json (with reasonable limits)
app.use(bodyParser.urlencoded({ extended: false, limit: "2mb" }));
app.use(bodyParser.json({ limit: "2mb" }));

// Basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Ensure uploads/voices directory exists (so static server won't error)
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const VOICES_DIR = path.join(UPLOADS_DIR, "voices");
if (!fs.existsSync(VOICES_DIR)) {
  fs.mkdirSync(VOICES_DIR, { recursive: true });
}

// Serve voice files statically so you can open/play them at
// http://localhost:5000/uploads/voices/<filename>.ogg or .mp3
app.use("/uploads", express.static(UPLOADS_DIR, { index: false }));

// Root route to avoid "Cannot GET /"
app.get("/", (req, res) => {
  res.send(
    "✅ Backend is running! Endpoints: /api/orders, /api/twilio/webhook (POST), /uploads/voices/"
  );
});

const httpServer = createServer(app);

// Socket.IO for real-time messages (if your handler emits via io)
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGIN, methods: ["GET", "POST"] },
});

// Make io available to handlers via req.app.get("io")
app.set("io", io);

// Twilio webhook route — ensure Twilio is configured with this URL
// Keep try/catch in case handler throws
app.post("/api/twilio/webhook", async (req, res) => {
  try {
    await handleTwilioWebhook(req, res);
  } catch (err) {
    console.error("Unhandled error in webhook:", err);
    // try to always respond 200 for Twilio (so it won't retry endlessly)
    try {
      res.sendStatus(500);
    } catch (e) {
      console.warn("Unable to send error status to Twilio:", e?.message || e);
    }
  }
});

// Orders endpoint for your frontend
app.get("/api/orders", (req, res) => {
  try {
    const orders = getOrders();
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Optional: list all saved voice files (safe preview endpoint)
app.get("/api/voices", (req, res) => {
  try {
    const files = fs.readdirSync(VOICES_DIR).filter((f) => !f.startsWith("."));
    // return simple metadata (filename + url)
    const host = req.get("host");
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const base = `${proto}://${host}`;
    const list = files.map((f) => ({
      filename: f,
      url: `${base}/uploads/voices/${encodeURIComponent(f)}`,
    }));
    res.json(list);
  } catch (err) {
    console.error("Error listing voices:", err);
    res.status(500).json({ error: "Failed to list voice files" });
  }
});

// Health endpoint
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Socket.io connection logging (optional)
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Start server
const PORT = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`Uploads (voices) served at /uploads/voices/`);
});
