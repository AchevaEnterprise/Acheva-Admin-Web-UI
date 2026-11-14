import { LEVELS } from './constants';
import { IDepartment } from './models/admin.model';

/**
 * How many levels a department runs (2026-11-11). Mirrors
 * `acheva-nestjs/src/schools/utils/department-levels.ts`, which is what the
 * rollover, graduation, fees and transfers actually obey.
 */
export const LEVEL_COUNT_CHOICES = [1, 2, 3, 4, 5, 6] as const;

/** "100 to 400 Level"; "100 Level" for a one-level programme. */
export function levelRangeLabel(count: number): string {
  return count === 1 ? '100 Level' : `100 to ${count * 100} Level`;
}

/**
 * The levels to offer for a department: its own when Acheva has set the
 * count, else the old fixed list for departments made before it.
 */
export function levelsFor(department: IDepartment | null | undefined): readonly string[] {
  const count = department?.levelCount;
  if (!count) return LEVELS;
  return Array.from({ length: count }, (_, index) => String((index + 1) * 100));
}
