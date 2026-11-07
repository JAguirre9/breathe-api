import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";

export const intakeRoutes = new Hono();

const patientIntakeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().default(""),
  preferredName: z.string().optional().default(""),
  patientID: z.string().trim().max(30).optional().default(""),
  patientIDType: z.enum(["CC", "CE", "TI", "PA"]).default("CC"),
  email: z.string().email(),
  phoneCode: z.string().optional().default("+57"),
  phoneNumber: z.string().min(1),
  contactMethod: z.enum(["whatsapp", "email", "phone"]).default("whatsapp"),
  age: z.string().optional().default(""),
  feelings: z.string().optional().default(""),
  priorSessions: z.string().optional().default(""),
});

// POST /intake/patient
intakeRoutes.post("/patient", async (c) => {
  try {
    const body = await c.req.json();
    const data = patientIntakeSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const username =
      data.email.split("@")[0] + "-" + Date.now().toString().slice(-4);

    // Temporary password until full account setup exists
    const tempPassword = await hashPassword(
      `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const ageNumber = data.age ? Number(data.age) : null;

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username,
        password: tempPassword,
        firstName: data.firstName,
        lastName: data.lastName || null,
        role: "PATIENT",
        status: "PENDING",
        patientProfile: {
          create: {
            preferredName: data.preferredName || null,
            phoneCode: data.phoneCode,
            phoneNumber: data.phoneNumber,
            patientID: data.patientID || null,
            patientIDType: data.patientID ? data.patientIDType : null,
            age: Number.isFinite(ageNumber) ? ageNumber : null,
            feelings: data.feelings || null,
            priorSessions: data.priorSessions || null,
            contactMethod: data.contactMethod,
          },
        },
      },
      include: {
        patientProfile: true,
      },
    });

    return c.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profile: user.patientProfile,
        },
      },
      201
    );
  } catch (err: any) {
    if (err.name === "ZodError") {
      return c.json({ error: "Invalid data", details: err.errors }, 400);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  }
});
