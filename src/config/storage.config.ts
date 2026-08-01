import { envConfig } from "./env.config";

const endpoint =
  envConfig.r2.endpoint ||
  (envConfig.r2.accountId
    ? `https://${envConfig.r2.accountId}.r2.cloudflarestorage.com`
    : "");

export const storageConfig = {
  endpoint,
  accessKeyId: envConfig.r2.accessKeyId,
  secretAccessKey: envConfig.r2.secretAccessKey,
  bucketName: envConfig.r2.bucketName,
  publicUrl: envConfig.r2.publicUrl.replace(/\/+$/, ""),
  namespaces: {
    tasks: envConfig.r2.taskPrefix,
    submissions: envConfig.r2.submissionPrefix,
    reports: envConfig.r2.reportPrefix,
    avatars: envConfig.r2.avatarPrefix,
    applications: envConfig.r2.applicationPrefix,
  },
  maxFileSizeMb: envConfig.r2.maxFileSizeMb,
};

export default storageConfig;
