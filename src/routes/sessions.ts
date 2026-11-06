import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCurrentUser } from "../lib/session.js";

export const sessionsRoutes = new Hono();

const db = prisma as any;

const sessionSchema = z.object({
  date: z.string().min(8),
  time: z.string().min(1),
  title: z.string().min(1),
  specialist: z.string().optional().nullable(),
});

function todayInColombia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// GETall sessions
sessionsRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const sessions = await db.session.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return c.json({ sessions });
});

// POST create session
sessionsRoutes.post("/", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const data = sessionSchema.parse(body);

    // can't schedule in the past 
    if (data.date < todayInColombia()) {
      return c.json(
        { error: "No se puede agendar una sesión en el pasado" },
        400
      );
    }

    // a session per day 
    const existing = await db.session.findFirst({
      where: {
        userId: user.id,
        date: data.date,
      },
    });

    if (existing) {
      return c.json(
        { error: "Ya tienes una sesión agendada para este día" },
        400
      );
    }

    const session = await db.session.create({
      data: {
        userId: user.id,
        date: data.date,
        time: data.time,
        title: data.title,
        specialist: data.specialist || null,
      },
    });

    return c.json({ session }, 201);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

// DELETE session
sessionsRoutes.delete("/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const existing = await db.session.findUnique({ where: { id } });

  if (!existing || existing.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  await db.session.delete({ where: { id } });
  return c.json({ ok: true });
});