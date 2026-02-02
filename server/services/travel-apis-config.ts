/**
 * Central configuration for travel APIs (Amadeus, LiteAPI, OpenTripMap).
 * Base URLs, env var names, and timeouts live here so services stay DRY.
 */

export const TRAVEL_APIS = {
  /** Request timeout for each external API call (ms). */
  REQUEST_TIMEOUT_MS: 8000,

  /** Amadeus (flights) – test environment. */
  AMADEUS: {
    BASE_URL: "https://test.api.amadeus.com",
    TOKEN_PATH: "/v1/security/oauth2/token",
    FLIGHT_OFFERS_PATH: "/v2/shopping/flight-offers",
    ENV_KEY: "AMADEUS_API_KEY",
    ENV_SECRET: "AMADEUS_API_SECRET",
    /** Refresh token this many ms before expiry. */
    TOKEN_BUFFER_MS: 5 * 60 * 1000,
  },

  /** LiteAPI (hotels). */
  LITEAPI: {
    BASE_URL: "https://api.liteapi.travel/v3.0",
    HOTELS_RATES_PATH: "/hotels/rates",
    ENV_KEY: "LITEAPI_KEY",
  },

  /** OpenTripMap (activities / POIs). */
  OPENTRIPMAP: {
    BASE_URL: "https://api.opentripmap.com/0.1/en",
    PLACES_BBOX_PATH: "/places/bbox",
    ENV_KEY: "OPENTRIPMAP_API_KEY",
  },
} as const;

/** City/region name (lowercase) -> IATA airport code. */
export const CITY_TO_IATA: Record<string, string> = {
  bangalore: "BLR",
  bengaluru: "BLR",
  goa: "GOI",
  mumbai: "BOM",
  delhi: "DEL",
  "new delhi": "DEL",
  chennai: "MAA",
  hyderabad: "HYD",
  kolkata: "CCU",
  pune: "PNQ",
  ahmedabad: "AMD",
  jaipur: "JAI",
  kochi: "COK",
  udaipur: "UDR",
  varanasi: "VNS",
  rishikesh: "DED",
  varkala: "TRV",
  london: "LON",
  "new york": "NYC",
  paris: "PAR",
  dubai: "DXB",
  singapore: "SIN",
  bangkok: "BKK",
  tokyo: "TYO",
};

/** City name (lowercase) -> [lat, lon]. */
export const CITY_COORDS: Record<string, [number, number]> = {
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  goa: [15.2993, 74.124],
  mumbai: [19.076, 72.8777],
  delhi: [28.7041, 77.1025],
  "new delhi": [28.6139, 77.209],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  kolkata: [22.5726, 88.3639],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  kochi: [9.9312, 76.2673],
  udaipur: [24.5854, 73.7125],
  varanasi: [25.3176, 82.9739],
  rishikesh: [30.0869, 78.2676],
  varkala: [8.7372, 76.7167],
  london: [51.5074, -0.1278],
  "new york": [40.7128, -74.006],
  paris: [48.8566, 2.3522],
  dubai: [25.2048, 55.2708],
  singapore: [1.3521, 103.8198],
  bangkok: [13.7563, 100.5018],
  tokyo: [35.6762, 139.6503],
};
