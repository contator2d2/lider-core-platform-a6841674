import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.routes.js";
import { orgsRouter } from "./routes/organizations.routes.js";

const app = express();

app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes("*");
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Same-origin / server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (allowAll) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Do NOT throw — throwing prevents CORS headers on the response.
    // Simply omit the header so the browser blocks it with a clear message.
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/auth", authRouter);
app.use("/organizations", orgsRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on :${env.PORT}`);
});