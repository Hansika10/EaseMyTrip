import type { EnrichedRecommendation } from "./travel-api-types";
import { TRAVEL_APIS, CITY_TO_IATA } from "./travel-apis-config";

const { AMADEUS } = TRAVEL_APIS;
const TOKEN_CACHE: { token: string; expiresAt: number } = { token: "", expiresAt: 0 };

function getIataCode(cityOrLocation: string): string | null {
  const key = cityOrLocation.toLowerCase().trim();
  if (CITY_TO_IATA[key]) return CITY_TO_IATA[key];
  for (const [k, code] of Object.entries(CITY_TO_IATA)) {
    if (key.includes(k) || k.includes(key)) return code;
  }
  return null;
}

async function getAccessToken(): Promise<string | null> {
  const key = process.env[AMADEUS.ENV_KEY]?.trim();
  const secret = process.env[AMADEUS.ENV_SECRET]?.trim();
  if (!key || !secret) {
    console.warn("[Amadeus]", AMADEUS.ENV_KEY, "or", AMADEUS.ENV_SECRET, "missing");
    return null;
  }
  if (TOKEN_CACHE.token && Date.now() < TOKEN_CACHE.expiresAt - AMADEUS.TOKEN_BUFFER_MS) {
    return TOKEN_CACHE.token;
  }
  try {
    const res = await fetch(`${AMADEUS.BASE_URL}${AMADEUS.TOKEN_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: key,
        client_secret: secret,
      }),
    });
    if (!res.ok) {
      console.error("[Amadeus] Token request failed:", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    const token = data.access_token;
    const expiresIn = (data.expires_in ?? 1799) * 1000;
    if (!token) {
      console.error("[Amadeus] No access_token in response");
      return null;
    }
    TOKEN_CACHE.token = token;
    TOKEN_CACHE.expiresAt = Date.now() + expiresIn;
    return token;
  } catch (e) {
    console.error("[Amadeus] Token error:", e);
    return null;
  }
}

/**
 * Fetch flight offers from Amadeus (test env). Returns [] on missing key, failure, or empty.
 */
export async function getFlights(
  from: string,
  to: string,
  departureDate: string,
  returnDate: string,
  adults: number = 1
): Promise<EnrichedRecommendation[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const origin = getIataCode(from);
  const destination = getIataCode(to);
  if (!origin || !destination) {
    console.warn("[Amadeus] Could not resolve IATA for", from, "or", to);
    return [];
  }

  const params = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate,
    adults: String(adults),
  });
  if (returnDate) params.set("returnDate", returnDate);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRAVEL_APIS.REQUEST_TIMEOUT_MS);
    const res = await fetch(
      `${AMADEUS.BASE_URL}${AMADEUS.FLIGHT_OFFERS_PATH}?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[Amadeus] Flight search failed:", res.status, await res.text());
      return [];
    }
    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        price?: { total?: string; currency?: string };
        itineraries?: Array<{
          segments?: Array<{
            departure?: { iataCode?: string; at?: string };
            arrival?: { iataCode?: string; at?: string };
            carrierCode?: string;
            number?: string;
          }>;
        }>;
      }>;
    };
    const offers = data.data ?? [];
    if (offers.length === 0) return [];

    const result: EnrichedRecommendation[] = [];
    const offer = offers[0];
    const total = offer.price?.total ? parseFloat(offer.price.total) : 0;
    const currency = offer.price?.currency ?? "USD";
    const itineraries = offer.itineraries ?? [];

    if (itineraries.length >= 2) {
      const pricePerLeg = Math.round(total / 2);
      const outbound = itineraries[0];
      const ret = itineraries[1];
      const segOut = outbound?.segments?.[0];
      const segRet = ret?.segments?.[0];
      const depOut = segOut?.departure?.iataCode ?? origin;
      const arrOut = segOut?.arrival?.iataCode ?? destination;
      const depRet = segRet?.departure?.iataCode ?? destination;
      const arrRet = segRet?.arrival?.iataCode ?? origin;
      const detailsOut = segOut?.carrierCode && segOut?.number
        ? `${segOut.carrierCode}${segOut.number} ${depOut}–${arrOut}`
        : `Flight ${origin} to ${destination}`;
      const detailsRet = segRet?.carrierCode && segRet?.number
        ? `${segRet.carrierCode}${segRet.number} ${depRet}–${arrRet}`
        : `Flight ${destination} to ${origin}`;
      result.push(
        {
          type: "flight",
          title: `Flight ${from} to ${to}`,
          details: detailsOut,
          provider: "Amadeus",
          price: pricePerLeg,
          included: true,
          externalId: offer.id,
          metadata: { currency, offerId: offer.id, leg: "outbound" },
          source: "amadeus" as const,
        },
        {
          type: "flight",
          title: `Flight ${to} to ${from}`,
          details: detailsRet,
          provider: "Amadeus",
          price: pricePerLeg,
          included: true,
          externalId: offer.id,
          metadata: { currency, offerId: offer.id, leg: "return" },
          source: "amadeus",
        }
      );
    } else {
      const seg = itineraries[0]?.segments?.[0];
      const dep = seg?.departure?.iataCode ?? origin;
      const arr = seg?.arrival?.iataCode ?? destination;
      const details = seg?.carrierCode && seg?.number
        ? `${seg.carrierCode}${seg.number} ${dep}–${arr}`
        : `Flight ${dep} to ${arr}`;
      result.push({
        type: "flight",
        title: `Flight ${from} to ${to}`,
        details,
        provider: "Amadeus",
        price: Math.round(total),
        included: true,
        externalId: offer.id,
        metadata: { currency, offerId: offer.id },
        source: "amadeus",
      });
    }
    return result;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      console.warn("[Amadeus] Flight search timeout");
    } else {
      console.error("[Amadeus] Flight search error:", e);
    }
    return [];
  }
}
