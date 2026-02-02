import { useViewMode } from "@/hooks/use-view-mode";
import ItineraryMobile from "./itinerary-mobile";
import ItineraryDesktop from "./itinerary-desktop";

export default function Itinerary() {
  const viewMode = useViewMode({ useManualOverride: true });
  return viewMode === "mobile" ? <ItineraryMobile /> : <ItineraryDesktop />;
}
