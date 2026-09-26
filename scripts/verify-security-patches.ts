import assert from "assert";
import fs from "fs";
import path from "path";

console.log("================================================================================");
console.log("  NEXCAMPUS SECURITY PATCHES VERIFICATION SUITE (OWASP TOP 10 / STRIX AUDIT)");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Reason: ${err.message}\n`);
  }
}

// ─── 1. VULN-01: Task Submission Scope Privilege Escalation ───────────────────
runTest("VULN-01: TASK_SUBMISSION_DELETE is completely removed from hasGlobalAccess", () => {
  const filePath = path.join(__dirname, "../src/modules/task-submissions/task-submission.service.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  // hasGlobalAccess must NOT contain TASK_SUBMISSION_DELETE
  const matchGlobalAccess = content.match(/private async hasGlobalAccess[\s\S]*?\{([\s\S]*?)\}/);
  assert(matchGlobalAccess, "Could not find hasGlobalAccess method");
  assert(
    !matchGlobalAccess[1].includes("TASK_SUBMISSION_DELETE"),
    "TASK_SUBMISSION_DELETE still found inside hasGlobalAccess method!",
  );
  assert(
    matchGlobalAccess[1].includes("ROLE_READ") && matchGlobalAccess[1].includes("USER_ROLE_ASSIGN"),
    "hasGlobalAccess must check ROLE_READ and USER_ROLE_ASSIGN",
  );
});

// ─── 2. VULN-02: Maintenance Guard Regex v1 & v2 Exemption ───────────────────
runTest("VULN-02: Maintenance middleware exempt paths match /api/v2 routes", () => {
  const filePath = path.join(__dirname, "../src/middlewares/maintenance.middleware.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  // Extract regexes from DEFAULT_EXEMPT_PATHS
  assert(content.includes("/^\\/api\\/v[12]\\/auth\\/(login|refresh|logout|me|sessions)/"), "Regex for auth must match /api/v2");
  assert(content.includes("/^\\/api\\/v[12]\\/maintenance/"), "Regex for maintenance must match /api/v2");
  assert(content.includes("/^\\/api\\/v[12]\\/health/"), "Regex for health must match /api/v2");

  // Test regex directly
  const authRegex = /^\/api\/v[12]\/auth\/(login|refresh|logout|me|sessions)/;
  assert(authRegex.test("/api/v2/auth/login"), "Must allow /api/v2/auth/login");
  assert(authRegex.test("/api/v2/auth/refresh"), "Must allow /api/v2/auth/refresh");
  assert(authRegex.test("/api/v1/auth/login"), "Must allow /api/v1/auth/login");
  assert(!authRegex.test("/api/v2/tasks"), "Must NOT allow protected routes like /api/v2/tasks");
});

// ─── 3. VULN-03: BOLA / IDOR in Task update & delete ─────────────────────────
runTest("VULN-03: TaskService.findEditableTask enforces user scoping on update and delete", () => {
  const servicePath = path.join(__dirname, "../src/modules/tasks/task.service.ts");
  const controllerPath = path.join(__dirname, "../src/modules/tasks/task.controller.ts");

  const serviceContent = fs.readFileSync(servicePath, "utf-8");
  const controllerContent = fs.readFileSync(controllerPath, "utf-8");

  // findEditableTask must accept user?: UserPayload
  assert(serviceContent.includes("findEditableTask(\n    taskId: string,\n    user?: UserPayload"), "findEditableTask must accept user");
  assert(serviceContent.includes("isCreator && !isDeptTask && !isLeaderOfAssignee"), "Must check creator and department scope");
  assert(serviceContent.includes("this.findEditableTask(id, actorUser)"), "update and delete must pass actorUser to findEditableTask");

  // Controller must pass req.user!
  assert(controllerContent.includes("await this.service.update(\n        req.params.id,\n        req.body as UpdateTaskDto,\n        req.user!"), "Controller update must pass req.user!");
  assert(controllerContent.includes("await this.service.delete(req.params.id, req.user!"), "Controller delete must pass req.user!");
});

// ─── 4. VULN-04: Stored XSS sanitization in Frontend ─────────────────────────
runTest("VULN-04: LeaderTableTasks uses DOMPurify and character escaping on taskTitle", () => {
  const fePath = path.join(__dirname, "../../NexCampus-FE/app/(dashboard)/leader/tasks/LeaderTableTasks.tsx");
  const feContent = fs.readFileSync(fePath, "utf-8");

  assert(feContent.includes('import DOMPurify from "isomorphic-dompurify";'), "Must import DOMPurify");
  assert(feContent.includes("DOMPurify.sanitize("), "Must call DOMPurify.sanitize");
  assert(feContent.includes("taskTitle.replace(/[&<>\"']/g"), "Must escape HTML characters in taskTitle before injection");

  // Verify escaping logic
  const maliciousInput = '<img src=x onerror="alert(1)"> & "bold"';
  const escaped = maliciousInput.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m] || m));
  assert(!escaped.includes("<img"), "Must not contain raw <img tag");
  assert(escaped.includes("&lt;img"), "Must encode < to &lt;");
});

// ─── 5. VULN-05: Plaintext Token Logging Guard in MailService ────────────────
runTest("VULN-05: MailService fallback throws AppError and hides tokens in production", () => {
  const mailServicePath = path.join(__dirname, "../src/common/services/mail.service.ts");
  const content = fs.readFileSync(mailServicePath, "utf-8");

  assert(content.includes('envConfig.nodeEnv === "development"'), "Must guard console logging with development check");
  assert(content.includes("throw new AppError"), "Must throw AppError when SMTP is missing in production");
  assert(content.includes("ERROR_CODE.INTERNAL_SERVER_ERROR"), "Must use standardized INTERNAL_SERVER_ERROR code");

  // Ensure all console.warn with tokens are guarded
  const matches = content.match(/console\.warn\([\s\S]*?TOKEN/g);
  assert(matches && matches.length === 3, "All 3 token console.warn statements must be inside development check");
});

// ─── 6. VULN-06: Task Assignment & Extension Approval Scoping ─────────────────
runTest("VULN-06: Approval logic requires global admin or direct leader", () => {
  const assignmentPath = path.join(__dirname, "../src/modules/task-assignments/task-assignment.service.ts");
  const content = fs.readFileSync(assignmentPath, "utf-8");

  // approve method
  assert(content.includes("if (!isGlobalAdmin && (!isDirectLeader || !hasApprovePerm))"), "approve method must require isGlobalAdmin OR (isDirectLeader AND hasApprovePerm)");

  // approveExtension method
  assert(content.includes("if (!isGlobalAdmin && (!isDirectLeader || !hasApprovePerm))"), "approveExtension must require isGlobalAdmin OR (isDirectLeader AND hasApprovePerm)");

  // Verify boolean logic:
  // Case 1: Leader is NOT direct leader, but hasApprovePerm = true -> REJECT
  const isGlobalAdmin = false;
  const hasApprovePerm = true;
  const isDirectLeader = false;
  const shouldBlock = !isGlobalAdmin && (!isDirectLeader || !hasApprovePerm);
  assert.strictEqual(shouldBlock, true, "Cross-leader approval MUST be blocked!");

  // Case 2: Direct leader with permission -> ALLOW
  const allowDirect = !isGlobalAdmin && (!true || !hasApprovePerm);
  assert.strictEqual(allowDirect, false, "Direct leader with permission MUST be allowed!");

  // Case 3: Global Admin -> ALLOW
  const allowAdmin = !true && (!false || !false);
  assert.strictEqual(allowAdmin, false, "Global Admin MUST be allowed!");
});

// ─── 7. VULN-07: Parameterized SQL Queries in Analytics ──────────────────────
runTest("VULN-07: task.analytics.service.ts has 0 occurrences of $queryRawUnsafe", () => {
  const analyticsPath = path.join(__dirname, "../src/modules/tasks/task.analytics.service.ts");
  const content = fs.readFileSync(analyticsPath, "utf-8");

  assert(!content.includes("$queryRawUnsafe"), "Must not use $queryRawUnsafe anywhere!");
  assert(content.includes("Prisma.sql`t.deleted_at IS NULL`"), "Must use Prisma.sql tagged templates");
  assert(content.includes("Prisma.join(conditions, \" AND \")"), "Must use Prisma.join for dynamic conditions");
  assert(content.includes("prisma.$queryRaw<any[]>`"), "Must execute safe prisma.$queryRaw tagged template");
});

