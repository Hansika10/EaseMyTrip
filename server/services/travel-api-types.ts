/**
 * Where this recommendation was fetched from. Use this to show "From Amadeus" / "From Gemini" etc.
 * - gemini: AI-generated placeholder (no external API)
 * - amadeus: Flight Offers Search API
 * - liteapi: Hotels API
 * - opentripmap: Activities/POI API
 */
export type RecommendationSource = "gemini" | "amadeus" | "liteapi" | "opentripmap";

/**
 * Shared type for recommendations returned by travel APIs (Amadeus, hotels, activities).
 * All providers map their responses to this shape so the enrich step can merge into the plan.
 */
export interface EnrichedRecommendation {
  type: "flight" | "hotel" | "activity";
  title: string;
  details: string;
  provider: string;
  price: number;
  included?: boolean;
  externalId?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Where this result was fetched from: Gemini (AI) or external API (amadeus, liteapi, opentripmap). */
  source?: RecommendationSource;
}
