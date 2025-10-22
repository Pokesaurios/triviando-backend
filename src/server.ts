import http from "http";
import app from "./app";
import { initSocketServer } from "./socket";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});