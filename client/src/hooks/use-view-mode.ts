import { useIsMobile } from "@/hooks/use-mobile";
import { useTripStore } from "@/hooks/use-trip-store";

export type ViewMode = "mobile" | "desktop";

/**
 * Returns the effective view mode: "mobile" when viewport is below breakpoint, "desktop" otherwise.
 * Set useManualOverride: true to use the store toggle instead (e.g. for dev preview).
 */
export function useViewMode(options?: { useManualOverride?: boolean }): ViewMode {
  const isMobileViewport = useIsMobile();
  const manualMode = useTripStore((s) => s.viewMode);

  if (options?.useManualOverride) {
    return manualMode;
  }
  return isMobileViewport ? "mobile" : "desktop";
}
