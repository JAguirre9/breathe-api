import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import { verifyToken } from "./auth.js";
import { prisma } from "./prisma.js";

export async function getCurrentUser(c: Context) {
  const token = getCookie(c, "breathe_session");
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !user.isActive) return null;

  // Pending / rejected accounts can't act, whatever their role
  if (user.role !== "ADMIN" && user.status !== "ACTIVE") {
    return null;
  }

  return user;
}