const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
/**
 * Vietnam (Asia/Ho_Chi_Minh) operates at fixed UTC+7 without Daylight Saving Time (DST).
 * Using fixed-offset calculation provides sub-millisecond conversion performance
 * while maintaining 100% mathematical precision across all calendar dates.
 */
const VIETNAM_OFFSET_HOURS = 7;
const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns UTC Date boundaries for a given date in YYYY-MM-DD format based on Vietnam time (UTC+7).
 * Example: '2026-08-22' ->
 *   startOfDay: 2026-08-21T17:00:00.000Z (which is 2026-08-22 00:00:00 UTC+7)
 *   endOfDay: 2026-08-22T16:59:59.999Z (which is 2026-08-22 23:59:59.999 UTC+7)
 */
export function getVietnamDayRange(dateString: string): { startOfDay: Date; endOfDay: Date } {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date format for Vietnam day range: ${dateString}. Expected YYYY-MM-DD.`);
  }

  // Create UTC date representing the local 00:00:00 in UTC+7
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0 - VIETNAM_OFFSET_HOURS, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23 - VIETNAM_OFFSET_HOURS, 59, 59, 999));

  return { startOfDay, endOfDay };
}

/**
 * Formats a Date to YYYY-MM-DD in Vietnam timezone (UTC+7).
 */
export function formatVietnamDate(date: Date): string {
  const localDate = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date to readable Vietnamese datetime string.
 */
export function formatVietnamDateTime(date: Date): string {
  return date.toLocaleString('vi-VN', { timeZone: VIETNAM_TIMEZONE });
}
