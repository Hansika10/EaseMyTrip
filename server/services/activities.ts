import type { EnrichedRecommendation } from "./travel-api-types";
import { TRAVEL_APIS, CITY_COORDS } from "./travel-apis-config";

const { OPENTRIPMAP, REQUEST_TIMEOUT_MS } = TRAVEL_APIS;

/** OpenTripMap kinds: cultural, natural, architecture, historic, etc. */
const DEFAULT_KINDS = "cultural,historic_architecture,interesting_places,natural";

function getCoords(cityOrLocation: string): [number, number] | null {
  const key = cityOrLocation.toLowerCase().trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  for (const [k, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return coords;
  }
  return null;
}

/**
 * Fetch activity/POI options from OpenTripMap. Returns [] on missing key, failure, or empty.
 */
export async function getActivities(
  location: string,
  _theme?: string
): Promise<EnrichedRecommendation[]> {
  const apiKey = process.env[OPENTRIPMAP.ENV_KEY]?.trim();
  if (!apiKey) {
    console.warn("[Activities]", OPENTRIPMAP.ENV_KEY, "missing");
    return [];
  }

  const coords = getCoords(location);
  if (!coords) {
    console.warn("[Activities] No coordinates for location:", location);
    return [];
  }

  const [lat, lon] = coords;
  const delta = 0.15;
  const lon_min = lon - delta;
  const lon_max = lon + delta;
  const lat_min = lat - delta;
  const lat_max = lat + delta;

  try {
    const params = new URLSearchParams({
      lon_min: String(lon_min),
      lon_max: String(lon_max),
      lat_min: String(lat_min),
      lat_max: String(lat_max),
      kinds: DEFAULT_KINDS,
      limit: "10",
      apikey: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(
      `${OPENTRIPMAP.BASE_URL}${OPENTRIPMAP.PLACES_BBOX_PATH}?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[Activities] OpenTripMap request failed:", res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as Array<{
      name?: string;
      xid?: string;
      kind?: string;
      point?: { lon?: number; lat?: number };
    }>;

    if (!Array.isArray(data) || data.length === 0) return [];

    return data.slice(0, 8).map((place) => {
      const name = place.name ?? "Local attraction";
      const kind = place.kind ?? "activity";
      const details = kind ? `${kind.replaceAll("_", " ")}` : `Point of interest in ${location}`;
      return {
        type: "activity",
        title: name,
        details,
        provider: "OpenTripMap",
        price: 0,
        included: true,
        externalId: place.xid,
        link: place.xid
          ? `https://www.opentripmap.com/en/card/${place.xid}`
          : undefined,
        metadata: { kinds: place.kind },
        source: "opentripmap",
      } satisfies EnrichedRecommendation;
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      console.warn("[Activities] Request timeout");
    } else {
      console.error("[Activities] Error:", e);
    }
    return [];
  }
}
