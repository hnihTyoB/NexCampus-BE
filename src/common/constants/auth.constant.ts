export const AUTH_PROVIDER = {
  LOCAL: "LOCAL",
  GOOGLE: "GOOGLE",
  ZALO: "ZALO",
} as const;

export type AuthProvider = keyof typeof AUTH_PROVIDER;
