/**
 * Media Type Constants
 *
 * Centralized definitions for media type filtering across the application.
 * Live TV and music tracks are excluded from primary statistics but tracked separately.
 *
 * IMPORTANT: All SQL fragments are dynamically derived from the TypeScript arrays.
 * Changing PRIMARY_MEDIA_TYPES will automatically update all SQL.
 */

import { sql } from 'drizzle-orm';
import { MEDIA_TYPES, type MediaType } from '@tracearr/shared';

// Re-export from shared package
export const ALL_MEDIA_TYPES = MEDIA_TYPES;
export type { MediaType };

/**
 * Media types that count toward primary statistics (dashboard, plays, users, etc.)
 * Excludes live TV and music tracks - they have their own breakdowns.
 */
export const PRIMARY_MEDIA_TYPES = ['movie', 'episode'] as const;
export type PrimaryMediaType = (typeof PRIMARY_MEDIA_TYPES)[number];

/** Primary media types plus music: what the Activity media breakdown and today's plays count. */
export const PLAYS_MEDIA_TYPES = [...PRIMARY_MEDIA_TYPES, 'track'] as const;

const inClause = (types: readonly string[]) => types.map((t) => `'${t}'`).join(', ');

// Generate SQL IN clause from array - single source of truth
const primaryTypesInClause = inClause(PRIMARY_MEDIA_TYPES);

/**
 * SQL fragment for filtering to primary media types in raw queries.
 * Use this when building dynamic SQL with template literals.
 */
export const MEDIA_TYPE_SQL_FILTER = sql.raw(`AND media_type IN (${primaryTypesInClause})`);

/**
 * SQL fragment without "AND" prefix - for use with sql.join() in query builders.
 * Example: conditions.push(PRIMARY_MEDIA_TYPE_CONDITION)
 */
export const PRIMARY_MEDIA_TYPE_CONDITION = sql.raw(`media_type IN (${primaryTypesInClause})`);

/**
 * SQL fragment with table alias 's.' for sessions table joins.
 * Example: conditions.push(PRIMARY_MEDIA_TYPE_CONDITION_S)
 */
export const PRIMARY_MEDIA_TYPE_CONDITION_S = sql.raw(`s.media_type IN (${primaryTypesInClause})`);

/**
 * SQL fragment with "AND" prefix and 's.' table alias.
 * For use in raw SQL JOIN conditions.
 */
export const MEDIA_TYPE_SQL_FILTER_S = sql.raw(`AND s.media_type IN (${primaryTypesInClause})`);

/**
 * Raw SQL string for use in TimescaleDB continuous aggregate definitions.
 * Used directly in CREATE MATERIALIZED VIEW statements.
 */
export const PRIMARY_MEDIA_TYPES_SQL_LITERAL = `media_type IN (${primaryTypesInClause})`;

/** AND-prefixed filter to PLAYS_MEDIA_TYPES for raw sessions queries. */
export const PLAYS_MEDIA_TYPE_SQL_FILTER = sql.raw(
  `AND media_type IN (${inClause(PLAYS_MEDIA_TYPES)})`
);

/** Select fields for watch time (movies and episodes) and listen time (tracks) in one pass. */
export const WATCH_AND_LISTEN_MS = {
  totalMs: sql<number>`COALESCE(SUM(duration_ms) FILTER (WHERE ${PRIMARY_MEDIA_TYPE_CONDITION}), 0)::bigint`,
  listenMs: sql<number>`COALESCE(SUM(duration_ms) FILTER (WHERE media_type = 'track'), 0)::bigint`,
};
