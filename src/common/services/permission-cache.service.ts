import { rbacRepository } from "../../modules/rbac/rbac.repository";
import { userRepository } from "../../modules/users/user.repository";
import { prisma } from "../../database/prisma.client";

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

export interface CachedUserState {
  id: string;
  isActive: boolean;
  deletedAt: Date | null;
  roleId: string | null;
  roleName: string | null;
}

interface UserCacheEntry {
  user: CachedUserState | null;
  expiresAt: number;
}

export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<Set<string>>>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  private userCache = new Map<string, UserCacheEntry>();
  private userInflight = new Map<string, Promise<CachedUserState | null>>();
  private readonly USER_TTL_MS = 60 * 1000; // 1 minute

  constructor() {
    // Periodically clean up expired role and user caches
    setInterval(
      () => {
        const now = Date.now();
        for (const [roleId, entry] of this.cache.entries()) {
          if (now > entry.expiresAt) {
            this.cache.delete(roleId);
          }
        }
        for (const [userId, entry] of this.userCache.entries()) {
          if (now > entry.expiresAt) {
            this.userCache.delete(userId);
          }
        }
      },
      5 * 60 * 1000,
    ).unref();
  }

  async getRolePermissions(roleId: string): Promise<Set<string>> {
    const cached = this.cache.get(roleId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.permissions;
    }

    const inflightPromise = this.inflight.get(roleId);
    if (inflightPromise) {
      return inflightPromise;
    }

    const fetchPromise = (async () => {
      try {
        // Query repository for role permissions
        const roleWithPermissions = await rbacRepository.findRoleById(roleId);

        const permissionSet = new Set<string>();
        if (roleWithPermissions && roleWithPermissions.permissions) {
          for (const perm of roleWithPermissions.permissions) {
            permissionSet.add(perm.name);
          }
        }

        this.cache.set(roleId, {
          permissions: permissionSet,
          expiresAt: Date.now() + this.TTL_MS,
        });

        return permissionSet;
      } finally {
        this.inflight.delete(roleId);
      }
    })();

    this.inflight.set(roleId, fetchPromise);
    return fetchPromise;
  }

  async getUserState(userId: string): Promise<CachedUserState | null> {
    const cached = this.userCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.user;
    }

    const inflightPromise = this.userInflight.get(userId);
    if (inflightPromise) {
      return inflightPromise;
    }

    const fetchPromise = (async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
            roleId: true,
            role: { select: { name: true } },
          },
        });

        const userState: CachedUserState | null = user
          ? {
              id: user.id,
              isActive: user.isActive,
              deletedAt: user.deletedAt,
              roleId: user.roleId,
              roleName: user.role?.name || null,
            }
          : null;

        this.userCache.set(userId, {
          user: userState,
          expiresAt: Date.now() + this.USER_TTL_MS,
        });

        return userState;
      } finally {
        this.userInflight.delete(userId);
      }
    })();

    this.userInflight.set(userId, fetchPromise);
    return fetchPromise;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await userRepository.findById(userId);

    if (!user || !user.roleId) {
      return [];
    }

    const permissions = await this.getRolePermissions(user.roleId);
    return Array.from(permissions);
  }

  invalidateRole(roleId: string): void {
    this.cache.delete(roleId);
  }

  invalidateUser(userId: string): void {
    this.userCache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
    this.userCache.clear();
  }
}

export const permissionCacheService = new PermissionCacheService();
