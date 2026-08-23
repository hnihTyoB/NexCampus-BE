import { prisma } from '../../database/prisma.client';

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<Set<string>>>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Periodically clean up expired role caches
    setInterval(() => {
      const now = Date.now();
      for (const [roleId, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(roleId);
        }
      }
    }, 5 * 60 * 1000).unref();
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
        // Query database for role permissions
        const roleWithPermissions = await prisma.role.findUnique({
          where: { id: roleId },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        });

        const permissionSet = new Set<string>();
        if (roleWithPermissions) {
          for (const rp of roleWithPermissions.permissions) {
            permissionSet.add(rp.permission.name);
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

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });

    if (!user || !user.roleId) {
      return [];
    }

    const permissions = await this.getRolePermissions(user.roleId);
    return Array.from(permissions);
  }

  invalidateRole(roleId: string): void {
    this.cache.delete(roleId);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const permissionCacheService = new PermissionCacheService();
