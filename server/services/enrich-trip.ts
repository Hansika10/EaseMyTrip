import type { TripRequest } from "@shared/schema";
import { TRAVEL_APIS } from "./travel-apis-config";
import { getFlights } from "./amadeus";
import { getHotels } from "./hotels";
import { getActivities } from "./activities";

const EXTERNAL_CALL_TIMEOUT_MS = TRAVEL_APIS.REQUEST_TIMEOUT_MS;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

/**
 * WHERE RESULTS COME FROM:
 * - Plan structure and placeholder recommendations: GEMINI (generateTripPlan in gemini.ts).
 * - Real flights: AMADEUS API (getFlights in amadeus.ts) when AMADEUS_API_KEY + AMADEUS_API_SECRET are set.
 * - Real hotels: LITEAPI (getHotels in hotels.ts) when LITEAPI_KEY is set.
 * - Real activities: OPENTRIPMAP (getActivities in activities.ts) when OPENTRIPMAP_API_KEY is set.
 * Each recommendation in the returned plan has "source": "gemini" | "amadeus" | "liteapi" | "opentripmap".
 */
export async function enrichTripPlan(
  tripRequest: TripRequest,
  plan: { title: string; days: any[]; ai_summary?: string }
): Promise<{ title: string; days: any[]; ai_summary?: string }> {
  try {
    if (!plan?.days || !Array.isArray(plan.days) || plan.days.length === 0) {
      return plan;
    }

    const { from, to, startDate, endDate, theme, travelers } = tripRequest;
    const adults = travelers ? travelers.adults + (travelers.children ?? 0) : 1;
    const numDays = plan.days.length;

    let flightRecs: Awaited<ReturnType<typeof getFlights>> = [];
    let hotelRecs: Awaited<ReturnType<typeof getHotels>> = [];
    let activityRecs: Awaited<ReturnType<typeof getActivities>> = [];

    if (process.env[TRAVEL_APIS.AMADEUS.ENV_KEY]?.trim() && process.env[TRAVEL_APIS.AMADEUS.ENV_SECRET]?.trim()) {
      try {
        flightRecs = await withTimeout(
          getFlights(from, to, startDate, endDate, Math.max(1, adults)),
          EXTERNAL_CALL_TIMEOUT_MS
        );
      } catch (e) {
        console.warn("[enrich-trip] Flights failed or timeout:", e);
      }
    }

    if (process.env[TRAVEL_APIS.LITEAPI.ENV_KEY]?.trim()) {
      try {
        hotelRecs = await withTimeout(
          getHotels(to, startDate, endDate, Math.max(1, adults)),
          EXTERNAL_CALL_TIMEOUT_MS
      );
      } catch (e) {
        console.warn("[enrich-trip] Hotels failed or timeout:", e);
      }
    }

    if (process.env[TRAVEL_APIS.OPENTRIPMAP.ENV_KEY]?.trim()) {
      try {
        activityRecs = await withTimeout(
          getActivities(to, theme),
          EXTERNAL_CALL_TIMEOUT_MS
        );
      } catch (e) {
        console.warn("[enrich-trip] Activities failed or timeout:", e);
      }
    }

    const enrichedDays = plan.days.map((day: any, index: number) => {
      const dayNumber = day.day_number ?? index + 1;
      const rawRecs = day.recommendations ?? day.items;
      const recs = Array.isArray(rawRecs)
        ? rawRecs.map((r: any) => ({ ...r, source: r.source ?? "gemini" }))
        : [];
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === numDays;

      let flightIndex = -1;
      let hotelIndex = -1;
      let activityIndex = -1;
      recs.forEach((r: any, i: number) => {
        const t = (r?.type ?? "").toString().toLowerCase();
        if (t === "flight" && flightIndex < 0) flightIndex = i;
        if (t === "hotel" && hotelIndex < 0) hotelIndex = i;
        if (t === "activity" && activityIndex < 0) activityIndex = i;
      });

      if (flightRecs.length > 0) {
        if (isFirstDay && flightIndex >= 0) {
          recs[flightIndex] = { ...flightRecs[0], id: recs[flightIndex]?.id };
        }
        if (isLastDay && flightIndex >= 0 && flightRecs.length > 1) {
          recs[flightIndex] = { ...flightRecs[1], id: recs[flightIndex]?.id };
        } else if (isLastDay && flightIndex >= 0 && flightRecs.length === 1) {
          recs[flightIndex] = { ...flightRecs[0], id: recs[flightIndex]?.id };
        }
      }

      if (hotelRecs.length > 0 && hotelIndex >= 0) {
        const hotelSlot = hotelRecs[index % hotelRecs.length] ?? hotelRecs[0];
        recs[hotelIndex] = { ...hotelSlot, id: recs[hotelIndex]?.id };
      }

      if (activityRecs.length > 0 && activityIndex >= 0) {
        const activitySlot = activityRecs[index % activityRecs.length] ?? activityRecs[0];
        recs[activityIndex] = { ...activitySlot, id: recs[activityIndex]?.id };
      }

      return { ...day, recommendations: recs };
    });

    return { ...plan, days: enrichedDays };
  } catch (e) {
    console.warn("[enrich-trip] Enrichment error, returning original plan:", e);
    return plan;
  }
}
