import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { jwtConfig } from '../../config/jwt.config';
import { LoginDto, LoginResponseDto, AuthTokensDto, MeDto } from './auth.dto';

export class AuthService {
  private readonly repository = new AuthRepository();

  async login(data: LoginDto, metadata?: { userAgent?: string; ipAddress?: string }): Promise<LoginResponseDto> {
    const { email, password } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError('Invalid credentials', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new AppError('Account is inactive', 403, ERROR_CODE.USER_INACTIVE);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    const payload = { id: user.id, email: user.email, role: user.role.name };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as any,
    });

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(user.id, refreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
      },
    };
  }

  async refresh(token: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthTokensDto> {
    let payload: any;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (error) {
      throw new AppError('Invalid refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    const savedToken = await this.repository.findRefreshToken(token);
    if (!savedToken) {
      throw new AppError('Invalid or expired refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    if (savedToken.expiresAt < new Date()) {
      await this.repository.deleteRefreshToken(token);
      throw new AppError('Refresh token expired', 401, ERROR_CODE.TOKEN_EXPIRED);
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, ERROR_CODE.USER_INACTIVE);
    }

    const newPayload = { id: user.id, email: user.email, role: user.role.name };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const newRefreshToken = jwt.sign(newPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as any,
    });

    await this.repository.deleteRefreshToken(token);

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(user.id, newRefreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    const result = await this.repository.deleteRefreshToken(token);

    if (result.count === 0) {
      throw new AppError('Refresh token not found or already invalidated', 400, ERROR_CODE.TOKEN_INVALID);
    }
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
