import { Prisma } from "@prisma/client";
import IORedis from "ioredis";
import { rbacRepository } from "../../modules/rbac/rbac.repository";
import { userRepository } from "../../modules/users/user.repository";
import { envConfig } from "../../config/env.config";
import {
  PERMISSION_PUBSUB_CHANNEL,
  PERMISSION_PUBSUB_ACTION,
} from "../constants/permission.constant";

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

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<Set<string>>>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  private userCache = new Map<string, UserCacheEntry>();
  private userInflight = new Map<string, Promise<CachedUserState | null>>();
  private readonly USER_TTL_MS = 60 * 1000; // 1 minute

  private redisPublisher?: IORedis;
  private redisSubscriber?: IORedis;
  private isRedisAvailable = false;

  constructor() {
    if (!isTestEnv && envConfig.redis.enabled) {
      this.initRedisPubSub();
    }

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

  private initRedisPubSub(): void {
    try {
      const redisOptions = {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.isRedisAvailable = false;
            return null;
          }
          return Math.min(times * 200, 500);
        },
      };

      this.redisPublisher = new IORedis(redisOptions);
      this.redisSubscriber = new IORedis(redisOptions);

      this.redisSubscriber.on("connect", () => {
        this.isRedisAvailable = true;
        this.redisSubscriber?.subscribe(PERMISSION_PUBSUB_CHANNEL, (err) => {
          if (err) {
            console.error(
              "[PermissionCacheService] Redis subscribe error:",
              err.message,
            );
          }
        });
      });

      this.redisSubscriber.on("message", (channel, message) => {
        if (channel === PERMISSION_PUBSUB_CHANNEL) {
          try {
            const data = JSON.parse(message);
            if (
              data?.action === PERMISSION_PUBSUB_ACTION.INVALIDATE_ROLE &&
              data.roleId
            ) {
              this.invalidateRole(data.roleId, false);
            } else if (
              data?.action === PERMISSION_PUBSUB_ACTION.INVALIDATE_USER &&
              data.userId
            ) {
              this.invalidateUser(data.userId, false);
            } else if (data?.action === PERMISSION_PUBSUB_ACTION.CLEAR) {
              this.clear(false);
            }
          } catch {
            this.clear(false);
          }
        }
      });

      this.redisPublisher.on("error", () => {
        this.isRedisAvailable = false;
      });

      this.redisSubscriber.on("error", () => {
        this.isRedisAvailable = false;
      });

      this.redisSubscriber.connect().catch(() => {
        this.isRedisAvailable = false;
      });
      this.redisPublisher.connect().catch(() => {
        this.isRedisAvailable = false;
      });
    } catch {
      this.isRedisAvailable = false;
    }
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
        const user = await userRepository.findUserStateById(userId);

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
      } catch (err) {
        if (
          isTestEnv ||
          (err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025")
        ) {
          return null;
        }
        throw err;
      } finally {
        this.userInflight.delete(userId);
      }
    })();

    this.userInflight.set(userId, fetchPromise);
    return fetchPromise;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.getUserState(userId);

    if (!user || !user.roleId) {
      return [];
    }

    const permissions = await this.getRolePermissions(user.roleId);
    return Array.from(permissions);
  }

  invalidateRole(roleId: string, broadcast = true): void {
    this.cache.delete(roleId);
    if (broadcast && this.isRedisAvailable && this.redisPublisher) {
      this.redisPublisher
        .publish(
          PERMISSION_PUBSUB_CHANNEL,
          JSON.stringify({
            action: PERMISSION_PUBSUB_ACTION.INVALIDATE_ROLE,
            roleId,
          }),
        )
        .catch(() => {});
    }
  }

  invalidateUser(userId: string, broadcast = true): void {
    this.userCache.delete(userId);
    if (broadcast && this.isRedisAvailable && this.redisPublisher) {
      this.redisPublisher
        .publish(
          PERMISSION_PUBSUB_CHANNEL,
          JSON.stringify({
            action: PERMISSION_PUBSUB_ACTION.INVALIDATE_USER,
            userId,
          }),
        )
        .catch(() => {});
    }
  }

  clear(broadcast = true): void {
    this.cache.clear();
    this.userCache.clear();
    if (broadcast && this.isRedisAvailable && this.redisPublisher) {
      this.redisPublisher
        .publish(
          PERMISSION_PUBSUB_CHANNEL,
          JSON.stringify({
            action: PERMISSION_PUBSUB_ACTION.CLEAR,
          }),
        )
        .catch(() => {});
    }
  }

  async close(): Promise<void> {
    this.cache.clear();
    this.userCache.clear();
    if (this.redisSubscriber) {
      this.redisSubscriber.disconnect();
      this.redisSubscriber = undefined;
    }
    if (this.redisPublisher) {
      this.redisPublisher.disconnect();
      this.redisPublisher = undefined;
    }
  }
}

export const permissionCacheService = new PermissionCacheService();

