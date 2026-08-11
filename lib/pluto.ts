import "server-only";

// Guarded re-export — import this from route handlers / server code, same
// pattern as lib/supabase/admin.ts. See lib/pluto-core.ts for the actual
// implementation and its verification notes.
export { lookupYearBuilt, type PlutoLookupInput } from "@/lib/pluto-core";
