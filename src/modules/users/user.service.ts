import bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
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
      isActive: true, // Admin-created users are active by default
    });
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findById(id);

    return this.repository.update(id, {
      isActive: data.isActive,
    });
  }

  async softDelete(id: string, adminId: string) {
    if (id === adminId) {
      throw new AppError('Cannot delete your own account', 400, ERROR_CODE.VALIDATION_ERROR);
    }
    await this.findById(id);
    return this.repository.softDelete(id, adminId);
  }
}

