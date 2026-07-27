import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Turn a Postgrest failure into something the admin can actually act on.
 *
 * These routes used to return a flat "Could not create listing", which made
 * every failure — a missing migration, a bad value, a constraint — look
 * identical. The real message is surfaced instead, with a friendlier
 * translation for the cases we can recognize.
 */
export function describeDbError(error: PostgrestError, fallback: string): string {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" — ");

  // 22P02 invalid_text_representation / 22003 numeric_value_out_of_range:
  // sending 1.5 into an int column means migration 0010 hasn't been applied.
  if (
    (error.code === "22P02" || error.code === "22003") &&
    /integer|numeric/i.test(error.message) &&
    /\d+\.\d/.test(detail)
  ) {
    return `The database still stores baths as a whole number, so half baths can't be saved. Run migration 0010 (alter table listings alter column baths type numeric(3,1)) in the Supabase SQL editor. [${detail}]`;
  }

  // 42703 undefined_column — schema is behind the code.
  if (error.code === "42703") {
    return `The database is missing a column this build expects (${error.message}). Apply the latest migration in supabase/migrations. [${detail}]`;
  }

  // 23502 not_null_violation.
  if (error.code === "23502") {
    return `A required field was empty: ${error.message}`;
  }

  // 23514 check_violation.
  if (error.code === "23514") {
    return `A value wasn't allowed by the database: ${detail}`;
  }

  return `${fallback}: ${detail || error.code || "unknown error"}`;
}
