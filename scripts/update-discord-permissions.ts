import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Upserting DISCORD_READ and DISCORD_MANAGE permissions...");

  const permissionsToUpsert = [
    {
      name: "DISCORD_READ",
      resource: "DISCORD",
      action: "READ",
      description: "Xem cấu hình và trạng thái Discord",
      isSystem: true,
    },
    {
      name: "DISCORD_MANAGE",
      resource: "DISCORD",
      action: "MANAGE",
      description: "Cấu hình Webhook, Kênh và Đồng bộ Role Discord",
      isSystem: true,
    },
  ];

  for (const perm of permissionsToUpsert) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        isSystem: perm.isSystem,
      },
      create: perm,
    });
    console.log(`✓ Permission: ${record.name} (id: ${record.id})`);
  }

  // Assign to ADMIN role
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (adminRole) {
    for (const perm of permissionsToUpsert) {
      const p = await prisma.permission.findUnique({ where: { name: perm.name } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: p.id,
            },
          },
          update: {},
          create: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        });
        console.log(`✓ Assigned ${perm.name} to role ADMIN`);
      }
    }
  }

  console.log("Completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
