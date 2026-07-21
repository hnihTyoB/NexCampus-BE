export interface ClientSecurityInfo {
  ip: string;
  location: string;
  device: string;
  os: string;
  browser: string;
  time: string;
}

/**
 * Parses User-Agent header string to extract OS, Browser, and Device category.
 */
export function parseUserAgent(userAgentHeader: string | undefined): {
  device: string;
  os: string;
  browser: string;
} {
  const ua = userAgentHeader || "";

  // 1. Determine OS
  let os = "Hệ điều hành không xác định";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // 2. Determine Browser
  let browser = "Trình duyệt không xác định";
  if (/edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Google Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Mozilla Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Apple Safari";

  // 3. Determine Device Type
  let device = "Desktop";
  if (/ipad|tablet/i.test(ua)) device = "Tablet";
  else if (/mobile|iphone|android/i.test(ua)) device = "Mobile";

  return { device, os, browser };
}

/**
 * Extract clean IP address from Express Request and estimate Geo Location.
 */
export function extractClientSecurityInfo(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): ClientSecurityInfo {
  // Extract User Agent
  const rawUa = (req.headers["user-agent"] as string) || "";
  const { device, os, browser } = parseUserAgent(rawUa);

  // Extract IP Address
  let ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  // Clean IPv6 mapped IPv4
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  // Location estimation
  let location = "TP. Hồ Chí Minh, Việt Nam";
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    location = "TP. Hồ Chí Minh, Việt Nam (Local Development)";
  } else {
    // =============================================================================
    // [PRODUCTION DEPLOYMENT] Tra cứu Vị Trí THẬT từ IP thực tế khi Deploy Server:
    // 1. Cài đặt thư viện: npm install geoip-lite @types/geoip-lite
    // 2. Thêm import ở đầu file này: import geoip from "geoip-lite";
    // 3. Bỏ comment khối code bên dưới:
    //
    // const geo = geoip.lookup(ip);
    // if (geo) {
    //   location = `${geo.city ? geo.city + ", " : ""}${geo.country || ""}`.trim() || "Vị trí không xác định";
    // } else {
    //   location = "Vị trí không xác định";
    // }
    // =============================================================================
    location = "TP. Hồ Chí Minh, Việt Nam";
  }

  // Format current local timestamp
  const now = new Date();
  const time = now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return {
    ip,
    location,
    device,
    os,
    browser,
    time,
  };
}
