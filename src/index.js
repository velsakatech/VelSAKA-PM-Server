import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import dashboardRoutes from "./routes/dashboardRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import projectDocumentRoutes from "./routes/projectDocumentRoutes.js";

import User from "./models/User.js";
import Notification from "./models/Notification.js";

const app = express();

const server = http.createServer(app);

// =========================================================
// PATH CONFIG
// =========================================================

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// =========================================================
// CONFIG
// =========================================================

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const PORT = process.env.PORT || 5000;

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());

// =========================================================
// STATIC UPLOADS
// =========================================================

const uploadsPath = path.join(__dirname, "../uploads");

app.use("/uploads", express.static(uploadsPath));

// =========================================================
// DATABASE
// =========================================================

await connectDB();

// =========================================================
// REST ROUTES
// =========================================================

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/users", userRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/projects", projectRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/project-documents", projectDocumentRoutes);

app.use("/api/admin", adminRoutes);

// =========================================================
// BASIC HEALTH CHECK
// =========================================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "VELSAKA PM API is running.",
  });
});

// =========================================================
// SOCKET.IO
// =========================================================

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: ["websocket", "polling"],
});

// =========================================================
// SOCKET CONNECTION
// =========================================================

io.on("connection", (socket) => {
  console.log("=================================");

  console.log("SOCKET CLIENT CONNECTED");

  console.log("Socket ID:", socket.id);

  console.log("=================================");

  // =======================================================
  // JOIN PERSONAL USER ROOM
  // =======================================================

  socket.on("join_user", (userId) => {
    if (!userId) {
      console.log("join_user called without userId");

      return;
    }

    const room = String(userId);

    socket.join(room);

    console.log(`User ${room} joined room`);

    console.log("Socket ID:", socket.id);

    socket.emit("joined_user", {
      userId: room,
      room,
    });
  });

  // =======================================================
  // SEND MESSAGE
  // =======================================================

  socket.on("send_message", async (payload, callback) => {
    try {
      const { senderId, receiverId, message } = payload || {};

      console.log("=================================");

      console.log("SOCKET SEND MESSAGE");

      console.log("Sender:", senderId);

      console.log("Receiver:", receiverId);

      console.log("Message:", message);

      console.log("=================================");

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!senderId || !receiverId || !message?.trim()) {
        const errorResponse = {
          success: false,
          message: "Sender, receiver and message are required.",
        };

        socket.emit("message_error", errorResponse);

        if (typeof callback === "function") {
          callback(errorResponse);
        }

        return;
      }

      // -------------------------------------------------
      // CHECK SENDER
      // -------------------------------------------------

      const sender = await User.findById(senderId);

      if (!sender) {
        const errorResponse = {
          success: false,
          message: "Sender not found.",
        };

        socket.emit("message_error", errorResponse);

        if (typeof callback === "function") {
          callback(errorResponse);
        }

        return;
      }

      // -------------------------------------------------
      // CHECK RECEIVER
      // -------------------------------------------------

      const receiver = await User.findById(receiverId);

      if (!receiver) {
        const errorResponse = {
          success: false,
          message: "Receiver not found.",
        };

        socket.emit("message_error", errorResponse);

        if (typeof callback === "function") {
          callback(errorResponse);
        }

        return;
      }

      // -------------------------------------------------
      // SAVE MESSAGE
      // -------------------------------------------------

      const newMessage = await ChatMessage.create({
        senderId,
        receiverId,
        message: message.trim(),
        read: false,
      });

      // -------------------------------------------------
      // POPULATE MESSAGE
      // -------------------------------------------------

      const populatedMessage = await ChatMessage.findById(newMessage._id)
        .populate("senderId", "name email accessRole jobRole")
        .populate("receiverId", "name email accessRole jobRole");

      // -------------------------------------------------
      // SEND TO SENDER
      // -------------------------------------------------

      io.to(String(senderId)).emit("message_sent", populatedMessage);

      // -------------------------------------------------
      // SEND TO RECEIVER
      // -------------------------------------------------

      io.to(String(receiverId)).emit("new_message", populatedMessage);

      // -------------------------------------------------
      // ACKNOWLEDGEMENT
      // -------------------------------------------------

      const successResponse = {
        success: true,
        message: populatedMessage,
      };

      if (typeof callback === "function") {
        callback(successResponse);
      }

      console.log("MESSAGE SAVED + DELIVERED");
    } catch (error) {
      console.error("SOCKET SEND MESSAGE ERROR:", error);

      const errorResponse = {
        success: false,
        message: "Failed to send message.",
      };

      socket.emit("message_error", errorResponse);

      if (typeof callback === "function") {
        callback(errorResponse);
      }
    }
  });

  // =======================================================
  // DISCONNECT
  // =======================================================

  socket.on("disconnect", (reason) => {
    console.log("=================================");

    console.log("SOCKET DISCONNECTED");

    console.log("Socket ID:", socket.id);

    console.log("Reason:", reason);

    console.log("=================================");
  });
});

// =========================================================
// GLOBAL ERROR HANDLER
// =========================================================

app.use((error, req, res, next) => {
  console.error("GLOBAL SERVER ERROR:", error);

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size must be 10 MB or less.",
    });
  }

  if (error?.message?.includes("Unsupported file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// =========================================================
// START SERVER
// =========================================================

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  console.log(`Socket.IO running on http://localhost:${PORT}`);

  console.log(`Project uploads available at http://localhost:${PORT}/uploads`);
});


app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "VELSAKA PM API is running.",
  });
});