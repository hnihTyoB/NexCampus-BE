import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function seed() {
  const deps = [
    { name: "Engineering", positions: ["Backend Intern", "Frontend Intern", "Mobile Intern", "DevOps Intern"] },
    { name: "Design", positions: ["UI/UX Intern", "Graphic Intern"] },
    { name: "Marketing", positions: ["Marketing Intern"] },
    { name: "Data", positions: ["Data Intern"] },
    { name: "QA", positions: ["QA Intern"] },
    { name: "HR", positions: ["HR Intern"] },
    { name: "Product", positions: ["Product Intern"] },
  ];

  for (const d of deps) {
    const dept = await p.department.create({ data: { name: d.name } });
    for (const pos of d.positions) {
      await p.position.create({ data: { departmentId: dept.id, name: pos } });
    }
  }
  console.log(`Seeded ${deps.length} departments with positions`);
}

seed()
  .then(() => p.$disconnect())
  .catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
