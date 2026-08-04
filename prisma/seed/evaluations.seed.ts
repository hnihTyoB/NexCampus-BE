import { PrismaClient } from "@prisma/client";
import { EvaluationRatings } from "../../src/modules/weekly-evaluations/weekly-evaluation.dto";
import { computeScores, getVnDate } from "./helper";

export async function seedEvaluations(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string> // email -> user.id
): Promise<void> {
  console.log("-> Seeding Weekly Evaluations...");

  const leader1Id = leaders["leader1@nexcampus.local"];
  const leader2Id = leaders["leader2@nexcampus.local"];
  const leader3Id = leaders["leader3@nexcampus.local"];
  const leader4Id = leaders["leader4@nexcampus.local"];

  // Mẫu ratings điểm xuất sắc (A)
  const ratingsExcellent: EvaluationRatings = {
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
  };

  // Mẫu ratings điểm khá (H, J, L)
  const ratingsGood: EvaluationRatings = {
    ruleCompliance: "KHA",
    workAttitude: "KHA",
    learningCapacity: "KHA",
    resilience: "TB",
    communication: "KHA",
    knowledge: "KHA",
    practicalSkills: "KHA",
    foreignLanguage: "TB",
    teamwork: "KHA",
    creativity: "TB",
    contentQuality: "KHA",
    progressDelivery: "KHA",
  };

  // Mẫu ratings điểm trung bình (F)
  const ratingsAverage: EvaluationRatings = {
    ruleCompliance: "TB",
    workAttitude: "TB",
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
  };

  // Mẫu ratings điểm yếu (B, M)
  const ratingsWeak: EvaluationRatings = {
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
  };

  const evaluationsData = [
    // --- Intern A (Active - Excelent - 3 Weeks) ---
    {
      internEmail: "intern.a@nexcampus.local",
      leaderId: leader1Id,
      week: 1,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: "Thực tập sinh xuất sắc, hòa nhập nhanh và làm việc cực kỳ hiệu quả.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.a@nexcampus.local",
      leaderId: leader1Id,
      week: 2,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: "Duy trì phong độ tốt, giải quyết task nhanh chóng.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.a@nexcampus.local",
      leaderId: leader1Id,
      week: 3,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: "Hoàn thành xuất sắc các API được giao của tuần.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern B (Active - Weak - 3 Weeks) ---
    {
      internEmail: "intern.b@nexcampus.local",
      leaderId: leader1Id,
      week: 1,
      ratings: ratingsWeak,
      aiRatings: { ...ratingsWeak, ruleCompliance: "KHA" }, // Leader edited
      comment: "Tiến độ công việc còn rất chậm, kỹ năng lập trình yếu và ít giao tiếp hỏi han.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.b@nexcampus.local",
      leaderId: leader1Id,
      week: 2,
      ratings: ratingsWeak,
      aiRatings: { ...ratingsWeak, teamwork: "KHA" }, // Leader edited
      comment: "Vẫn chậm deadline nhiều task. Cần chủ động hỏi Mentor hơn khi gặp khó khăn.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.b@nexcampus.local",
      leaderId: leader1Id,
      week: 3,
      ratings: { ...ratingsWeak, coding: "TB" }, // Leader edited to encourage
      aiRatings: ratingsWeak,
      comment: "Có tiến bộ nhẹ ở tinh thần học hỏi nhưng kỹ năng code vẫn cần cải thiện nhiều.",
      reviewed: false, // Chờ TTS xác nhận xem
      reviewOffsetDays: 0,
      createdAtOffsetDays: -1,
    },

    // --- Intern D (Dropped - 2 Weeks) ---
    {
      internEmail: "intern.d@nexcampus.local",
      leaderId: leader1Id,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Nắm bắt tốt công việc setup Docker ban đầu.",
      reviewed: true,
      reviewOffsetDays: -38,
      createdAtOffsetDays: -39,
    },
    {
      internEmail: "intern.d@nexcampus.local",
      leaderId: leader1Id,
      week: 2,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Bắt đầu có dấu hiệu lơ là công việc và nghỉ không lý do.",
      reviewed: true,
      reviewOffsetDays: -31,
      createdAtOffsetDays: -32,
    },

    // --- Intern H (Active - Good - 3 Weeks) ---
    {
      internEmail: "intern.h@nexcampus.local",
      leaderId: leader1Id,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Nắm bắt nhanh các task unit test.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.h@nexcampus.local",
      leaderId: leader1Id,
      week: 2,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Làm việc chăm chỉ, code đúng quy chuẩn.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.h@nexcampus.local",
      leaderId: leader1Id,
      week: 3,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Hoàn thành tốt công việc được giao.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern J (Active - Design Good - 3 Weeks) ---
    {
      internEmail: "intern.j@nexcampus.local",
      leaderId: leader2Id,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Phân tích UX tốt, chịu khó tìm hiểu.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.j@nexcampus.local",
      leaderId: leader2Id,
      week: 2,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Persona vẽ chi tiết và sát thực tế.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.j@nexcampus.local",
      leaderId: leader2Id,
      week: 3,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Thiết kế Hi-Fi Dashboard đẹp, hiện đại.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern F (Active - Marketing Avg - 3 Weeks) ---
    {
      internEmail: "intern.f@nexcampus.local",
      leaderId: leader3Id,
      week: 1,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Hoàn thành công việc ở mức đạt yêu cầu.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.f@nexcampus.local",
      leaderId: leader3Id,
      week: 2,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Nội dung bài viết Facebook ổn nhưng cần sáng tạo thêm.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.f@nexcampus.local",
      leaderId: leader3Id,
      week: 3,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Nộp bài viết trễ hạn, cần chú ý timeline.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern L (Active - Marketing Good - 3 Weeks) ---
    {
      internEmail: "intern.l@nexcampus.local",
      leaderId: leader3Id,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Lên kịch bản TikTok sáng tạo, hài hước.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.l@nexcampus.local",
      leaderId: leader3Id,
      week: 2,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Duy trì kịch bản đều đặn, hỗ trợ tốt các bạn khác.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.l@nexcampus.local",
      leaderId: leader3Id,
      week: 3,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Chất lượng content rất tốt, đúng tiến độ.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern M (Active - SEO Weak - 3 Weeks) ---
    {
      internEmail: "intern.m@nexcampus.local",
      leaderId: leader3Id,
      week: 1,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Tối ưu on-page đạt yêu cầu.",
      reviewed: true,
      reviewOffsetDays: -21,
      createdAtOffsetDays: -22,
    },
    {
      internEmail: "intern.m@nexcampus.local",
      leaderId: leader3Id,
      week: 2,
      ratings: ratingsWeak,
      aiRatings: ratingsWeak,
      comment: "Nhiều task bị nghẽn do sự cố môi trường và tài khoản nhưng chậm báo cáo.",
      reviewed: true,
      reviewOffsetDays: -14,
      createdAtOffsetDays: -15,
    },
    {
      internEmail: "intern.m@nexcampus.local",
      leaderId: leader3Id,
      week: 3,
      ratings: ratingsWeak,
      aiRatings: ratingsWeak,
      comment: "Cần cải thiện tốc độ giải quyết vấn đề và báo cáo trạng thái bị nghẽn kịp thời.",
      reviewed: false, // TTS chưa xác nhận
      reviewOffsetDays: 0,
      createdAtOffsetDays: -1,
    },

    // --- Intern G (Active - HR - No Task - 1 Week) ---
    {
      internEmail: "intern.g@nexcampus.local",
      leaderId: leader4Id,
      week: 1,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Đang tìm hiểu tài liệu onboarding tốt, thái độ tích cực học hỏi.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },

    // --- Intern N (Active - Recruiter - 1 Week) ---
    {
      internEmail: "intern.n@nexcampus.local",
      leaderId: leader4Id,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Lọc CV chất lượng tốt, chủ động liên hệ ứng viên.",
      reviewed: true,
      reviewOffsetDays: -7,
      createdAtOffsetDays: -8,
    },
  ];

  // --- Seed cho 2 Intern COMPLETED (Intern C và Intern K) đầy đủ 12 tuần ---
  const completedInterns = [
    { email: "intern.c@nexcampus.local", leaderId: leader1Id },
    { email: "intern.k@nexcampus.local", leaderId: leader2Id },
  ];

  for (const ci of completedInterns) {
    for (let w = 1; w <= 12; w++) {
      // Ngày kết thúc tuần w cách đây w tuần
      // Ví dụ: kết thúc tuần 12 cách đây 4 tuần (w=12 thì lùi ít ngày hơn w=1)
      const offsetWeek = 12 - w + 4; // w=1 -> offset=15 tuần trước; w=12 -> offset=4 tuần trước
      const startOffset = -offsetWeek * 7;

      const ratings = w % 2 === 0 ? ratingsExcellent : ratingsGood;
      evaluationsData.push({
        internEmail: ci.email,
        leaderId: ci.leaderId,
        week: w,
        ratings,
        aiRatings: ratings,
        comment: `Đánh giá tuần ${w}: Hoàn thành tốt các nhiệm vụ được giao.`,
        reviewed: true,
        reviewOffsetDays: startOffset + 2,
        createdAtOffsetDays: startOffset + 1,
      });
    }
  }

  for (const item of evaluationsData) {
    const internId = interns[item.internEmail];
    if (!internId) continue;

    // Tính toán điểm số từ ratings và aiRatings
    const scores = computeScores(item.ratings);
    const aiScores = item.aiRatings ? computeScores(item.aiRatings) : null;

    // Xác định leaderEdited
    const keys = Object.keys(item.ratings) as Array<keyof EvaluationRatings>;
    const leaderEdited = item.aiRatings 
      ? keys.some(k => item.ratings[k] !== item.aiRatings![k])
      : false;

    const createdAt = getVnDate(item.createdAtOffsetDays, 16, 0);
    const reviewedAt = item.reviewed ? getVnDate(item.reviewOffsetDays, 9, 0) : null;

    await prisma.weeklyEvaluation.create({
      data: {
        internId,
        leaderId: item.leaderId,
        week: item.week,
        ratings: item.ratings as any,
        aiRatings: item.aiRatings as any,
        comment: item.comment,
        
        communication: scores.communication,
        attitude: scores.attitude,
        learning: scores.learning,
        coding: scores.coding,
        totalScore: scores.totalScore,

        aiCommunication: aiScores ? aiScores.communication : null,
        aiAttitude: aiScores ? aiScores.attitude : null,
        aiLearning: aiScores ? aiScores.learning : null,
        aiCoding: aiScores ? aiScores.coding : null,
        aiComment: item.aiRatings ? `AI gợi ý: ${item.comment}` : null,
        aiGeneratedAt: item.aiRatings ? getVnDate(item.createdAtOffsetDays, 15, 0) : null,

        leaderEdited,
        reviewedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  console.log(`   ✓ Seeded ${evaluationsData.length} weekly evaluations.`);
}
