import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import triviaRoutes from "./routes/trivia.routes";
import { errorHandler } from "./middleware/errorHandler";
import { setupSwagger } from "./config/swagger";
import roomRoutes from "./routes/room.routes";

dotenv.config({ path: ".env" });

const app = express();

// Database connection
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (_, res) => res.send("✅ TriviAndo API is running"));

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/trivia", triviaRoutes);
app.use("/api/v1/rooms", roomRoutes);

// Swagger docs
setupSwagger(app);

// Global error handler
app.use(errorHandler);

export default app;