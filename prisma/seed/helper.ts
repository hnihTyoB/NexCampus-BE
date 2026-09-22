import bcrypt from "bcryptjs";
import { EvaluationGrade } from "@prisma/client";

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";
export const VIETNAM_OFFSET_HOURS = 7;
export const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns a Date object anchored to Vietnam local time (UTC+7)
 * relative to the current reference date with specified offset in days.
 */
export function getVnDate(
  offsetDays: number,
  hour: number = 9,
  minute: number = 0,
  second: number = 0
): Date {
  const now = new Date();
  // Get current date string in Vietnam timezone: YYYY-MM-DD
  const vnDateStr = now.toLocaleDateString("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
  });
  const [y, m, d] = vnDateStr.split("-").map(Number);

  // Compute local target date in Vietnam
  const targetDate = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const targetY = targetDate.getUTCFullYear();
  const targetM = targetDate.getUTCMonth();
  const targetD = targetDate.getUTCDate();

  // Create UTC date representing that local time in UTC+7 (localHour - 7 = UTCHour)
  return new Date(Date.UTC(targetY, targetM, targetD, hour - VIETNAM_OFFSET_HOURS, minute, second));
}

/**
 * Returns a pure Date object representing only the calendar day (00:00:00 UTC)
 * for PostgreSQL @db.Date fields like daily_reports.date.
 */
export function getVnDateOnly(offsetDays: number): Date {
  const now = new Date();
  const vnDateStr = now.toLocaleDateString("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
  });
  const [y, m, d] = vnDateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Formats a Date or day offset to YYYY-MM-DD in Vietnam timezone.
 */
export function getVnDateStr(offsetDays: number): string {
  const date = getVnDate(offsetDays);
  return date.toLocaleDateString("en-CA", { timeZone: VIETNAM_TIMEZONE });
}

/**
 * Hashes a plain password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export interface EvaluationRatings {
  ruleCompliance: string;
  workAttitude: string;
  learningCapacity: string;
  resilience: string;
  communication: string;
  knowledge: string;
  practicalSkills: string;
  foreignLanguage: string;
  teamwork: string;
  creativity: string;
  contentQuality: string;
  progressDelivery: string;
  [key: string]: string;
}

const CRITERIA_WEIGHTS: Record<string, number> = {
  TOT: 10,
  KHA: 8,
  TB: 6,
  TBY: 4,
  YEU: 2,
};

/**
 * Computes average score (0-10) and EvaluationGrade from 12 criteria ratings.
 */
export function computeWeeklyScores(ratings: EvaluationRatings): {
  score: number;
  grade: EvaluationGrade;
} {
  const keys = [
    "ruleCompliance",
    "workAttitude",
    "learningCapacity",
    "resilience",
    "communication",
    "knowledge",
    "practicalSkills",
    "foreignLanguage",
    "teamwork",
    "creativity",
    "contentQuality",
    "progressDelivery",
  ];

  let sum = 0;
  let count = 0;

  for (const k of keys) {
    const val = ratings[k] || "KHA";
    sum += CRITERIA_WEIGHTS[val] ?? 7;
    count++;
  }

  const rawScore = count > 0 ? sum / count : 7;
  const score = Math.round(rawScore * 10) / 10;

  let grade: EvaluationGrade = EvaluationGrade.KHA;
  if (score >= 8.5) {
    grade = EvaluationGrade.TOT;
  } else if (score >= 7.0) {
    grade = EvaluationGrade.KHA;
  } else if (score >= 5.5) {
    grade = EvaluationGrade.TB;
  } else if (score >= 4.0) {
    grade = EvaluationGrade.TBY;
  } else {
    grade = EvaluationGrade.YEU;
  }

  return { score, grade };
}
