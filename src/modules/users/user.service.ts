import bcrypt from "bcryptjs";
import { UserRepository } from "./user.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { UserQueryDto, CreateUserDto, UpdateUserDto } from "./user.dto";
import { StorageService } from "../../common/services/storage.service";
import { envConfig } from "../../config/env.config";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { EmailService } from "../../common/services/email.service";

export class UserService {
  private readonly repository = new UserRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: UserQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return user;
  }

  async create(data: CreateUserDto, actorId: string) {
      const existing = await this.repository.findByEmail(data.email);

      if (existing) {
        throw new AppError(
          "Email already exists",
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }

      // 1. XỬ LÝ ROLE: Dịch từ dạng chữ ("LEADER" / "INTERN") sang UUID thực tế trong DB
      const roleRecord = await this.repository.findRoleByName(data.role); 
      if (!roleRecord) {
        throw new AppError("Role không tồn tại trên hệ thống", 404, ERROR_CODE.NOT_FOUND);
      }

      // 2. XỬ LÝ PASSWORD: Nếu Front-end gửi trống, Back-end tự sinh mật khẩu ngẫu nhiên
      let plainPassword = data.password;
      if (!plainPassword) {
        // Sinh chuỗi ngẫu nhiên đảm bảo tính bảo mật
        const randomString = Math.random().toString(36).slice(-8);
        plainPassword = `Nex@${randomString}`; 
      }

      // 3. HASH PASSWORD VÀ INSERT VÀO DATABASE
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const result = await this.repository.create({
        email: data.email,
        passwordHash: passwordHash, 
        roleId: roleRecord.id,       // Dùng UUID vừa tìm được từ DB
      });

      await this.activityLogService.log(
        actorId,
        ACTIVITY_ACTIONS.CREATE_USER,
        `Admin đã tạo tài khoản mới: ${result.email}`,
        result.id,
        "User",
      );

      // 4. GỬI EMAIL CHÀO MỪNG KÈM TEXT PASSWORD
      try {
        const emailSubject = "[NexCampus] Tài khoản của bạn đã được tạo";
        const emailContent = `
          Chào mừng bạn đến với NexCampus!<br/><br/>
          Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập của bạn:<br/>
          <ul>
            <li><strong>Email đăng nhập:</strong> ${data.email}</li>
            <li><strong>Mật khẩu:</strong> ${plainPassword}</li>
          </ul>
          Vui lòng truy cập <a href="${envConfig.app.baseUrl}" style="color:#4f46e5;font-weight:bold;">NexCampus</a> để đăng nhập và đổi mật khẩu của bạn để bảo mật tài khoản.<br/><br/>
          Trân trọng,<br/>
          Đội ngũ NexCampus.
        `;
        await EmailService.sendMail(data.email, emailSubject, emailContent);
      } catch (emailError) {
        console.error(`[UserService] Failed to send registration email to ${data.email}:`, emailError);
      }

      return result;
    }

  async update(id: string, data: UpdateUserDto, actorId: string) {
    const targetUser = await this.findById(id);

    const result = await this.repository.update(id, {
      isActive: data.isActive,
      roleId: data.roleId,
    });

    const changes: string[] = [];
    if (data.isActive !== undefined && data.isActive !== targetUser.isActive) {
      changes.push(data.isActive ? "kích hoạt tài khoản" : "khóa tài khoản");
    }
    if (data.roleId !== undefined && data.roleId !== targetUser.roleId) {
      changes.push("thay đổi vai trò");
    }

    if (changes.length > 0) {
      await this.activityLogService.log(
        actorId,
        ACTIVITY_ACTIONS.UPDATE_USER,
        `Admin đã cập nhật tài khoản ${result.fullName || result.email}: ${changes.join(", ")}`,
        result.id,
        "User",
      );
    }

    return result;
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    const user = await this.findById(id);

    const bucket = envConfig.supabase.storageAvatarBucket;
    const storageService = new StorageService();

    // 1. Delete old avatar if it exists in storage
    if (user.avatarUrl) {
      const prefix = `${envConfig.supabase.url}/storage/v1/object/public/${bucket}/`;
      if (user.avatarUrl.startsWith(prefix)) {
        const avatarPath = user.avatarUrl.replace(prefix, "");
        try {
          await storageService.deleteFile(bucket, avatarPath);
        } catch (err) {
          console.error(`Failed to delete old avatar from storage:`, err);
        }
      }
    }

    // 2. Upload new avatar
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/${safeFileName}`;
    const avatarUrl = await storageService.uploadFile(
      bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 3. Update database
    return this.repository.update(id, { avatarUrl });
  }

  async delete(id: string, actorId: string) {
    const targetUser = await this.findById(id);
    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_USER,
      `Admin đã xóa tài khoản ${targetUser.fullName || targetUser.email}`,
      id,
      "User",
    );

    return result;
  }
}
