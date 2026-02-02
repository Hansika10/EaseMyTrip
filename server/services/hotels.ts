import type { EnrichedRecommendation } from "./travel-api-types";
import { TRAVEL_APIS } from "./travel-apis-config";

const { LITEAPI, REQUEST_TIMEOUT_MS } = TRAVEL_APIS;

/**
 * Fetch hotel options from LiteAPI. Returns [] on missing key, failure, or empty.
 */
export async function getHotels(
  location: string,
  checkIn: string,
  checkOut: string,
  adults: number = 1
): Promise<EnrichedRecommendation[]> {
  const apiKey = process.env[LITEAPI.ENV_KEY]?.trim();
  if (!apiKey) {
    console.warn("[Hotels]", LITEAPI.ENV_KEY, "missing");
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${LITEAPI.BASE_URL}${LITEAPI.HOTELS_RATES_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        checkin: checkIn,
        checkout: checkOut,
        currency: "INR",
        guestNationality: "IN",
        occupancies: [{ adults, children: 0 }],
        cityName: location,
        limit: 10,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[Hotels] LiteAPI request failed:", res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as {
      data?: Array<{
        hotelId?: string;
        hotelName?: string;
        minRate?: { total?: number; currency?: string };
        address?: string;
        link?: string;
      }>;
    };

    const hotels = data.data ?? [];
    if (hotels.length === 0) return [];

    return hotels.slice(0, 5).map((h) => {
      const price = h.minRate?.total ?? 0;
      const details = h.address
        ? `${h.address}`
        : `Hotel in ${location}`;
      return {
        type: "hotel",
        title: h.hotelName ?? `Hotel in ${location}`,
        details,
        provider: "LiteAPI",
        price: Math.round(price),
        included: true,
        externalId: h.hotelId,
        link: h.link,
        metadata: { currency: h.minRate?.currency ?? "INR" },
        source: "liteapi",
      } satisfies EnrichedRecommendation;
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      console.warn("[Hotels] Request timeout");
    } else {
      console.error("[Hotels] Error:", e);
    }
    return [];
  }
}
