import bcrypt from "bcryptjs";
import { EvaluationRatings, RatingLevel } from "../../src/modules/weekly-evaluations/weekly-evaluation.dto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const RATING_SCORES: Record<RatingLevel, number> = {
  TOT: 10,
  KHA: 8,
  TB: 6,
  TBY: 4,
  YEU: 2,
};

export function ratingToScore(r: RatingLevel): number {
  return RATING_SCORES[r] || 6;
}

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

export function computeScores(ratings: EvaluationRatings) {
  const comm = avg([ratingToScore(ratings.communication), ratingToScore(ratings.teamwork)]);
  const att  = avg([ratingToScore(ratings.ruleCompliance), ratingToScore(ratings.workAttitude), ratingToScore(ratings.resilience)]);
  const learn = avg([ratingToScore(ratings.learningCapacity), ratingToScore(ratings.knowledge), ratingToScore(ratings.creativity)]);
  const code  = avg([ratingToScore(ratings.practicalSkills), ratingToScore(ratings.contentQuality), ratingToScore(ratings.progressDelivery)]);

  const allScores = [
    ratings.ruleCompliance, ratings.workAttitude, ratings.learningCapacity, ratings.resilience, ratings.communication,
    ratings.knowledge, ratings.practicalSkills, ratings.foreignLanguage, ratings.teamwork, ratings.creativity,
    ratings.contentQuality, ratings.progressDelivery
  ].map((r) => ratingToScore(r));
  const totalScore = avg(allScores);

  return { communication: comm, attitude: att, learning: learn, coding: code, totalScore };
}

/**
 * Lấy mốc thời gian dựa trên SEED_REFERENCE_DATE (mặc định là thời gian hiện tại)
 * và dịch chuyển số ngày, giờ, phút tương ứng với múi giờ Asia/Ho_Chi_Minh (UTC+7).
 */
export function getVnDate(daysOffset: number, hour: number = 9, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  
  // Điều chỉnh giờ theo múi giờ Việt Nam (UTC+7)
  // Để lưu đúng vào PostgreSQL dưới dạng UTC:
  // Giờ VN = Giờ UTC + 7 -> Giờ UTC = Giờ VN - 7
  const utcHour = hour - 7;
  date.setUTCHours(utcHour, minute, 0, 0);
  
  return date;
}
