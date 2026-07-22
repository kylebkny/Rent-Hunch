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

export interface TodayChallengeResponse {
  challenge_id: string;
  edition: number;
  challenge_date: string;
  clues: ListingClues;
  photos: string[];
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
}

export type GuessResponse = GuessHintResponse | GuessFinalResponse;
