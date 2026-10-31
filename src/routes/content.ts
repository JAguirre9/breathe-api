import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCurrentUser } from "../lib/session.js";

export const contentRoutes = new Hono();

function handleError(c: Context, err: any) {
  if (err.name === "ZodError") {
    return c.json({ error: "Invalid data", details: err.errors }, 400);
  }
  if (err.code === "P2025") {
    return c.json({ error: "Not found" }, 404);
  }
  console.error(err);
  return c.json({ error: "Server error" }, 500);
}

// Public: list published resources
contentRoutes.get("/resources", async (c) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { published: true },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({ resources });
  } catch (err) {
    return handleError(c, err);
  }
});

// Public: list published merch
contentRoutes.get("/merch", async (c) => {
  try {
    const merch = await prisma.merchItem.findMany({
      where: { published: true },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({ merch });
  } catch (err) {
    return handleError(c, err);
  }
});

// Admin only from here (checked against the database, not just the token)
contentRoutes.use("*", async (c, next) => {
  const user = await getCurrentUser(c);
  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

// POST /content/admin/merch/upload  (multipart field name: "file")
contentRoutes.post("/admin/merch/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return c.json({ error: "Only JPEG, PNG, WebP or GIF allowed" }, 400);
    }

    const maxBytes = 2 * 1024 * 1024; // 2 MB
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > maxBytes) {
      return c.json({ error: "File too large (max 2 MB)" }, 400);
    }

    // Image stored in DB (imageUrl column), not on disk
    const imageUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    return c.json({ imageUrl }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Allows #hex, var(--x), rgb(), hsl(), oklch()... but no ; { } < >
const colorSchema = z
  .string()
  .max(60)
  .regex(/^[a-zA-Z0-9#(),.%\s\-_/]+$/);

const resourceSchema = z.object({
  titleEn: z.string().min(1).max(200),
  titleEs: z.string().min(1).max(200),
  bodyEn: z.string().min(1).max(5000),
  bodyEs: z.string().min(1).max(5000),
  minutes: z.number().int().min(1).max(60).optional(),
  bgColor: colorSchema.optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

contentRoutes.get("/admin/resources", async (c) => {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return c.json({ resources });
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.post("/admin/resources", async (c) => {
  try {
    const body = resourceSchema.parse(await c.req.json());
    const resource = await prisma.resource.create({ data: body });
    return c.json({ resource }, 201);
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.patch("/admin/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = resourceSchema.partial().parse(await c.req.json());
    const resource = await prisma.resource.update({ where: { id }, data: body });
    return c.json({ resource });
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.delete("/admin/resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.resource.delete({ where: { id } });
    return c.json({ ok: true });
  } catch (err) {
    return handleError(c, err);
  }
});

// ---------- Merch (admin) ----------

const merchSchema = z.object({
  nameEn: z.string().min(1).max(120),
  nameEs: z.string().min(1).max(120),
  captionEn: z.string().max(300).nullable().optional(),
  captionEs: z.string().max(300).nullable().optional(),
  // Link to a photo hosted somewhere else. Must be https.
    imageUrl: z
    .string()
    .max(3_500_000)
    .refine(
      (u) =>
        !u ||
        u.startsWith("data:image/") ||
        u.startsWith("https://") ||
        u.startsWith("/uploads/"),
      "Invalid image"
    )
    .nullable()
    .optional(),
});

contentRoutes.get("/admin/merch", async (c) => {
  try {
    const merch = await prisma.merchItem.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return c.json({ merch });
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.post("/admin/merch", async (c) => {
  try {
    const body = merchSchema.parse(await c.req.json());
    const item = await prisma.merchItem.create({ data: body });
    return c.json({ item }, 201);
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.patch("/admin/merch/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = merchSchema.partial().parse(await c.req.json());
    const item = await prisma.merchItem.update({ where: { id }, data: body });
    return c.json({ item });
  } catch (err) {
    return handleError(c, err);
  }
});

contentRoutes.delete("/admin/merch/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.merchItem.delete({ where: { id } });
    return c.json({ ok: true });
  } catch (err) {
    return handleError(c, err);
  }
});