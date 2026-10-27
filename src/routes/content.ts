import { Hono } from "hono";
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../lib/auth.js";

export const contentRoutes = new Hono();

// Public: list published resources
contentRoutes.get("/resources", async (c) => {
  const resources = await prisma.resource.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  });
  return c.json({ resources });
});

// Admin only from here
contentRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "breathe_session");
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

contentRoutes.get("/admin/resources", async (c) => {
  const resources = await prisma.resource.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return c.json({ resources });
});

const resourceSchema = z.object({
  titleEn: z.string().min(1),
  titleEs: z.string().min(1),
  bodyEn: z.string().min(1),
  bodyEs: z.string().min(1),
  minutes: z.number().int().min(1).max(60).optional(),
  bgColor: z.string().optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

contentRoutes.post("/admin/resources", async (c) => {
  const body = resourceSchema.parse(await c.req.json());
  const resource = await prisma.resource.create({ data: body });
  return c.json({ resource }, 201);
});

contentRoutes.patch("/admin/resources/:id", async (c) => {
  const id = c.req.param("id");
  const body = resourceSchema.partial().parse(await c.req.json());
  const resource = await prisma.resource.update({ where: { id }, data: body });
  return c.json({ resource });
});

contentRoutes.delete("/admin/resources/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.resource.delete({ where: { id } });
  return c.json({ ok: true });
});