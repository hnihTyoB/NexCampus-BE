import bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { parseUserAgent } from '../../common/helpers/user-agent.helper';
import { permissionCacheService } from '../../common/services/permission-cache.service';
import { UserQueryDto, CreateUserDto, UpdateUserDto } from './user.dto';

export class UserService {
  private readonly repository = new UserRepository();

  async findAll(query: UserQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return user;
  }

  async create(data: CreateUserDto) {
    const existing = await this.repository.findByEmail(data.email);

    if (existing) {
      throw new AppError('Email already exists', 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.repository.create({
      email: data.email,
      passwordHash,
      roleId: data.roleId,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      isActive: true, // Admin-created users are active by default
    });
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findById(id);

    const updatedUser = await this.repository.update(id, {
      isActive: data.isActive,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
    });

    permissionCacheService.invalidateUser(id);
    return updatedUser;
  }

  async softDelete(id: string, adminId: string) {
    if (id === adminId) {
      throw new AppError('Cannot delete your own account', 400, ERROR_CODE.VALIDATION_ERROR);
    }
    await this.findById(id);
    const result = await this.repository.softDelete(id, adminId);
    permissionCacheService.invalidateUser(id);
    return result;
  }

  // ────── Session Management ──────

  async getUserSessions(userId: string) {
    await this.findById(userId);
    const sessions = await this.repository.findSessionsByUserId(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceName: parseUserAgent(s.userAgent || undefined),
      ipAddress: s.ipAddress || 'Không rõ',
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeUserSession(
    userId: string,
    sessionId: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.findById(userId);
    const session = await this.repository.findSessionById(userId, sessionId);
    if (!session) {
      throw new AppError('Phiên đăng nhập không tồn tại hoặc đã hết hạn', 404, ERROR_CODE.NOT_FOUND);
    }
    await this.repository.deleteSessionById(userId, sessionId);
    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.REVOKE_USER_SESSION,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { sessionId },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }

  async revokeAllUserSessions(
    userId: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.findById(userId);
    const deleted = await this.repository.deleteAllSessionsByUserId(userId);
    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.REVOKE_ALL_USER_SESSIONS,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { revokedCount: deleted.count },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
    return { count: deleted.count };
  }

  // ────── Device Management ──────

  async getUserDevices(userId: string) {
    await this.findById(userId);
    const devices = await this.repository.findDevicesByUserId(userId);
    return devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName || 'Thiết bị không rõ',
      ipAddress: d.ipAddress || 'Không rõ',
      lastLoginAt: d.lastLoginAt,
      createdAt: d.createdAt,
    }));
  }

  async deleteUserDevice(
    userId: string,
    deviceId: string,
    adminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.findById(userId);
    const device = await this.repository.findDeviceById(userId, deviceId);
    if (!device) {
      throw new AppError('Thiết bị không tồn tại', 404, ERROR_CODE.DEVICE_NOT_FOUND);
    }
    await this.repository.deleteDeviceById(userId, deviceId);
    await this.repository.createAuditLog({
      actorId: adminId,
      action: AUDIT_ACTION.DELETE_USER_DEVICE,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { deviceId, deviceName: device.deviceName },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }
}
