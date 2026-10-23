import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";

const app = new Hono();
const isProd = process.env.NODE_ENV === "production";

app.use(
  "*",
  cors({
    origin: isProd
      ? ["https://your-frontend-domain.com"]
      : ["http://localhost:8080", "http://localhost:5173"],
    credentials: true,
  })
);

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);

app.get("/", (c) => c.json({ message: "Breathe API is running" }));

const port = Number(process.env.PORT) || 3001;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Breathe API running on http://localhost:${port}`);
