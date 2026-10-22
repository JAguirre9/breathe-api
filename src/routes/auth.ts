import { Hono } from "hono";
import { z } from "zod";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { 
	hashPassword, 
	verifyPassword, 
	findUserByEmail,
	createToken,
	verifyToken,
 } from "../lib/auth.js";

export const authRoutes = new Hono();

function publicUser(user: {
  id: string | number;
  email: string;
  username: string;
  firstName: string;
  lastName: string | null;
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  role: z.enum(["PATIENT", "PSYCHOLOGIST"]).default("PATIENT"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/register
authRoutes.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const data = registerSchema.parse(body);

    const existing = await findUserByEmail(data.email);
    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const username = 
	data.email.split("@")[0] + "-" + Date.now().toString().slice(-4);
    const hashed = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username,
        password: hashed,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        patientProfile:
          data.role === "PATIENT"
            ? { create: {} }
            : undefined,
        psychologistProfile:
          data.role === "PSYCHOLOGIST"
            ? { create: {} }
            : undefined,
       },
    });

const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

setCookie(c, "breathe_session", token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return c.json({ user: publicUser(user) }, 201);
  } catch (err: any) {
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

    const user = await findUserByEmail(data.email);
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await verifyPassword(data.password, user.password);
    if (!valid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    }); 

    setCookie(c, "breathe_session", token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }); 

   return c.json({ user: publicUser(user) });
  } catch (err: any) {
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
  if (!payload) {
    return c.json({ user: null }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  if (!user) {
    return c.json({ user: null }, 401);
  }

  return c.json({ user });
});

// POST /auth/logout
authRoutes.post("/logout", async (c) => {
  deleteCookie(c, "breathe_session", {
    path: "/",
  });
  return c.json({ ok: true });
});
