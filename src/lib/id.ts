/**
 * UUIDv7 ID Generation Utility
 *
 * UUID version 7 combines a Unix timestamp (millisecond precision) with
 * random bits, resulting in monotonically increasing, sortable identifiers
 * that perform significantly better than UUIDv4 in database indexes.
 *
 * Format: tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
 *   - t = 48-bit timestamp (ms since Unix epoch)
 *   - 7 = version nibble
 *   - x = random bits
 *   - y = variant bits (8, 9, a, b)
 */
import { uuidv7 } from "uuidv7";

/**
 * Generate a new UUIDv7 — timestamp-ordered, database-friendly.
 */
export function generateId(): string {
  return uuidv7();
}

export { uuidv7 };
