import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";

// ─── Models with composite primary keys (no `id` field) ──────────────────────
// These models must be skipped during id injection to avoid Prisma validation
// errors ("Unknown argument `id`").
const COMPOSITE_PK_MODELS = new Set([
  "LeaderDepartment",
  "TaskGroupMember",
]);

// ─── UUIDv7 Prisma Extension ──────────────────────────────────────────────────
// Intercepts create, createMany, and upsert operations to inject UUIDv7 primary
// keys instead of Prisma's default UUIDv4 generation.
//
// For `create`:   Prisma evaluates @default(uuid()) before calling the hook,
//                 so `args.data.id` already holds a UUIDv4 — we replace it.
// For `upsert`:   Prisma does NOT pre-populate `id` in `args.create`, so we
//                 rely on the COMPOSITE_PK_MODELS exclusion list instead of
//                 the `'id' in args.create` heuristic.
const uuidv7Extension = {
  name: "uuidv7",
  query: {
    $allModels: {
      // prisma.model.create()
      async create({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model) && args.data) {
          args.data.id = uuidv7();
        }
        return query(args);
      },

      // prisma.model.createMany()
      async createMany({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model)) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({
              ...item,
              id: uuidv7(),
            }));
          } else if (args.data) {
            args.data.id = uuidv7();
          }
        }
        return query(args);
      },

      // prisma.model.upsert() — inject on the create branch only
      async upsert({ model, args, query }: any) {
        if (!COMPOSITE_PK_MODELS.has(model) && args.create) {
          args.create.id = uuidv7();
        }
        return query(args);
      },
    },
  },
};

const baseClient = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error", "warn"],
});

export const prisma = baseClient.$extends(uuidv7Extension) as unknown as PrismaClient;
