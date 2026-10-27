import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCurrentUser } from "../lib/session.js";

export const tasksRoutes = new Hono();

const createSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
});

const updateSchema = z.object({ done: z.boolean() });

// GET /tasks -> the logged-in patient's tasks
tasksRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const tasks = await prisma.task.findMany({
    where: { patientId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, done: true, createdAt: true },
  });
  return c.json({ tasks });
});

// POST /tasks -> specialist or admin assigns a task to a patient
tasksRoutes.post("/", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role !== "PSYCHOLOGIST" && user.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const data = createSchema.parse(await c.req.json());
    const patient = await prisma.user.findUnique({ where: { id: data.patientId } });
    if (!patient || patient.role !== "PATIENT") {
      return c.json({ error: "Patient not found" }, 404);
    }

    const task = await prisma.task.create({
      data: {
        patientId: data.patientId,
        createdById: user.id,
        title: data.title,
        description: data.description || null,
      },
    });
    return c.json({ task }, 201);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

// PATCH /tasks/:id -> patient checks or unchecks their own task
tasksRoutes.patch("/:id", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const { done } = updateSchema.parse(await c.req.json());

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.patientId !== user.id) {
      return c.json({ error: "Not found" }, 404);
    }

    const task = await prisma.task.update({ where: { id }, data: { done } });
    return c.json({ task });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});