import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

async function main() {
  const models = [
    "user",
    "role",
    "permission",
    "department",
    "intern",
    "leader",
    "task",
    "meeting",
    "notification",
    "dailyReport",
    "systemConfig",
  ];

  console.log("\n=== UUID Version Verification Across Models ===");
  let allV7 = true;

  for (const modelName of models) {
    try {
      const records = await (prisma as any)[modelName].findMany({
        take: 3,
        select: { id: true },
      });
      if (records.length === 0) {
        console.log(`- ${modelName}: (0 records)`);
        continue;
      }
      for (const r of records) {
        const v = r.id ? r.id.charAt(14) : "N/A";
        const isV7 = v === "7";
        if (!isV7) allV7 = false;
        console.log(`  ${isV7 ? "✓" : "✗"} [${modelName}] id: ${r.id} (v${v})`);
      }
    } catch (e: any) {
      console.log(`! ${modelName} error: ${e.message}`);
    }
  }

  console.log(`\nResult: ${allV7 ? "✅ All sampled UUIDs are UUIDv7!" : "❌ Some UUIDs are NOT v7"}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
