import "dotenv/config";
import http from "http";
import app from "./app.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import projectModel from "./models/project.model.js";
import { generateResult } from "./services/ai.service.js";

const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// io.use(async (socket, next) => {
//   try {
//     const token =
//       socket.handshake.auth?.token ||
//       socket.handshake.headers.authorization?.split(" ")[1];
//     const projectId = socket.handshake.query.projectId;

//     if (!mongoose.Types.ObjectId.isValid(projectId)) {
//       return next(new Error("Invalid projectId"));
//     }

//     socket.project = await projectModel.findById(projectId);

//     if (!token) {
//       return next(new Error("Authentication error"));
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     if (!decoded) {
//       return next(new Error("Authentication error"));
//     }

//     socket.user = decoded;

//     next();
//   } catch (error) {
//     next(error);
//   }
// });
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.split(" ")[1];
    const projectId = socket.handshake.query.projectId;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return next(new Error("Invalid projectId"));
    }

    const project = await projectModel.findById(projectId);

    if (!project) {
      return next(new Error("Project not found"));
    }

    socket.project = project;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      return next(new Error("Authentication error"));
    }

    socket.user = decoded;

    next();
  } catch (error) {
    next(error);
  }
});

// io.on("connection", (socket) => {
//   socket.roomId = socket.project._id.toString();

//   console.log("a user connected");

//   socket.join(socket.roomId);

//   socket.on("project-message", async (data) => {
//     const message = data.message;

//     const aiIsPresentInMessage = message.includes("@ai");
//     socket.broadcast.to(socket.roomId).emit("project-message", data);

//     if (aiIsPresentInMessage) {
//       const prompt = message.replace("@ai", "");

//       const result = await generateResult(prompt);

//       io.to(socket.roomId).emit("project-message", {
//         message: result,
//         sender: {
//           _id: "ai",
//           email: "AI",
//         },
//       });

//       return;
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log("user disconnected");
//     socket.leave(socket.roomId);
//   });
// });

// Update the socket.io connection handler
io.on("connection", (socket) => {
  socket.roomId = socket.project._id.toString();
  console.log(`User ${socket.user.email} connected to project ${socket.roomId}`);

  socket.join(socket.roomId);

  // Notify others of new connection
  socket.to(socket.roomId).emit("user-connected", {
    userId: socket.user.email,
    timestamp: new Date()
  });

  // Enhanced project-message handler
  socket.on("project-message", async (data) => {
    const { message, context } = data;
    
    // Broadcast to all in room including sender
    io.to(socket.roomId).emit("project-message", {
      ...data,
      timestamp: new Date()
    });

    if (message.includes("@ai")) {
      try {
        const prompt = message.replace("@ai", "").trim();
        const result = await generateResult(prompt, context);
        
        io.to(socket.roomId).emit("project-message", {
          message: result.text,
          sender: { _id: "ai", email: "AI Assistant" },
          metadata: result.metadata,
          timestamp: new Date()
        });
      } catch (error) {
        console.error("AI processing error:", error);
      }
    }
  });

  // Code review system
  socket.on("code-review", async ({ code, filePath }) => {
    try {
      const review = await aiService.optimizeCode(code);
      socket.emit("code-review-result", {
        filePath,
        suggestions: review.metadata.suggestions
      });
    } catch (error) {
      console.error("Code review error:", error);
    }
  });

  // Presence tracking
  socket.on("cursor-position", (position) => {
    socket.to(socket.roomId).emit("user-cursor-update", {
      userId: socket.user.email,
      position
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.user.email} disconnected`);
    socket.to(socket.roomId).emit("user-disconnected", {
      userId: socket.user.email,
      timestamp: new Date()
    });
    socket.leave(socket.roomId);
  });
});
server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
