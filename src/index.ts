import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { intakeRoutes } from "./routes/intake.js";
import { adminRoutes } from "./routes/admin.js";
import { journalRoutes } from "./routes/journal.js";
import { sessionsRoutes } from "./routes/sessions.js";

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

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/intake", intakeRoutes);
app.route("/admin", adminRoutes);
app.route("/journal", journalRoutes);
app.route("/sessions", sessionsRoutes);

app.get("/", (c) => c.json({ message: "Breathe API is running" }));

const port = Number(process.env.PORT) || 3001;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Breathe API running on http://localhost:${port}`);