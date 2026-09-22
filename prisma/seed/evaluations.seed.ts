import { PrismaClient, EvaluationGrade } from "@prisma/client";
import { computeWeeklyScores, EvaluationRatings, getVnDate } from "./helper";

export async function seedEvaluations(
  prisma: PrismaClient,
  interns: Record<string, string>, // email -> intern.id
  leaders: Record<string, string> // email -> user.id
): Promise<void> {
  console.log("\n[6/8] Khởi tạo Đánh giá tuần 12 tiêu chí (Weekly Evaluations)...");

  const leaderEngId = leaders["leader@nexcampus.com"];
  const leaderQaId = leaders["leader.qa@nexcampus.com"];
  const leaderDesignId = leaders["leader.design@nexcampus.com"];
  const leaderMktId = leaders["leader.mkt@nexcampus.com"];
  const leaderHrId = leaders["leader.hr@nexcampus.com"];

  // Ratings Templates
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

  interface EvalConfig {
    internEmail: string;
    leaderId: string;
    week: number;
    ratings: EvaluationRatings;
    aiRatings?: EvaluationRatings;
    comment: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    isViewed: boolean;
    offsetDays: number;
  }

  const evalConfigs: EvalConfig[] = [];

  // 1. Intern A (Nguyễn Văn Thực Tập Sinh - 7 Tuần xuất sắc)
  for (let w = 1; w <= 7; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern@nexcampus.com",
      leaderId: leaderEngId,
      week: w,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: `Tuần ${w}: Nắm bắt công việc cực kỳ xuất sắc, hoàn thành các API đúng tiến độ và hỗ trợ các thành viên khác trong nhóm.`,
      strengths: ["Chủ động giải quyết vấn đề", "Tư duy lập trình mạch lạc", "Tuân thủ tốt nội quy"],
      weaknesses: ["Cần tự tin hơn khi thuyết trình demo tính năng"],
      recommendations: ["Tiếp tục phát huy và nghiên cứu thêm về caching và message queue"],
      isViewed: true,
      offsetDays,
    });
  }

  // 2. Intern B (Trần Thị Bình - 7 Tuần gặp khó khăn, Leader chỉnh điểm để khích lệ)
  for (let w = 1; w <= 7; w++) {
    const offsetDays = -52 + (w * 7);
    const isLatest = w === 7;
    evalConfigs.push({
      internEmail: "intern.b@nexcampus.com",
      leaderId: leaderEngId,
      week: w,
      ratings: { ...ratingsWeak, ruleCompliance: "KHA" }, // Leader nương tay
      aiRatings: ratingsWeak, // AI chấm khắt khe hơn
      comment: `Tuần ${w}: Tiến độ còn chậm, gặp nhiều khó khăn ở phần xử lý state và CSS responsive. Cần chủ động hỏi Mentor hơn khi bị kẹt.`,
      strengths: ["Chăm chỉ, chịu khó nghe góp ý"],
      weaknesses: ["Chậm deadline nhiều task", "Chưa chủ động báo cáo blockers"],
      recommendations: ["Hãy hỏi ngay khi gặp lỗi trên 30 phút, chú ý giờ nộp báo cáo ngày trước 17:30"],
      isViewed: !isLatest, // Tuần 7 chưa xem!
      offsetDays,
    });
  }

  // 3. Intern C (Lê Hoàng Long - Completed Mobile Intern - Đầy đủ 12 Tuần)
  for (let w = 1; w <= 12; w++) {
    const offsetDays = -144 + (w * 7);
    const ratings = w > 6 ? ratingsExcellent : ratingsGood;
    evalConfigs.push({
      internEmail: "intern.c@nexcampus.com",
      leaderId: leaderEngId,
      week: w,
      ratings,
      aiRatings: ratings,
      comment: `Tuần ${w}: Hoàn thành tốt các module tính năng của ứng dụng di động.`,
      strengths: ["Kỹ năng React Native tốt", "Giao diện mượt mà"],
      weaknesses: ["Cần tối ưu dung lượng bundle size"],
      recommendations: ["Chuẩn bị báo cáo tổng kết thực tập"],
      isViewed: true,
      offsetDays,
    });
  }

  // 4. Intern D (Phạm Quỳnh Chi - Dropped - 2 Tuần đầu)
  evalConfigs.push(
    {
      internEmail: "intern.d@nexcampus.com",
      leaderId: leaderEngId,
      week: 1,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: "Tuần 1: Bắt đầu tiếp cận tốt với Docker và CI/CD.",
      strengths: ["Nhiệt tình"],
      weaknesses: ["Cần chú ý kỷ luật giờ giấc"],
      recommendations: ["Tham gia họp đầy đủ"],
      isViewed: true,
      offsetDays: -45,
    },
    {
      internEmail: "intern.d@nexcampus.com",
      leaderId: leaderEngId,
      week: 2,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: "Tuần 2: Có dấu hiệu xao nhãng và vắng mặt không lý do.",
      strengths: ["Nắm bắt nhanh"],
      weaknesses: ["Thái độ chưa nghiêm túc"],
      recommendations: ["Cần cam kết lại kế hoạch thực tập"],
      isViewed: true,
      offsetDays: -38,
    }
  );

  // 5. Intern F (Hoàng Thu Trang - QA - 6 Tuần trung bình/khá)
  for (let w = 1; w <= 6; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.f@nexcampus.com",
      leaderId: leaderQaId,
      week: w,
      ratings: w % 2 === 0 ? ratingsGood : ratingsAverage,
      aiRatings: ratingsAverage,
      comment: `Tuần ${w}: Viết test case đạt yêu cầu, cần chú ý kiểm tra thêm các trường hợp biên.`,
      strengths: ["Cẩn thận, tỉ mỉ"],
      weaknesses: ["Tốc độ viết test case cần đẩy nhanh hơn"],
      recommendations: ["Áp dụng kỹ thuật phân vùng tương đương và phân tích giá trị biên"],
      isViewed: true,
      offsetDays,
    });
  }

  // 6. Intern H (Hoàng Văn Hùng - Automation QA - 6 Tuần khá)
  for (let w = 1; w <= 6; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.h@nexcampus.com",
      leaderId: leaderQaId,
      week: w,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: `Tuần ${w}: Viết automation scripts ổn định, tích hợp tốt vào pipeline kiểm thử.`,
      strengths: ["Kỹ năng code test Playwright tốt"],
      weaknesses: ["Cần tổ chức Page Object Model rõ ràng hơn"],
      recommendations: ["Tối ưu thời gian chạy song song của test suite"],
      isViewed: true,
      offsetDays,
    });
  }

  // 7. Intern J (Bùi Việt Hoàng - Design - 6 Tuần khá/tốt)
  for (let w = 1; w <= 6; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.j@nexcampus.com",
      leaderId: leaderDesignId,
      week: w,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: `Tuần ${w}: Thiết kế UI đẹp mắt, bố cục hiện đại, prototype tương tác tốt.`,
      strengths: ["Thẩm mỹ tốt, am hiểu Design System"],
      weaknesses: ["Cần chú ý tính khả thi khi dev code giao diện"],
      recommendations: ["Trao đổi nhiều hơn với đội Frontend để chốt component spec"],
      isViewed: true,
      offsetDays,
    });
  }

  // 8. Intern K (Lý Minh Khuê - Completed Graphic Design - 12 Tuần)
  for (let w = 1; w <= 12; w++) {
    const offsetDays = -130 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.k@nexcampus.com",
      leaderId: leaderDesignId,
      week: w,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: `Tuần ${w}: Sản phẩm đồ hoạ xuất sắc, đáp ứng đúng yêu cầu của chiến dịch.`,
      strengths: ["Sáng tạo cao, phối màu chuẩn thương hiệu"],
      weaknesses: ["Không có"],
      recommendations: ["Hoàn tất portfolio và báo cáo thực tập"],
      isViewed: true,
      offsetDays,
    });
  }

  // 9. Intern L (Ngô Khánh Linh - Marketing Content - 6 Tuần xuất sắc)
  for (let w = 1; w <= 6; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.l@nexcampus.com",
      leaderId: leaderMktId,
      week: w,
      ratings: ratingsExcellent,
      aiRatings: ratingsExcellent,
      comment: `Tuần ${w}: Kịch bản video sáng tạo, lượng tương tác cao, văn phong thu hút.`,
      strengths: ["Kỹ năng viết lách tuyệt vời, nhạy bén xu hướng"],
      weaknesses: ["Cần tìm hiểu thêm về số liệu phân tích Analytics"],
      recommendations: ["Kết hợp chặt chẽ với bạn SEO để tối ưu từ khóa trong bài"],
      isViewed: true,
      offsetDays,
    });
  }

  // 10. Intern M (Phan Đức Mạnh - SEO - 6 Tuần trung bình do vướng công cụ)
  for (let w = 1; w <= 6; w++) {
    const offsetDays = -52 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.m@nexcampus.com",
      leaderId: leaderMktId,
      week: w,
      ratings: ratingsAverage,
      aiRatings: ratingsAverage,
      comment: `Tuần ${w}: Chăm chỉ tìm kiếm từ khóa, tuy nhiên bị hạn chế do thiếu tài khoản công cụ trả phí.`,
      strengths: ["Nhiệt tình"],
      weaknesses: ["Chưa biết cách tận dụng các công cụ SEO miễn phí thay thế"],
      recommendations: ["Đề xuất Mentor hỗ trợ tài khoản kịp thời"],
      isViewed: true,
      offsetDays,
    });
  }

  // 11. Intern N (Trịnh Kim Ngân - HR - 3 Tuần khá)
  for (let w = 1; w <= 3; w++) {
    const offsetDays = -21 + (w * 7);
    evalConfigs.push({
      internEmail: "intern.n@nexcampus.com",
      leaderId: leaderHrId,
      week: w,
      ratings: ratingsGood,
      aiRatings: ratingsGood,
      comment: `Tuần ${w}: Lọc CV đúng tiêu chí, thái độ giao tiếp với ứng viên lịch sự, chu đáo.`,
      strengths: ["Kỹ năng giao tiếp tốt, cẩn thận"],
      weaknesses: ["Cần nắm vững hơn các thuật ngữ kỹ thuật chuyên ngành IT"],
      recommendations: ["Đọc thêm cẩm nang vị trí lập trình viên để đánh giá CV chuẩn xác hơn"],
      isViewed: true,
      offsetDays,
    });
  }

  for (const item of evalConfigs) {
    const internId = interns[item.internEmail];
    if (!internId) continue;

    const scores = computeWeeklyScores(item.ratings);
    const aiScores = item.aiRatings ? computeWeeklyScores(item.aiRatings) : null;

    const keys = Object.keys(item.ratings);
    const isAiAdjusted = item.aiRatings
      ? keys.some((k) => item.ratings[k] !== item.aiRatings![k])
      : false;

    const createdAt = getVnDate(item.offsetDays, 16, 30);
    const viewedAt = item.isViewed ? getVnDate(item.offsetDays + 1, 8, 30) : null;
    const startDate = getVnDate(item.offsetDays - 6, 8, 0);
    const endDate = getVnDate(item.offsetDays, 17, 30);
    const year = startDate.getFullYear();

    await prisma.weeklyEvaluation.upsert({
      where: {
        internId_week: {
          internId,
          week: item.week,
        },
      },
      update: {
        leaderId: item.leaderId,
        year,
        startDate,
        endDate,
        ratings: item.ratings as any,
        aiRatings: item.aiRatings as any,
        score: scores.score,
        grade: scores.grade,
        comment: item.comment,
        strengths: item.strengths,
        weaknesses: item.weaknesses,
        recommendations: item.recommendations,
        aiScore: aiScores ? aiScores.score : null,
        aiComment: item.aiRatings ? `[AI Gợi ý]: ${item.comment}` : null,
        aiStrengths: item.strengths,
        aiWeaknesses: item.weaknesses,
        aiRecommendations: item.recommendations,
        isAiAdjusted,
        viewedAt,
        createdAt,
        updatedAt: viewedAt || createdAt,
      },
      create: {
        internId,
        leaderId: item.leaderId,
        week: item.week,
        year,
        startDate,
        endDate,
        ratings: item.ratings as any,
        aiRatings: item.aiRatings as any,
        score: scores.score,
        grade: scores.grade,
        comment: item.comment,
        strengths: item.strengths,
        weaknesses: item.weaknesses,
        recommendations: item.recommendations,
        aiScore: aiScores ? aiScores.score : null,
        aiComment: item.aiRatings ? `[AI Gợi ý]: ${item.comment}` : null,
        aiStrengths: item.strengths,
        aiWeaknesses: item.weaknesses,
        aiRecommendations: item.recommendations,
        isAiAdjusted,
        viewedAt,
        createdAt,
        updatedAt: viewedAt || createdAt,
      },
    });
  }

  console.log(`   ✓ Đã tạo ${evalConfigs.length} bảng đánh giá tuần (bao quát đầy đủ 12 tiêu chí, các bậc xếp loại và AI adjusted).`);
}
