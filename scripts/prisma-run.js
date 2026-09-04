const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

try {
  require("dotenv").config();
} catch {
  // Fallback: parse .env thủ công nếu dotenv không được cài
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "template_db"}?schema=public`;
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const args = process.argv.slice(2);

let prismaBin;
try {
  prismaBin = require.resolve("prisma/build/index.js");
} catch {
  // Fallback path cho pnpm
  const pnpmPath = path.resolve(__dirname, "../node_modules/.pnpm");
  if (fs.existsSync(pnpmPath)) {
    const entries = fs
      .readdirSync(pnpmPath)
      .filter((e) => e.startsWith("prisma@"));
    if (entries.length > 0) {
      prismaBin = path.resolve(
        pnpmPath,
        entries[0],
        "node_modules/prisma/build/index.js",
      );
    }
  }
  if (!prismaBin) {
    // Final fallback: npx
    const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(cmd, ["prisma", ...args], {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
    child.on("exit", (code) => process.exit(code ?? 1));
    return;
  }
}

const child = spawn(process.execPath, [prismaBin, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
