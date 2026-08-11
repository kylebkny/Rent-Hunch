import type { HintDirection, WarmthBand } from "@/lib/scoring";

export type Amenities = string[];

export interface ListingClues {
  neighborhood: string;
  city: string;
  beds: number;
  baths: number;
  /** Rentals rarely have sqft on file, so this is optional. */
  sqft: number | null;
  amenities: Amenities;
  /** Nearest train stop(s). */
  transit: string;
  /** "Places it's near" — parks, landmarks, etc. */
  nearby: string | null;
}

/** One in-progress guess: the amount plus the hint the player got back. */
export interface GuessAttempt {
  amount: number;
  direction: HintDirection;
  band: WarmthBand;
}

/**
 * What spending the puzzle's one hint token reveals — bundled together, not
 * a choice between them. year_built is null when PLUTO has no match for
 * this listing (not an error, just nothing on file); map_url is null when
 * there's no lat/lng to build a radius map from, or no Maps key configured.
 */
export interface HintReveal {
  year_built: number | null;
  map_url: string | null;
}

export interface TodayChallengeResponse {
  challenge_id: string;
  edition: number;
  challenge_date: string;
  clues: ListingClues;
  photos: string[];
  /**
   * Ceiling for the guess slider, derived from the whole featurable-listing
   * pool (never today's specific listing) — see lib/listings-pool.ts.
   */
  slider_max: number;
  /** Present if the caller already finished today. */
  guess: {
    round: number;
    guess_amount: number;
    score: number;
  } | null;
  /** In-progress game: current clue round + guesses made so far. */
  game_state: {
    current_round: number;
    guesses: GuessAttempt[];
  } | null;
  /** The hint token's reveal, if already spent this puzzle — else null. */
  hint: HintReveal | null;
}

/** Intermediate response after a non-final guess. */
export interface GuessHintResponse {
  final: false;
  attempt: number;
  round: number;
  guesses: GuessAttempt[];
}

/** Final response — the only place actual_rent reaches the client. */
export interface GuessFinalResponse {
  final: true;
  score: number;
  actual_rent: number;
  crowd_avg: number;
  edition: number;
  guesses_used: number;
  best_guess: number;
  guesses: GuessAttempt[];
  percentile: number;
  streak: number;
  display_name: string | null;
  listing_url: string | null;
  rank: number;
  players_today: number;
}

export type GuessResponse = GuessHintResponse | GuessFinalResponse;
