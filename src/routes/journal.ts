import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCurrentUser } from "../lib/session.js";

export const journalRoutes = new Hono();

const entrySchema = z.object({
  date: z.string().min(8),
  title: z.string().min(1),
  mood: z.number().int().min(1).max(5),
  text: z.string().default(""),
});

journalRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ entries });
});

journalRoutes.post("/", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const data = entrySchema.parse(body);

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        date: data.date,
        title: data.title,
        mood: data.mood,
        text: data.text,
      },
    });

    return c.json({ entry }, 201);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

journalRoutes.put("/:id", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const body = await c.req.json();
    const data = entrySchema.parse(body);

    const existing = await prisma.journalEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return c.json({ error: "Not found" }, 404);
    }

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        date: data.date,
        title: data.title,
        mood: data.mood,
        text: data.text,
      },
    });

    return c.json({ entry });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

journalRoutes.delete("/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const existing = await prisma.journalEntry.findUnique({ where: { id } });

  if (!existing || existing.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  await prisma.journalEntry.delete({ where: { id } });
  return c.json({ ok: true });
});