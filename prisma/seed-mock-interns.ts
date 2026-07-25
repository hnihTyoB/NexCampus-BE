import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Lấy Role INTERN
  const internRole = await prisma.role.findFirst({
    where: { name: "INTERN" },
  });
  if (!internRole) {
    console.error("Không tìm thấy role INTERN trong database. Hãy chạy seed chính trước.");
    return;
  }

  // 2. Lấy Leader (leader@nexcampus.local)
  const leaderUser = await prisma.user.findFirst({
    where: { email: "leader@nexcampus.local" },
  });
  if (!leaderUser) {
    console.error("Không tìm thấy Leader với email leader@nexcampus.local.");
    return;
  }

  // 3. Tìm hoặc tạo Department & Position
  let dept = await prisma.department.findFirst({
    where: { name: "Engineering" },
  });
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Engineering" },
    });
  }

  let posBackend = await prisma.position.findFirst({
    where: { name: "Backend Intern", departmentId: dept.id },
  });
  if (!posBackend) {
    posBackend = await prisma.position.create({
      data: { name: "Backend Intern", departmentId: dept.id },
    });
  }

  let posFrontend = await prisma.position.findFirst({
    where: { name: "Frontend Intern", departmentId: dept.id },
  });
  if (!posFrontend) {
    posFrontend = await prisma.position.create({
      data: { name: "Frontend Intern", departmentId: dept.id },
    });
  }

  const passwordHash = await bcrypt.hash("Intern@123456", 10);

  // Danh sách Intern mock
  const mockInterns = [
    {
      email: "intern.gioi@nexcampus.local",
      fullName: "Nguyễn Văn Anh (Giỏi)",
      phone: "0911111111",
      positionId: posBackend.id,
      duration: 3,
      startDate: new Date(),
      status: "ACTIVE" as const,
      // Đã có sẵn đánh giá tốt
      evaluation: {
        week: 1,
        communication: 9.0,
        attitude: 9.5,
        learning: 9.0,
        coding: 9.5,
        totalScore: 9.25,
        comment: "Thực tập sinh xuất sắc, hoàn thành task trước deadline, kỹ năng code tốt, giao tiếp chủ động.",
        aiCommunication: 8.5,
        aiAttitude: 9.0,
        aiLearning: 9.0,
        aiCoding: 9.0,
        aiComment: "AI đánh giá: Thực tập sinh làm việc hiệu quả, code sạch, giao tiếp tốt.",
        leaderEdited: true,
      },
    },
    {
      email: "intern.trungbinh@nexcampus.local",
      fullName: "Trần Thị Bình (Khá)",
      phone: "0922222222",
      positionId: posFrontend.id,
      duration: 3,
      startDate: new Date(),
      status: "ACTIVE" as const,
      // Đã có sẵn đánh giá trung bình khá
      evaluation: {
        week: 1,
        communication: 7.0,
        attitude: 8.0,
        learning: 7.5,
        coding: 7.0,
        totalScore: 7.375,
        comment: "Hoàn thành công việc đúng hạn, thái độ tốt, cần chủ động hơn trong việc tìm hiểu công nghệ mới.",
        aiCommunication: 7.0,
        aiAttitude: 8.0,
        aiLearning: 7.0,
        aiCoding: 7.0,
        aiComment: "AI đánh giá: Tiến độ công việc ổn định, cần cải thiện tốc độ giải quyết vấn đề.",
        leaderEdited: true,
      },
    },
    {
      email: "intern.yeu@nexcampus.local",
      fullName: "Lê Hoàng Cường (Yếu)",
      phone: "0933333333",
      positionId: posBackend.id,
      duration: 3,
      startDate: new Date(),
      status: "ACTIVE" as const,
      // Đã có sẵn đánh giá yếu
      evaluation: {
        week: 1,
        communication: 4.5,
        attitude: 6.0,
        learning: 4.0,
        coding: 3.5,
        totalScore: 4.5,
        comment: "Kỹ năng lập trình còn yếu, chậm tiến độ nhiều task, ít giao tiếp hỏi han khi gặp khó khăn.",
        aiCommunication: 5.0,
        aiAttitude: 6.0,
        aiLearning: 4.0,
        aiCoding: 4.0,
        aiComment: "AI đánh giá: Nhiều task bị quá hạn, cần Mentor hỗ trợ nhiều hơn.",
        leaderEdited: true,
      },
    },
    {
      email: "intern.moi@nexcampus.local",
      fullName: "Phạm Minh Duy (Mới - Chưa Đánh Giá)",
      phone: "0944444444",
      positionId: posFrontend.id,
      duration: 3,
      startDate: new Date(),
      status: "ACTIVE" as const,
      evaluation: null, // Chưa có đánh giá để leader tự test
    },
  ];

  console.log("Bắt đầu mock dữ liệu thực tập sinh...");

  for (const mock of mockInterns) {
    // 4. Tạo hoặc cập nhật User
    const user = await prisma.user.upsert({
      where: { email: mock.email },
      update: {
        fullName: mock.fullName,
        isActive: true,
        roleId: internRole.id,
      },
      create: {
        email: mock.email,
        password: passwordHash,
        fullName: mock.fullName,
        isActive: true,
        roleId: internRole.id,
      },
    });

    // 5. Tạo hoặc cập nhật Intern
    const intern = await prisma.intern.upsert({
      where: { userId: user.id },
      update: {
        fullName: mock.fullName,
        phone: mock.phone,
        departmentId: dept.id,
        positionId: mock.positionId,
        leaderId: leaderUser.id,
        status: mock.status,
      },
      create: {
        userId: user.id,
        fullName: mock.fullName,
        phone: mock.phone,
        departmentId: dept.id,
        positionId: mock.positionId,
        leaderId: leaderUser.id,
        startDate: mock.startDate,
        duration: mock.duration,
        status: mock.status,
      },
    });

    console.log(`✓ Upserted intern: ${mock.fullName} (${mock.email})`);

    // 6. Tạo Đánh giá tuần (nếu có)
    if (mock.evaluation) {
      const existingEval = await prisma.weeklyEvaluation.findFirst({
        where: {
          internId: intern.id,
          week: mock.evaluation.week,
        },
      });

      if (!existingEval) {
        await prisma.weeklyEvaluation.create({
          data: {
            internId: intern.id,
            leaderId: leaderUser.id,
            ...mock.evaluation,
          },
        });
        console.log(`  └─ Tạo đánh giá tuần ${mock.evaluation.week} thành công.`);
      } else {
        console.log(`  └─ Đã tồn tại đánh giá tuần ${mock.evaluation.week}, bỏ qua.`);
      }
    }
  }

  console.log("Mock dữ liệu hoàn tất!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
