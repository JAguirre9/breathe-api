import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";
import { getCurrentUser } from "../lib/session.js";
export const adminRoutes = new Hono();
const activateSchema = z.object({
    password: z.string().min(6),
});
// Only logged-in admins may use these routes (checked against the database)
adminRoutes.use("*", async (c, next) => {
    const user = await getCurrentUser(c);
    if (!user || user.role !== "ADMIN") {
        return c.json({ error: "Forbidden" }, 403);
    }
    await next();
});
// GET /admin/patients -> active patients (for the task picker)
adminRoutes.get("/patients", async (c) => {
    try {
        const patients = await prisma.user.findMany({
            where: { role: "PATIENT", status: "ACTIVE" },
            select: { id: true, firstName: true, lastName: true, email: true },
            orderBy: { firstName: "asc" },
        });
        return c.json({ patients });
    }
    catch (err) {
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
});
// GET /admin/patients/:id/journal -> a patient's journal entries
adminRoutes.get("/patients/:id/journal", async (c) => {
    try {
        const id = c.req.param("id");
        const patient = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });
        if (!patient || patient.role !== "PATIENT") {
            return c.json({ error: "Patient not found" }, 404);
        }
        const entries = await prisma.journalEntry.findMany({
            where: { userId: id },
            orderBy: { createdAt: "desc" },
        });
        return c.json({ entries });
    }
    catch (err) {
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
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
    }
    catch (err) {
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
    }
    catch (err) {
        if (err.name === "ZodError") {
            return c.json({ error: "Invalid data", details: err.errors }, 400);
        }
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
});
// GET /admin/patients/:id/sessions
adminRoutes.get("/patients/:id/sessions", async (c) => {
    try {
        const id = c.req.param("id");
        const patient = await prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true },
        });
        if (!patient || patient.role !== "PATIENT") {
            return c.json({ error: "Patient not found" }, 404);
        }
        const sessions = await prisma.session.findMany({
            where: { userId: id },
            orderBy: [{ date: "asc" }, { time: "asc" }],
        });
        return c.json({ sessions });
    }
    catch (err) {
        console.error(err);
        return c.json({ error: "Server error" }, 500);
    }
});
