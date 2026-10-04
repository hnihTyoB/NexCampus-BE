import { PrismaClient } from "@prisma/client";

/**
 * Data Migration Script: Safe Dynamic RBAC & Domain Profile Migration
 * 
 * - Encapsulated in a strict Prisma Interactive Transaction
 * - Parameterized queries for SQL injection safety
 * - Idempotent: Can be run multiple times safely
 * - Zero data loss: Preserves existing relationships by mapping intern_id -> user_id
 */
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

interface TableColumnCheck {
  exists: boolean;
}

async function checkTableExists(tx: any, tableName: string): Promise<boolean> {
  const result = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    );
  `;
  return result[0]?.exists ?? false;
}

async function checkColumnExists(tx: any, tableName: string, columnName: string): Promise<boolean> {
  const result = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    );
  `;
  return result[0]?.exists ?? false;
}

async function runMigration() {
  console.log("================================================================================");
  console.log("       BẮT ĐẦU MIGRATION DỮ LIỆU AN TOÀN: DYNAMIC RBAC & DOMAIN PROFILES         ");
  console.log("================================================================================");

  await prisma.$transaction(
    async (tx) => {
      // 1. Kiểm tra trạng thái Database
      const hasInternsTable = await checkTableExists(tx, "interns");
      const hasLeadersTable = await checkTableExists(tx, "leaders");
      const hasLeaderDeptsTable = await checkTableExists(tx, "leader_departments");
      const hasInternshipProfilesTable = await checkTableExists(tx, "internship_profiles");
      const hasDepartmentManagersTable = await checkTableExists(tx, "department_managers");

      console.log(`[Khảo sát hiện trạng DB]:`);
      console.log(` - interns: ${hasInternsTable ? "Tồn tại" : "Chưa có"}`);
      console.log(` - leaders: ${hasLeadersTable ? "Tồn tại" : "Chưa có"}`);
      console.log(` - leader_departments: ${hasLeaderDeptsTable ? "Tồn tại" : "Chưa có"}`);
      console.log(` - internship_profiles: ${hasInternshipProfilesTable ? "Đã tạo" : "Chưa tạo"}`);
      console.log(` - department_managers: ${hasDepartmentManagersTable ? "Đã tạo" : "Chưa tạo"}`);

      // 2. Di chuyển dữ liệu Leaders -> Department Managers
      if (hasLeadersTable && hasDepartmentManagersTable) {
        console.log("\n[Bước 1/4] Chuyển đổi dữ liệu Leaders sang department_managers...");
        if (hasLeaderDeptsTable) {
          const inserted = await tx.$executeRawUnsafe(`
            INSERT INTO department_managers (department_id, user_id, title, is_primary, created_at)
            SELECT 
              ld.department_id,
              l.user_id,
              l.position,
              true,
              COALESCE(ld.created_at, NOW())
            FROM leader_departments ld
            JOIN leaders l ON l.id = ld.leader_id
            ON CONFLICT (department_id, user_id) DO UPDATE
            SET title = EXCLUDED.title, is_primary = EXCLUDED.is_primary;
          `);
          console.log(`   ✓ Đã chuyển đổi thành công ${inserted} bản ghi người quản lý phòng ban.`);
        }
      }

      // 3. Di chuyển dữ liệu Interns -> Internship Profiles
      if (hasInternsTable && hasInternshipProfilesTable) {
        console.log("\n[Bước 2/4] Chuyển đổi dữ liệu Interns sang internship_profiles...");
        const insertedInterns = await tx.$executeRawUnsafe(`
          INSERT INTO internship_profiles (
            id, user_id, mentor_id, department_id, position_id, start_date, duration,
            status, intern_code, university, major, discord_user_id, discord_username,
            discord_role_granted, deleted_at, created_at, updated_at
          )
          SELECT 
            i.id,
            i.user_id,
            i.leader_id,
            i.department_id,
            i.position_id,
            i.start_date,
            i.duration,
            i.status,
            i.intern_code,
            i.university,
            i.major,
            i.discord_user_id,
            i.discord_username,
            i.discord_role_granted,
            i.deleted_at,
            i.created_at,
            i.updated_at
          FROM interns i
          ON CONFLICT (user_id) DO UPDATE
          SET 
            mentor_id = EXCLUDED.mentor_id,
            department_id = EXCLUDED.department_id,
            position_id = EXCLUDED.position_id,
            start_date = EXCLUDED.start_date,
            duration = EXCLUDED.duration,
            status = EXCLUDED.status,
            intern_code = EXCLUDED.intern_code,
            university = EXCLUDED.university,
            major = EXCLUDED.major;
        `);
        console.log(`   ✓ Đã chuyển đổi thành công ${insertedInterns} hồ sơ thực tập sinh.`);
      }

      // 4. Chuẩn hóa khóa ngoại các bảng nghiệp vụ sang user_id
      if (hasInternsTable) {
        console.log("\n[Bước 3/4] Đồng bộ hóa các bảng nghiệp vụ trỏ trực tiếp về User ID...");

        // Daily Reports
        if (await checkColumnExists(tx, "daily_reports", "user_id")) {
          const updatedReports = await tx.$executeRawUnsafe(`
            UPDATE daily_reports dr
            SET user_id = i.user_id
            FROM interns i
            WHERE dr.user_id IS NULL AND dr.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedReports} bản ghi DailyReport trỏ về User ID.`);
        }

        // Task Assignments (assignee_id)
        if (await checkColumnExists(tx, "task_assignments", "assignee_id")) {
          const updatedAssignments = await tx.$executeRawUnsafe(`
            UPDATE task_assignments ta
            SET assignee_id = i.user_id
            FROM interns i
            WHERE ta.assignee_id IS NULL AND ta.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedAssignments} bản ghi TaskAssignment (assignee_id) trỏ về User ID.`);

          const updatedSupport = await tx.$executeRawUnsafe(`
            UPDATE task_assignments ta
            SET support_id = i.user_id
            FROM interns i
            WHERE ta.support_id IS NOT NULL AND ta.support_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedSupport} bản ghi TaskAssignment (support_id) trỏ về User ID.`);
        }

        // Weekly Evaluations (target_user_id & evaluator_id)
        if (await checkColumnExists(tx, "weekly_evaluations", "target_user_id")) {
          const updatedEvals = await tx.$executeRawUnsafe(`
            UPDATE weekly_evaluations we
            SET 
              target_user_id = i.user_id,
              evaluator_id = COALESCE(we.evaluator_id, we.leader_id)
            FROM interns i
            WHERE we.target_user_id IS NULL AND we.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedEvals} bản ghi WeeklyEvaluation trỏ về User ID.`);
        }

        // Task Group Members
        if (await checkColumnExists(tx, "task_group_members", "user_id")) {
          const updatedMembers = await tx.$executeRawUnsafe(`
            UPDATE task_group_members tgm
            SET user_id = i.user_id
            FROM interns i
            WHERE tgm.user_id IS NULL AND tgm.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedMembers} bản ghi TaskGroupMember trỏ về User ID.`);
        }

        // Regulation Acknowledgments
        if (await checkColumnExists(tx, "regulation_acknowledgments", "user_id")) {
          const updatedAcks = await tx.$executeRawUnsafe(`
            UPDATE regulation_acknowledgments ra
            SET user_id = i.user_id
            FROM interns i
            WHERE ra.user_id IS NULL AND ra.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedAcks} bản ghi RegulationAcknowledgment trỏ về User ID.`);
        }

        // Task Extension Requests
        if (await checkColumnExists(tx, "task_extension_requests", "user_id")) {
          const updatedExt = await tx.$executeRawUnsafe(`
            UPDATE task_extension_requests ter
            SET user_id = i.user_id
            FROM interns i
            WHERE ter.user_id IS NULL AND ter.intern_id = i.id;
          `);
          console.log(`   ✓ Đã cập nhật ${updatedExt} bản ghi TaskExtensionRequest trỏ về User ID.`);
        }
      }

      // 5. Cập nhật portal_type cho bảng roles
      if (await checkColumnExists(tx, "roles", "portal_type")) {
        console.log("\n[Bước 4/4] Cập nhật portal_type mặc định cho các Roles...");
        await tx.$executeRawUnsafe(`
          UPDATE roles SET portal_type = 'ADMIN' WHERE name IN ('ADMIN', 'MANAGER', 'USER');
          UPDATE roles SET portal_type = 'LEADER' WHERE name = 'LEADER';
          UPDATE roles SET portal_type = 'INTERN' WHERE name = 'INTERN';
        `);
        console.log("   ✓ Đã gán portal_type chuẩn cho tất cả system roles.");
      }

      console.log("\n================================================================================");
      console.log("   ✓ TOÀN BỘ QUÁ TRÌNH MIGRATION ĐÃ HOÀN TẤT THÀNH CÔNG TRONG 1 TRANSACTION!   ");
      console.log("================================================================================");
    },
    {
      timeout: 60000, // 60s timeout bảo vệ transaction
    }
  );
}

runMigration()
  .catch((err) => {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH MIGRATION (GIAO DỊCH ĐÃ ĐƯỢC TỰ ĐỘNG ROLLBACK HOÀN TOÀN):", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
