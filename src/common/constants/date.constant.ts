export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";
export const VIETNAM_OFFSET_HOURS = 7;
export const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_HOURS * 60 * 60 * 1000;

export const DATE_FORMAT = {
  VIETNAM_DATE: "DD/MM/YYYY",
  ISO_DATE: "YYYY-MM-DD",
  VIETNAM_DATETIME: "DD/MM/YYYY HH:mm:ss",
} as const;

export type DateFormat = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT];

/**
 * Regex khớp định dạng DD/MM/YYYY chuẩn của người Việt (01-31 / 01-12 / 4 chữ số năm)
 */
export const VIETNAM_DATE_REGEX =
  /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;

/**
 * Regex khớp định dạng YYYY-MM-DD (ISO 8601 calendar date)
 */
export const ISO_DATE_REGEX =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
