import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function test() {
  console.log("Connecting to:", process.env.DATABASE_URL);
  const users = await prisma.user.findMany({
    include: { role: true }
  });
  console.log("Registered Users count:", users.length);
  for (const u of users) {
    const isLeaderPassValid = await bcrypt.compare("Leader@123456", u.password);
    const isInternPassValid = await bcrypt.compare("Intern@123456", u.password);
    const isAdminPassValid = await bcrypt.compare("Admin@123456", u.password);
    console.log(`- Email: ${u.email}, Role: ${u.role.name}, Active: ${u.isActive}`);
    console.log(`  └─ Matches "Leader@123456": ${isLeaderPassValid}`);
    console.log(`  └─ Matches "Intern@123456": ${isInternPassValid}`);
    console.log(`  └─ Matches "Admin@123456": ${isAdminPassValid}`);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
