import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roles = ['ADMIN', 'LEADER', 'INTERN'];
  const roleMap: Record<string, string> = {};

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap[roleName] = role.id;
    console.log(`Role ${roleName} upserted with ID ${role.id}`);
  }

  const adminEmail = 'admin@nexcampus.local';
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  
  const leaderEmail = 'leader@nexcampus.local';
  const leaderPassword = await bcrypt.hash('Leader@123456', 10);

  const internEmail = 'intern@nexcampus.local';
  const internPassword = await bcrypt.hash('Intern@123456', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPassword,
      fullName: 'Admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPassword,
      fullName: 'Admin',
      roleId: roleMap['ADMIN'],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: leaderEmail },
    update: {
      password: leaderPassword,
      fullName: 'Leader',
      roleId: roleMap['LEADER'],
      isActive: true,
    },
    create: {
      email: leaderEmail,
      password: leaderPassword,
      fullName: 'Leader',
      roleId: roleMap['LEADER'],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: internEmail },
    update: {
      password: internPassword,
      fullName: 'Intern',
      roleId: roleMap['INTERN'],
      isActive: true,
    },
    create: {
      email: internEmail,
      password: internPassword,
      fullName: 'Intern',
      roleId: roleMap['INTERN'],
      isActive: true,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
