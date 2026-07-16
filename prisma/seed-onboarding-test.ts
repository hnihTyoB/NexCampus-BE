// Chạy: cd NexCampus-BE && npx ts-node prisma/seed-onboarding-test.ts
// Tạo dữ liệu giả để test bảng Onboarding UI

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursFrom(d: Date, h: number) {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

async function main() {
  // Lấy admin user
  const admin = await prisma.user.findFirst({
    where: { email: "admin@nexcampus.local" },
  });
  if (!admin) throw new Error("Admin user not found. Run seed.ts first.");

  // Lấy regulation active (nếu có)
  const regulation = await prisma.regulation.findFirst({
    where: { isActive: true },
  });

  // Lấy danh sách department + position để map tên → ID
  const departments = await prisma.department.findMany({
    include: { positions: true },
  });
  const deptMap = new Map(departments.map((d) => [d.name, d.id]));
  const posMap = new Map<string, string>();
  for (const d of departments) {
    for (const p of d.positions) {
      posMap.set(p.name, p.id);
    }
  }

  // Dọn dữ liệu test cũ (optional — xoá invite + app có email test)
  await prisma.applicationInvite.deleteMany({
    where: { email: { contains: "candidate" } },
  });
  await prisma.application.deleteMany({
    where: { email: { contains: "candidate" } },
  });

  const candidates = [
    { name: "Nguyen Van A", email: "candidate.a@gmail.com", dept: "Engineering", pos: "Backend Intern", duration: 3 },
    { name: "Tran Thi B",   email: "candidate.b@gmail.com", dept: "Design",      pos: "UI/UX Intern",    duration: 6 },
    { name: "Le Van C",     email: "candidate.c@gmail.com", dept: "Engineering", pos: "Frontend Intern",  duration: 3 },
    { name: "Pham Thi D",   email: "candidate.d@gmail.com", dept: "Marketing",   pos: "Marketing Intern", duration: 4 },
    { name: "Hoang Van E",  email: "candidate.e@gmail.com", dept: "Data",        pos: "Data Intern",      duration: 3 },
    { name: "Do Thi F",     email: "candidate.f@gmail.com", dept: "Engineering", pos: "DevOps Intern",    duration: 6 },
    { name: "Ngo Van G",    email: "candidate.g@gmail.com", dept: "Design",      pos: "Graphic Intern",   duration: 3 },
    { name: "Bui Thi H",    email: "candidate.h@gmail.com", dept: "QA",          pos: "QA Intern",        duration: 4 },
    { name: "Dang Van I",   email: "candidate.i@gmail.com", dept: "Engineering", pos: "Mobile Intern",    duration: 3 },
    { name: "Vu Thi K",     email: "candidate.k@gmail.com", dept: "HR",          pos: "HR Intern",        duration: 3 },
  ];

  for (const c of candidates) {
    const now = new Date();
    const createdAt = daysAgo(Math.floor(Math.random() * 14) + 1);
    const expiresAt = hoursFrom(createdAt, 24);

    // Random status
    const rand = Math.random();
    let inviteStatus: "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";
    let appStatus: "PENDING" | "APPROVED" | "REJECTED" | null = null;
    let usedAt: Date | null = null;
    let applicationId: string | null = null;
    let appStartDate: Date | null = null;

    if (rand < 0.2) {
      // ACTIVE — chưa nộp đơn, còn hạn
      inviteStatus = "ACTIVE";
    } else if (rand < 0.35) {
      // REVOKED — admin thu hồi
      inviteStatus = "REVOKED";
    } else if (rand < 0.5) {
      // EXPIRED — hết hạn chưa dùng
      inviteStatus = "EXPIRED";
    } else {
      // USED — đã nộp đơn
      inviteStatus = "USED";
      usedAt = hoursFrom(createdAt, Math.floor(Math.random() * 12) + 1);
      appStartDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Random application status
      const appRand = Math.random();
      if (appRand < 0.5) appStatus = "PENDING";
      else if (appRand < 0.8) appStatus = "APPROVED";
      else appStatus = "REJECTED";
    }

    if (inviteStatus === "USED" && appStatus) {
      // Tạo application
      const app = await prisma.application.create({
        data: {
          fullName: c.name,
          email: c.email,
          phone: "09" + Math.floor(Math.random() * 90000000 + 10000000),
          departmentId: deptMap.get(c.dept) ?? null,
          positionId: posMap.get(c.pos) ?? null,
          startDate: appStartDate!,
          duration: c.duration,
          status: appStatus,
          acceptedAt: usedAt!,
          regulationId: regulation?.id ?? null,
          createdAt: usedAt!,
        },
      });
      applicationId = app.id;

      // Nếu APPROVED thì tạo User + Intern
      if (appStatus === "APPROVED") {
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.default.hash("Intern@123456", 10);
        const role = await prisma.role.findUnique({ where: { name: "INTERN" } });
        if (role) {
          const existingUser = await prisma.user.findUnique({ where: { email: c.email } });
          if (!existingUser) {
            const user = await prisma.user.create({
              data: {
                email: c.email,
                password: passwordHash,
                fullName: c.name,
                roleId: role.id,
              },
            });
            await prisma.intern.create({
              data: {
                userId: user.id,
                fullName: c.name,
                phone: app.phone,
                departmentId: deptMap.get(c.dept) ?? null,
                positionId: posMap.get(c.pos) ?? null,
                startDate: appStartDate!,
                duration: c.duration,
              },
            });
          }
        }
      }
    }

    // Tạo invite
    await prisma.applicationInvite.create({
      data: {
        email: c.email,
        token: token(),
        status: inviteStatus,
        expiresAt: inviteStatus === "EXPIRED" ? daysAgo(1) : expiresAt,
        usedAt,
        applicationId,
        createdBy: admin.id,
        createdAt,
      },
    });

    console.log(`✓ ${c.name} — invite: ${inviteStatus}${appStatus ? `, app: ${appStatus}` : ""}`);
  }

  console.log("\n✅ Done! 10 test invites created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
