import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { rateLimit } from "./lib/rate-limit.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { intakeRoutes } from "./routes/intake.js";
import { adminRoutes } from "./routes/admin.js";
import { journalRoutes } from "./routes/journal.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { tasksRoutes } from "./routes/tasks.js";
import { contentRoutes } from "./routes/content.js";

const app = new Hono();
const isProd = process.env.NODE_ENV === "production";

app.use(
  "*",
  cors({
    origin: isProd
      ? ["https://your-frontend-domain.com"]
      : ["http://localhost:8080", "http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use("*", secureHeaders({ crossOriginResourcePolicy: false }));
app.use(
  "*",
  bodyLimit({
    maxSize: 100 * 1024, // 100 KB is plenty for this API
    onError: (c) => c.json({ error: "Payload too large" }, 413),
  })
);

// Brute-force / spam protection (counted per IP)
app.use("/auth/login", rateLimit("login", 10, 15 * 60_000));
app.use("/intake/*", rateLimit("intake", 5, 60 * 60_000));

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/intake", intakeRoutes);
app.route("/admin", adminRoutes);
app.route("/journal", journalRoutes);
app.route("/sessions", sessionsRoutes);
app.route("/tasks", tasksRoutes);
app.route("/content", contentRoutes);

app.get("/", (c) => c.json({ message: "Breathe API is running" }));

const port = Number(process.env.PORT) || 3001;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Breathe API running on http://localhost:${port}`);