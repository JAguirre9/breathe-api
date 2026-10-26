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

// POST /admin/patients/:id/activate
adminRoutes.post("/patients/:id/activate", async (c) => {
  try {
    const id = c.req.param("id");
    const { password } = activateSchema.parse(await c.req.json());

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

    return c.json({ ok: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});