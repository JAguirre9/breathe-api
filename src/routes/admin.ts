import { Hono } from "hono";
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyToken } from "../lib/auth.js";

export const adminRoutes = new Hono();

const activateSchema = z.object({
  password: z.string().min(6),
});

// Only logged-in admins may use these routes
adminRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "breathe_session");
  const payload = token ? await verifyToken(token) : null;

  if (!payload || payload.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
});

// GET /admin/patients/pending
adminRoutes.get("/patients/pending", async (c) => {
  try {
    const patients = await prisma.user.findMany({
      where: {
        role: "PATIENT",
        status: "PENDING",
      },
      include: {
        patientProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return c.json({ patients });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

// POST /admin/patients/:id/activate
adminRoutes.post("/patients/:id/activate", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { password } = activateSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.role !== "PATIENT") {
      return c.json({ error: "Patient not found" }, 404);
    }

    await prisma.user.update({
      where: { id },
      data: {
        password: await hashPassword(password),
        status: "ACTIVE",
        isActive: true,
      },
    });

    return c.json({
      ok: true,
      message: "Patient activated. Send the password manually.",
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});

// GET /admin/patients -> active patients
adminRoutes.get("/patients", async (c) => {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT", status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });
  return c.json({ patients });
});