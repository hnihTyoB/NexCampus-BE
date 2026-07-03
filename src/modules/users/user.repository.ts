import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { UserQueryDto } from './user.dto';

export class UserRepository {
  async findAll(query: UserQueryDto) {
    const {
      email,
      fullName,
      roleName,
      isActive,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.UserWhereInput = {
      ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
      ...(fullName ? { fullName: { contains: fullName, mode: 'insensitive' } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(roleName ? { role: { name: roleName } } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: { role: true },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    roleId: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        roleId: data.roleId,
      },
      include: { role: true },
    });
  }

  update(id: string, data: { isActive?: boolean; roleId?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });
  }
}
