import { Express } from "express";
import cors, { CorsOptions } from "cors";
import { env } from "@config";

const allowedOrigins = new Set(
  [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"].filter(
    Boolean,
  ),
);

const ngrokRegex = /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/;

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl
    const allowed =
      allowedOrigins.has(origin) || (env.IS_DEV && ngrokRegex.test(origin));
    if (allowed) return callback(null, true); // reflect request origin, never "*"
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const initCors = (app: Express) => {
  app.use(cors(corsOptions));
  // Enable preflight for all routes using regex pattern
  app.options(/.*/, cors(corsOptions));
};

export default initCors;
