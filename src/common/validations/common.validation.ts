import { z } from "zod";

/**
 * Standard reusable UUID validation schema
 */
export const uuidSchema = z
  .string({
    required_error: "ID is required",
    invalid_type_error: "ID must be a string",
  })
  .uuid("Invalid UUID format");

/**
 * Factory for creating reusable single-parameter UUID schemas
 * E.g. uuidParamSchema("id") -> z.object({ id: z.string().uuid(...) })
 */
export function createUuidParamSchema<K extends string = "id">(
  paramName: K = "id" as K,
  errorMessage: string = `Invalid ${paramName} format`,
) {
  return z.object({
    [paramName]: z
      .string({
        required_error: `${paramName} is required`,
        invalid_type_error: `${paramName} must be a string`,
      })
      .uuid(errorMessage),
  } as Record<K, z.ZodString>);
}

/**
 * Default standard param schema for :id
 */
export const standardIdParamSchema = createUuidParamSchema(
  "id",
  "Invalid ID format",
);

/**
 * Standard reusable pagination query schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
