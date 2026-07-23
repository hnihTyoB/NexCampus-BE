import { envConfig } from "./env.config";

export const supabaseConfig = {
  url: envConfig.supabase.url,
  secretKey: envConfig.supabase.secretKey,
  storageBucket: envConfig.supabase.storageBucket,
  storageSubmissionBucket: envConfig.supabase.storageSubmissionBucket,
  storageReportBucket: envConfig.supabase.storageReportBucket,
  storageAvatarBucket: envConfig.supabase.storageAvatarBucket,
  maxFileSizeMb: envConfig.supabase.maxFileSizeMb,
};

export default supabaseConfig;
