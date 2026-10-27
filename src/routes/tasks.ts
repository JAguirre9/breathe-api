import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCurrentUser } from "../lib/session.js";

export const tasksRoutes = new Hono();

// Roles allowed to create/edit/delete tasks. Specialists are already included.
const MANAGER_ROLES = ["ADMIN", "PSYCHOLOGIST"];

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  done: z.boolean().optional(),
});

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
    if (!MANAGER_ROLES.includes(user.role)) {
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

// PATCH /tasks/:id
// Patient: can only check/uncheck their own task. Admin/specialist: can edit anything.
tasksRoutes.patch("/:id", async (c) => {
  try {
    const user = await getCurrentUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const body = patchSchema.parse(await c.req.json());

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const isManager = MANAGER_ROLES.includes(user.role);
    if (!isManager && existing.patientId !== user.id) {
      return c.json({ error: "Not found" }, 404);
    }

    const data = isManager ? body : { done: body.done };
    const task = await prisma.task.update({ where: { id }, data });
    return c.json({ task });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

// GET /tasks/patient/:patientId -> tasks of one patient (admin/specialist)
tasksRoutes.get("/patient/:patientId", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!MANAGER_ROLES.includes(user.role)) return c.json({ error: "Forbidden" }, 403);

  const tasks = await prisma.task.findMany({
    where: { patientId: c.req.param("patientId") },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, done: true, createdAt: true },
  });
  return c.json({ tasks });
});

// DELETE /tasks/:id (admin/specialist)
tasksRoutes.delete("/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!MANAGER_ROLES.includes(user.role)) return c.json({ error: "Forbidden" }, 403);

  const id = c.req.param("id");
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  await prisma.task.delete({ where: { id } });
  return c.json({ ok: true });
});