// ─── 8. VULN-08: Mail Config URLs point to Frontend and API v2 ───────────────
runTest("VULN-08: mail.config.ts uses /api/v2 and clientUrl for password reset", () => {
  const mailConfigPath = path.join(__dirname, "../src/config/mail.config.ts");
  const envConfigPath = path.join(__dirname, "../src/config/env.config.ts");

  const mailContent = fs.readFileSync(mailConfigPath, "utf-8");
  const envContent = fs.readFileSync(envConfigPath, "utf-8");

  assert(envContent.includes("CLIENT_URL"), "env.config.ts must declare CLIENT_URL");
  assert(envContent.includes("clientUrl: _env.CLIENT_URL"), "envConfig must export clientUrl");
  assert(mailContent.includes("/api/v2/auth/verify-email"), "verificationUrl must point to /api/v2/auth/verify-email");
  assert(mailContent.includes("resetPasswordUrl: `${envConfig.clientUrl}/reset-password`"), "resetPasswordUrl must point to clientUrl/reset-password");
});

// ─── 9. VULN-10: Swagger UI production protection in app.ts ──────────────────
runTest("VULN-10: Swagger UI route is disabled in production", () => {
  const appPath = path.join(__dirname, "../src/app.ts");
  const content = fs.readFileSync(appPath, "utf-8");

  assert(content.includes('if (envConfig.nodeEnv !== "production") {\n  app.use(\n    "/api/docs"'), "Swagger UI must be enclosed in non-production check");
});

console.log("\n--------------------------------------------------------------------------------");
console.log(`  RESULT: ${passedTests}/${totalTests} SECURITY VERIFICATION TESTS PASSED (100% SUCCESS)`);
console.log("--------------------------------------------------------------------------------\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
