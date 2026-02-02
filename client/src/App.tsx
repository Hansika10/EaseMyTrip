import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/home";
import Itinerary from "@/pages/itinerary";
import Cart from "@/pages/cart";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

import LoadingOverlay from "@/components/loading-overlay";
import FooterNavigation from "@/components/footer-navigation";
import ChatModal from "@/components/chat-modal";
import ViewModeToggle from "@/components/view-mode-toggle";
import { useViewMode } from "@/hooks/use-view-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTripStore } from "@/hooks/use-trip-store";
import { useEffect, useRef } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/itinerary" component={Itinerary} />
      <Route path="/cart" component={Cart} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Use manual view mode so the Mobile/Desktop toggle actually controls layout
  const viewMode = useViewMode({ useManualOverride: true });
  const isMobileViewport = useIsMobile();
  const setViewMode = useTripStore((s) => s.setViewMode);
  const hasSyncedViewport = useRef(false);
  // Sync store to viewport once on mount so initial layout matches screen size
  useEffect(() => {
    if (hasSyncedViewport.current) return;
    hasSyncedViewport.current = true;
    setViewMode(isMobileViewport ? "mobile" : "desktop");
  }, [isMobileViewport, setViewMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="w-full min-h-screen flex justify-center relative z-10">
          {/* Main Container - Mobile: narrow phone-like width; Desktop: wide */}
          <div className={viewMode === "desktop"
            ? "w-full max-w-7xl mx-auto min-h-screen flex flex-col relative"
            : "w-full max-w-[420px] min-w-0 mx-auto min-h-screen flex flex-col relative overflow-x-hidden"
          }>
            {/* Loading Overlay */}
            <LoadingOverlay />
            
            {/* View Mode Toggle - Positioned below header area */}
            <ViewModeToggle />
            
            {/* Main Content */}
            <Router />
            
            {/* Footer Navigation */}
            <FooterNavigation />
            
            {/* Chat Modal */}
            <ChatModal />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
