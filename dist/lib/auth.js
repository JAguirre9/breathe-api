import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma.js";
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of 32+ characters");
}
const secret = new TextEncoder().encode(rawSecret);
export async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function findUserByEmail(email) {
    return prisma.user.findUnique({
        where: { email },
        include: {
            patientProfile: true,
            psychologistProfile: true,
        },
    });
}
export async function createToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
}
export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload;
    }
    catch {
        return null;
    }
}
