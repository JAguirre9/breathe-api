import { Hono } from "hono";
import { z } from "zod";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { verifyPassword, createToken, verifyToken, hashPassword } from "../lib/auth.js";
export const authRoutes = new Hono();
const isProd = process.env.NODE_ENV === "production";
const sessionCookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
};
function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
    };
}
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(100),
});
// POST /auth/change-password
authRoutes.post("/change-password", async (c) => {
    try {
        const token = getCookie(c, "breathe_session");
        if (!token)
            return c.json({ error: "Unauthorized" }, 401);
        const payload = await verifyToken(token);
        if (!payload?.userId)
            return c.json({ error: "Unauthorized" }, 401);
        const body = changePasswordSchema.parse(await c.req.json());
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, password: true },
        });
        if (!user)
            return c.json({ error: "Unauthorized" }, 401);
        const valid = await verifyPassword(body.currentPassword, user.password);
        if (!valid) {
            return c.json({ error: "Current password is incorrect" }, 400);
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { password: await hashPassword(body.newPassword) },
        });
        return c.json({ ok: true });
    }
    catch (err) {
        if (err.name === "ZodError") {
            return c.json({ error: "Invalid data", details: err.errors }, 400);
        }
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
});
// POST /auth/login
authRoutes.post("/login", async (c) => {
    try {
        const body = await c.req.json();
        const data = loginSchema.parse(body);
        const user = await prisma.user.findUnique({
            where: { email: data.email },
            select: {
                id: true,
                email: true,
                username: true,
                password: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                isActive: true,
            },
        });
        if (!user) {
            return c.json({ error: "Invalid email or password" }, 401);
        }
        const valid = await verifyPassword(data.password, user.password);
        if (!valid) {
            return c.json({ error: "Invalid email or password" }, 401);
        }
        // Inactive, pending or rejected accounts cannot log in
        if (!user.isActive || (user.role !== "ADMIN" && user.status !== "ACTIVE")) {
            return c.json({ error: "Account not active yet" }, 403);
        }
        const token = await createToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        setCookie(c, "breathe_session", token, sessionCookieOptions);
        return c.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
        });
    }
    catch (err) {
        if (err.name === "ZodError") {
            return c.json({ error: "Invalid data", details: err.errors }, 400);
        }
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
});
// GET /auth/me
authRoutes.get("/me", async (c) => {
    const token = getCookie(c, "breathe_session");
    if (!token) {
        return c.json({ user: null }, 401);
    }
    const payload = await verifyToken(token);
    if (!payload?.userId) {
        return c.json({ user: null }, 401);
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
        },
    });
    if (!user) {
        return c.json({ user: null }, 401);
    }
    return c.json({ user: publicUser(user) });
});
// POST /auth/logout
authRoutes.post("/logout", async (c) => {
    deleteCookie(c, "breathe_session", {
        path: "/",
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
    });
    return c.json({ ok: true });
});
