import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.log("Usage: npx tsx scripts/set-password.ts <email> <new-password>");
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.log("No user with that email");
  process.exit(1);
}

await prisma.user.update({
  where: { email },
  data: {
    password: await hashPassword(password),
    status: "ACTIVE",
    isActive: true,
  },
});

console.log(`Password updated for ${email}`);
await prisma.$disconnect();

//npx tsx src/scripts/set-password.ts test@breathe.local 'Colombia123!' use this to change the password 