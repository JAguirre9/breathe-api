import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";
async function main() {
    const email = "admin@breathe.local";
    const password = "Admin123!"; // change this
    const hashed = await hashPassword(password);
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashed,
            role: "ADMIN",
            status: "ACTIVE",
            isActive: true,
        },
        create: {
            email,
            username: "admin",
            password: hashed,
            firstName: "Admin",
            role: "ADMIN",
            status: "ACTIVE",
            isActive: true,
        },
    });
    console.log("Admin ready:", {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
    });
    console.log("Password:", password);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
