import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const RATING_SCORES: Record<string, number> = {
  TOT: 10,
  KHA: 8,
  TB: 6,
  TBY: 4,
  YEU: 2,
};

function ratingToScore(r: string): number {
  return RATING_SCORES[r] || 6;
}

function avg(nums: number[]): number {
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

function computeScores(ratings: any) {
  const comm = avg([ratingToScore(ratings.communication), ratingToScore(ratings.teamwork)]);
  const att  = avg([ratingToScore(ratings.ruleCompliance), ratingToScore(ratings.workAttitude), ratingToScore(ratings.resilience)]);
  const learn = avg([ratingToScore(ratings.learningCapacity), ratingToScore(ratings.knowledge), ratingToScore(ratings.creativity)]);
  const code  = avg([ratingToScore(ratings.practicalSkills), ratingToScore(ratings.contentQuality), ratingToScore(ratings.progressDelivery)]);

  const allScores = [
    ratings.ruleCompliance, ratings.workAttitude, ratings.learningCapacity, ratings.resilience, ratings.communication,
    ratings.knowledge, ratings.practicalSkills, ratings.foreignLanguage, ratings.teamwork, ratings.creativity,
    ratings.contentQuality, ratings.progressDelivery
  ].map((r: any) => ratingToScore(r));
  const totalScore = avg(allScores);

  return { communication: comm, attitude: att, learning: learn, coding: code, totalScore };
}

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
      evaluation: {
        week: 1,
        ratings: {
          ruleCompliance: "TOT",
          workAttitude: "TOT",
          learningCapacity: "TOT",
          resilience: "KHA",
          communication: "TOT",
          knowledge: "TOT",
          practicalSkills: "TOT",
          foreignLanguage: "KHA",
          teamwork: "TOT",
          creativity: "TOT",
          contentQuality: "TOT",
          progressDelivery: "TOT",
        },
        comment: "Thực tập sinh xuất sắc, hoàn thành task trước deadline, kỹ năng code tốt, giao tiếp chủ động.",
        aiRatings: {
          ruleCompliance: "TOT",
          workAttitude: "KHA",
          learningCapacity: "TOT",
          resilience: "KHA",
          communication: "KHA",
          knowledge: "TOT",
          practicalSkills: "TOT",
          foreignLanguage: "TB",
          teamwork: "KHA",
          creativity: "KHA",
          contentQuality: "TOT",
          progressDelivery: "TOT",
        },
        aiComment: "AI đánh giá: Thực tập sinh làm việc hiệu quả, tiến độ nhanh, code sạch, giao tiếp tốt.",
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
      evaluation: {
        week: 1,
        ratings: {
          ruleCompliance: "KHA",
          workAttitude: "KHA",
          learningCapacity: "TB",
          resilience: "KHA",
          communication: "TB",
          knowledge: "KHA",
          practicalSkills: "TB",
          foreignLanguage: "TB",
          teamwork: "KHA",
          creativity: "TB",
          contentQuality: "KHA",
          progressDelivery: "TB",
        },
        comment: "Hoàn thành công việc đúng hạn, thái độ tốt, cần chủ động hơn trong việc tìm hiểu công nghệ mới.",
        aiRatings: {
          ruleCompliance: "KHA",
          workAttitude: "KHA",
          learningCapacity: "TB",
          resilience: "TB",
          communication: "TB",
          knowledge: "TB",
          practicalSkills: "TB",
          foreignLanguage: "TB",
          teamwork: "TB",
          creativity: "TB",
          contentQuality: "TB",
          progressDelivery: "TB",
        },
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
      evaluation: {
        week: 1,
        ratings: {
          ruleCompliance: "TB",
          workAttitude: "TBY",
          learningCapacity: "TBY",
          resilience: "YEU",
          communication: "TBY",
          knowledge: "TBY",
          practicalSkills: "YEU",
          foreignLanguage: "YEU",
          teamwork: "TB",
          creativity: "YEU",
          contentQuality: "TBY",
          progressDelivery: "YEU",
        },
        comment: "Kỹ năng lập trình còn yếu, chậm tiến độ nhiều task, ít giao tiếp hỏi han khi gặp khó khăn.",
        aiRatings: {
          ruleCompliance: "TB",
          workAttitude: "TB",
          learningCapacity: "TBY",
          resilience: "TBY",
          communication: "TBY",
          knowledge: "TBY",
          practicalSkills: "TBY",
          foreignLanguage: "TBY",
          teamwork: "TB",
          creativity: "TBY",
          contentQuality: "TBY",
          progressDelivery: "TBY",
        },
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
      evaluation: null,
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
        const computed = computeScores(mock.evaluation.ratings);
        const aiComputed = mock.evaluation.aiRatings ? computeScores(mock.evaluation.aiRatings) : null;

        await prisma.weeklyEvaluation.create({
          data: {
            internId: intern.id,
            leaderId: leaderUser.id,
            week: mock.evaluation.week,
            ratings: mock.evaluation.ratings,
            aiRatings: mock.evaluation.aiRatings || null,
            comment: mock.evaluation.comment,
            aiComment: mock.evaluation.aiComment || null,
            leaderEdited: mock.evaluation.leaderEdited,

            communication: computed.communication,
            attitude: computed.attitude,
            learning: computed.learning,
            coding: computed.coding,
            totalScore: computed.totalScore,

            aiCommunication: aiComputed ? aiComputed.communication : null,
            aiAttitude: aiComputed ? aiComputed.attitude : null,
            aiLearning: aiComputed ? aiComputed.learning : null,
            aiCoding: aiComputed ? aiComputed.coding : null,
            aiGeneratedAt: mock.evaluation.aiRatings ? new Date() : null,
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
