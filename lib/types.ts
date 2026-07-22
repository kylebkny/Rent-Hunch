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

export interface TodayChallengeResponse {
  challenge_id: string;
  edition: number;
  challenge_date: string;
  clues: ListingClues;
  /** Present if the caller already locked a guess today. */
  guess: {
    round: number;
    guess_amount: number;
    score: number;
  } | null;
  /** Present if the caller has an in-progress (unlocked) game. */
  game_state: {
    current_round: number;
  } | null;
}

export interface GuessResponse {
  score: number;
  actual_rent: number;
  crowd_avg: number;
  edition: number;
  round: number;
}
