import { useViewMode } from "@/hooks/use-view-mode";
import HomeMobile from "./home-mobile";
import HomeDesktop from "./home-desktop";

export default function Home() {
  const viewMode = useViewMode({ useManualOverride: true });
  return viewMode === "mobile" ? <HomeMobile /> : <HomeDesktop />;
}
