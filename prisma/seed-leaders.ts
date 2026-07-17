import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leaderUsers = await prisma.user.findMany({
    where: {
      role: { name: "LEADER" },
      deletedAt: null,
    },
  });

  for (const user of leaderUsers) {
    const existing = await prisma.leader.findUnique({
      where: { userId: user.id },
    });
    if (!existing) {
      await prisma.leader.create({
        data: { userId: user.id },
      });
      console.log(`✓ Created leader record for ${user.email}`);
    } else {
      console.log(`- Already exists: ${user.email}`);
    }
  }

  console.log(`\nDone. ${leaderUsers.length} leader users processed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
