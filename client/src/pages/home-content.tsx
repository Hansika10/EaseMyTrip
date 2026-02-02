import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { MapPin, Calendar, Heart, Wallet, Sparkles, ArrowUpDown, Wand2, Users, Plus, Minus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTripStore } from "@/hooks/use-trip-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const locations = [
  { value: "bangalore", label: "Bangalore, India" },
  { value: "goa", label: "Goa, India" },
  { value: "rishikesh", label: "Rishikesh, India" },
  { value: "udaipur", label: "Udaipur, India" },
  { value: "varanasi", label: "Varanasi, India" },
  { value: "varkala", label: "Varkala, India" },
];

// Map vibes to unique images and descriptions
// Using local generic images that represent the vibe, not specific locations
const vibeImageMap: { [key: string]: string } = {
  'beach-1': '/images/vibes/beach-1.jpg',
  'beach-2': '/images/vibes/beach-2.jpg',
  'party-1': '/images/vibes/party-1.jpg',
  'party-2': '/images/vibes/party-2.jpg',
  'culture-1': '/images/vibes/culture-1.jpg',
  'culture-2': '/images/vibes/culture-2.jpg',
  'food-1': '/images/vibes/food-1.jpg',
  'food-2': '/images/vibes/food-2.jpg',
  'shop-1': '/images/vibes/shop-1.jpg',
  'shop-2': '/images/vibes/shop-2.jpg',
  'adventure-1': '/images/vibes/adventure-1.jpg',
  'adventure-2': '/images/vibes/adventure-2.jpg',
  'spiritual-1': '/images/vibes/spiritual-1.jpg',
  'spiritual-2': '/images/vibes/spiritual-2.jpg',
  'photo-1': '/images/vibes/photo-1.jpg',
  'photo-2': '/images/vibes/photo-2.jpg',
  'music-1': '/images/vibes/music-1.jpg',
  'music-2': '/images/vibes/music-2.jpg',
  'water-1': '/images/vibes/water-1.jpg',
  'water-2': '/images/vibes/water-2.jpg',
  'nature-1': '/images/vibes/nature-1.jpg',
  'nature-2': '/images/vibes/nature-2.jpg',
  'default-1': '/images/vibes/default-1.jpg',
  'default-2': '/images/vibes/default-2.jpg',
};

const usedImages = new Set<string>();

const getVibeDetails = (vibe: string) => {
  const vibeLower = vibe.toLowerCase();
  let category = 'default';
  let emoji = '✨';
  let description = 'Discover new';
  let bgColor = 'from-yellow-100 to-amber-100';
  
  if (vibeLower.includes('beach') || vibeLower.includes('relax') || vibeLower.includes('bliss')) {
    category = 'beach';
    emoji = '🏝️';
    description = 'Sun-soaked shores';
    bgColor = 'from-orange-100 to-yellow-100';
  } else if (vibeLower.includes('party') || vibeLower.includes('night') || vibeLower.includes('vibrant')) {
    category = 'party';
    emoji = '🍹';
    description = 'Electrifying evenings';
    bgColor = 'from-purple-100 to-pink-100';
  } else if (vibeLower.includes('culture') || vibeLower.includes('heritage') || vibeLower.includes('devotional') || vibeLower.includes('exploration')) {
    category = 'culture';
    emoji = '🛕';
    description = 'Rich traditions';
    bgColor = 'from-blue-100 to-cyan-100';
  } else if (vibeLower.includes('food') || vibeLower.includes('cuisine') || vibeLower.includes('dining') || vibeLower.includes('goan')) {
    category = 'food';
    emoji = '🍛';
    description = 'Culinary delights';
    bgColor = 'from-green-100 to-emerald-100';
  } else if (vibeLower.includes('shop')) {
    category = 'shop';
    emoji = '🛍️';
    description = 'Local markets';
    bgColor = 'from-pink-100 to-rose-100';
  } else if (vibeLower.includes('adventure') || vibeLower.includes('trek') || vibeLower.includes('hiking')) {
    category = 'adventure';
    emoji = '⛰️';
    description = 'Thrilling experiences';
    bgColor = 'from-slate-100 to-gray-100';
  } else if (vibeLower.includes('spirit') || vibeLower.includes('yoga') || vibeLower.includes('meditation')) {
    category = 'spiritual';
    emoji = '🧘';
    description = 'Inner peace';
    bgColor = 'from-indigo-100 to-purple-100';
  } else if (vibeLower.includes('photo') || vibeLower.includes('instagram')) {
    category = 'photo';
    emoji = '📸';
    description = 'Picture-perfect';
    bgColor = 'from-amber-100 to-orange-100';
  } else if (vibeLower.includes('music') || vibeLower.includes('festival')) {
    category = 'music';
    emoji = '🎵';
    description = 'Rhythms & celebrations';
    bgColor = 'from-red-100 to-pink-100';
  } else if (vibeLower.includes('water') || vibeLower.includes('rafting') || vibeLower.includes('river')) {
    category = 'water';
    emoji = '🚣';
    description = 'Aquatic adventures';
    bgColor = 'from-cyan-100 to-blue-100';
  } else if (vibeLower.includes('nature') || vibeLower.includes('wildlife')) {
    category = 'nature';
    emoji = '🌲';
    description = 'Natural beauty';
    bgColor = 'from-emerald-100 to-green-100';
  }
  
  // Get unique image for this vibe
  const image1 = `${category}-1`;
  const image2 = `${category}-2`;
  let imageKey = image1;
  
  if (usedImages.has(image1) && !usedImages.has(image2)) {
    imageKey = image2;
  } else if (!usedImages.has(image1)) {
    imageKey = image1;
  }
  
  usedImages.add(imageKey);
  
  return {
    emoji,
    image: vibeImageMap[imageKey] || vibeImageMap['default-1'],
    description,
    bgColor
  };
};

export type HomeVariant = "mobile" | "desktop";

export default function HomeContent({ variant }: { variant: HomeVariant }) {
  const [, setLocation] = useLocation();
  const { setCurrentTrip, setCartItems, setIsLoading } = useTripStore();
  
  const [formData, setFormData] = useState({
    from: "bangalore",
    to: "goa",
    startDate: "",
    endDate: "",
    theme: "",
    budget: [135000],
  });
  
  const [selectedTheme, setSelectedTheme] = useState("");
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequest, setCustomRequest] = useState("");
  const [showTravelers, setShowTravelers] = useState(false);
  const [travelers, setTravelers] = useState({ adults: 2, children: 0 });
  const [advancedOptions, setAdvancedOptions] = useState({
    selectAll: true,
    includeFlights: true,
    autoBook: true,
    localRecommendations: true,
  });
  
  const vibeScrollRef = useRef<HTMLDivElement>(null);
  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  // Initialize dates
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    
    setFormData(prev => ({
      ...prev,
      startDate: today,
      endDate: tomorrow.toISOString().split('T')[0],
    }));
  }, []);

  // Get the full location label for the destination
  const destinationLabel = locations.find(loc => loc.value === formData.to)?.label || formData.to;
  
  // Fetch vibes when destination changes - automatically refetches when formData.to changes
  const { data: vibesData, isLoading: vibesLoading, isError: vibesError, refetch: refetchVibes } = useQuery({
    queryKey: ["/api/vibes", formData.to],
    queryFn: async () => {
      console.log("Fetching vibes for destination:", destinationLabel);
      const result = await api.generateVibes(destinationLabel);
      console.log("Received vibes:", result);
      return result;
    },
    enabled: !!formData.to && !!destinationLabel,
    staleTime: 30 * 60 * 1000, // Consider data fresh for 30 minutes (backend caches for 1 hour)
    gcTime: 60 * 60 * 1000, // Keep cached data for 1 hour
    retry: 2, // Retry on failure
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    // refetchOnMount uses default: if data is fresh (< staleTime), use cache; otherwise refetch
  });
  
  // Reset selected theme when destination changes to prevent selecting wrong vibe
  useEffect(() => {
    setSelectedTheme("");
    setCurrentScrollIndex(0);
    // Note: Query will automatically refetch when formData.to changes due to queryKey dependency
  }, [formData.to]);

  const generateTripMutation = useMutation({
    mutationFn: api.generateTrip,
    onMutate: () => setIsLoading(true),
    onSuccess: (data) => {
      console.log('Trip generated successfully:', data);
      console.log('Trip ID:', data.trip?.id);
      console.log('Trip days:', data.trip?.days?.length || 0);
      console.log('Trip plan:', data.plan);
      
      // Check if cart items should exist
      const totalRecommendations = data.plan?.days?.reduce((sum: number, day: any) => {
        return sum + (day.recommendations?.length || day.items?.length || 0);
      }, 0) || 0;
      console.log('Expected cart items:', totalRecommendations);
      
      setCurrentTrip(data.trip);
      setCartItems([]); // Will be loaded separately by itinerary page
      
      // Small delay to ensure trip is set before navigation and cart items are created
      setTimeout(() => {
        setLocation("/itinerary");
      }, 500);
    },
    onError: (error) => {
      console.error("Error generating trip:", error);
    },
    onSettled: () => setIsLoading(false),
  });

  const handleSelectAll = (checked: boolean) => {
    setAdvancedOptions({
      selectAll: checked,
      includeFlights: checked,
      autoBook: checked,
      localRecommendations: checked,
    });
  };

  const handleAdvancedOption = (option: keyof typeof advancedOptions, checked: boolean) => {
    if (option === 'selectAll') {
      handleSelectAll(checked);
      return;
    }
    
    const newOptions = {
      ...advancedOptions,
      [option]: checked,
    };
    
    // Update selectAll based on other options
    newOptions.selectAll = newOptions.includeFlights && newOptions.autoBook && newOptions.localRecommendations;
    
    setAdvancedOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customReq = customRequest.trim();
    const tripRequest = {
      from: formData.from,
      to: formData.to,
      startDate: formData.startDate,
      endDate: formData.endDate,
      theme: selectedTheme || vibesData?.vibes[0] || "Adventure",
      budget: formData.budget[0],
      travelers: {
        adults: travelers.adults,
        children: travelers.children,
      },
      customRequest: customReq || undefined,
      advancedOptions: advancedOptions,
    };

    console.log('Submitting trip request with custom request:', customReq || 'None');
    console.log('Full trip request:', tripRequest);

    generateTripMutation.mutate(tripRequest);
  };

  const swapLocations = () => {
    setFormData(prev => ({
      ...prev,
      from: prev.to,
      to: prev.from,
    }));
  };

  const vibes = vibesData?.vibes || [];
  
  // Check scroll state when vibes change
  useEffect(() => {
    if (vibeScrollRef.current && vibes.length > 3) {
      const container = vibeScrollRef.current;
      const canScroll = container.scrollWidth > container.clientWidth;
      setCanScrollRight(canScroll);
      setCanScrollLeft(false); // Initially at the start, can't scroll left
    } else {
      setCanScrollRight(false);
      setCanScrollLeft(false);
    }
  }, [vibes]);
  
  // Reset used images on render to ensure uniqueness
  usedImages.clear();

  return (
    <main className={cn(
      "flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar fade-in min-w-0",
      variant === "desktop" ? "p-8" : "px-4 py-5"
    )}>
      {/* Header */}
      <header className={cn(
        "text-center mb-6 relative",
        variant === 'desktop' && "mb-8"
      )}>
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* Paper Plane Icon with trail */}
          <div className="relative">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
              {/* Trail/swoosh */}
              <path d="M2 12C2 12 6 8 10 10" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              {/* Paper plane */}
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 12L11 13" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#4A90E2" fillOpacity="0.2"/>
            </svg>
          </div>
          
          {/* Title with colorful dots */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Ease My Plan</h1>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-1">Your AI-powered travel companion</p>
        <p className="text-xs text-blue-500 font-medium">Powered by Gemini AI</p>
        
        {/* Gemini Wave Logo - Top Right */}
        <div className="absolute top-0 right-0">
          <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none">
            <path d="M2 12C2 12 5 6 12 6C19 6 22 12 22 12C22 12 19 18 12 18C5 18 2 12 2 12Z" stroke="#4A90E2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" fill="#4A90E2"/>
          </svg>
        </div>
      </header>

      {/* Trip Form */}
      <div className={cn(
        "bg-card rounded-xl shadow-lg border border-border/50 min-w-0",
        variant === "desktop" ? "p-8" : "p-4"
      )}>
        <form onSubmit={handleSubmit} className={cn(
          variant === 'desktop' 
            ? "max-w-4xl mx-auto grid grid-cols-2 gap-6 auto-rows-min" 
            : "space-y-6"
        )}>
        {/* Location Selection */}
        <div className={cn(
          variant === 'desktop' ? "col-span-2 relative grid grid-cols-2 gap-6" : "relative"
        )}>
          <div className="relative">
            <Label htmlFor="from" className="flex items-center text-sm font-medium text-foreground mb-2">
              <MapPin className="w-4 h-4 text-primary mr-2" />
              From
            </Label>
            <Select value={formData.from} onValueChange={(value) => setFormData(prev => ({...prev, from: value}))}>
              <SelectTrigger data-testid="select-from" className="w-full">
                <SelectValue placeholder="Select origin">
                  {locations.find(loc => loc.value === formData.from)?.label || "Select origin"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.value} value={location.value}>
                    {location.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative">
            <Label htmlFor="to" className="flex items-center text-sm font-medium text-foreground mb-2">
              <MapPin className="w-4 h-4 text-secondary mr-2" />
              To
            </Label>
            <Select value={formData.to} onValueChange={(value) => setFormData(prev => ({...prev, to: value}))}>
              <SelectTrigger data-testid="select-to" className="w-full">
                <SelectValue placeholder="Select destination">
                  {locations.find(loc => loc.value === formData.to)?.label || "Select destination"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.value} value={location.value}>
                    {location.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Swap Button - Positioned between From and To fields */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={swapLocations}
            className={cn(
              "absolute p-2 rounded-full hover:bg-accent shadow-md z-10 bg-card border-border",
              variant === 'desktop' 
                ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" 
                : "right-4 top-[50%] -translate-y-1/2"
            )}
            data-testid="swap-locations"
            aria-label="Swap locations"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {/* Date Selection */}
        <div className={cn(
          "grid gap-4",
          variant === 'desktop' ? "grid-cols-2" : "grid-cols-2"
        )}>
          <div>
            <Label htmlFor="start-date" className="flex items-center text-sm font-medium text-foreground mb-2">
              <Calendar className="w-4 h-4 text-primary mr-2" />
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
              data-testid="input-start-date"
            />
          </div>
          <div>
            <Label htmlFor="end-date" className="flex items-center text-sm font-medium text-foreground mb-2">
              <Calendar className="w-4 h-4 text-secondary mr-2" />
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
              data-testid="input-end-date"
            />
          </div>
        </div>

        {/* Number of Travelers Section */}
        <div className={cn(
          variant === 'desktop' && "col-span-2"
        )}>
          {!showTravelers ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTravelers(true)}
              className="w-full border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <Users className="w-4 h-4 mr-2 text-primary" />
              <span className="text-foreground">
                Number of Traveler(s): {travelers.adults + travelers.children} {travelers.adults + travelers.children === 1 ? 'Traveler' : 'Travelers'}
              </span>
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center text-sm font-medium text-foreground">
                  <Users className="w-4 h-4 text-primary mr-2" />
                  Number of Travelers
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTravelers(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </Button>
              </div>
              
              {/* Adults Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Adults</Label>
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setTravelers(prev => ({
                      ...prev,
                      adults: Math.max(1, prev.adults - 1)
                    }))}
                    disabled={travelers.adults <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-lg font-semibold text-foreground min-w-[3rem] text-center">
                    {travelers.adults}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setTravelers(prev => ({
                      ...prev,
                      adults: Math.min(20, prev.adults + 1)
                    }))}
                    disabled={travelers.adults >= 20}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Children Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Children</Label>
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setTravelers(prev => ({
                      ...prev,
                      children: Math.max(0, prev.children - 1)
                    }))}
                    disabled={travelers.children <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-lg font-semibold text-foreground min-w-[3rem] text-center">
                    {travelers.children}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setTravelers(prev => ({
                      ...prev,
                      children: Math.min(20, prev.children + 1)
                    }))}
                    disabled={travelers.children >= 20}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Total Display */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total Travelers</span>
                  <span className="text-lg font-bold text-primary">
                    {travelers.adults + travelers.children} {travelers.adults + travelers.children === 1 ? 'Traveler' : 'Travelers'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vibe Selection */}
        <div className={variant === 'desktop' ? "col-span-2" : ""}>
          <h2 className={cn(
            "font-semibold text-foreground mb-4 flex items-center",
            variant === 'desktop' ? "text-xl" : "text-lg"
          )}>
            <Heart className="w-5 h-5 text-secondary mr-2" />
            Select Your Vibe
          </h2>
          
          {vibesLoading ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
              <p className="text-sm font-medium">Generating personalized vibes for {destinationLabel}...</p>
              <p className="text-xs mt-1">This may take a few seconds</p>
            </div>
          ) : vibesError ? (
            <div className="text-center text-yellow-600 py-8">
              <p className="text-sm font-medium">Failed to load vibes. Showing default options.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchVibes()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : vibes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No vibes available. Please select a destination.</p>
            </div>
          ) : (
            <div className={cn(
              "relative min-w-0",
              variant === "desktop" ? "-mx-2 px-2" : "-mx-4 px-2"
            )}>
              {/* Single horizontal scroll row - scroll stays inside column on mobile */}
              <div 
                ref={vibeScrollRef}
                className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 pt-1 pl-1 pr-2 vibe-scrollbar snap-x snap-mandatory scrollbar-hide scroll-smooth"
                onScroll={(e) => {
                  const container = e.currentTarget;
                  const cardWidth = 160 + 12; // card width + gap
                  const scrollIndex = Math.round(container.scrollLeft / cardWidth);
                  setCurrentScrollIndex(scrollIndex);
                  
                  // Check if we can scroll right
                  const canScroll = container.scrollLeft < (container.scrollWidth - container.clientWidth - 10);
                  setCanScrollRight(canScroll);
                  
                  // Check if we can scroll left
                  const canScrollL = container.scrollLeft > 10;
                  setCanScrollLeft(canScrollL);
                }}
              >
                {vibes.map((vibe: string) => {
                  const details = getVibeDetails(vibe);
                  const isSelected = selectedTheme === vibe;
                  
                  return (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() => setSelectedTheme(vibe)}
                      className={cn(
                        "flex-shrink-0 w-[160px] rounded-xl transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden bg-gradient-to-br snap-center",
                        details.bgColor,
                        isSelected 
                          ? "ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02]" 
                          : "hover:ring-2 hover:ring-primary/30"
                      )}
                      data-testid={`theme-${vibe.toLowerCase().replaceAll(' ', '-')}`}
                    >
                      {/* Selected indicator - light blue background for selected */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none"></div>
                      )}
                      
                      {/* Horizontal layout - Emoji on left, text on right */}
                      <div className="p-4 flex items-center gap-3">
                        {/* Emoji Icon */}
                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-2xl">
                          {details.emoji}
                        </div>
                        
                        {/* Text content */}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="font-semibold text-sm text-foreground mb-1 leading-tight line-clamp-1">
                            {vibe}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {details.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Scroll button - Left arrow */}
              {vibes.length > 3 && canScrollLeft && (
                <button
                  type="button"
                  onClick={() => {
                    if (vibeScrollRef.current) {
                      const container = vibeScrollRef.current;
                      const cardWidth = 160 + 12; // card width + gap
                      const currentScroll = container.scrollLeft;
                      const targetScroll = currentScroll - cardWidth;
                      
                      // Smooth scroll to center the previous card
                      container.scrollTo({
                        left: targetScroll,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className="absolute top-1/2 left-2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-border/50 rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:scale-110 pointer-events-auto"
                  aria-label="Scroll left"
                >
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              {/* Scroll button - Right arrow */}
              {vibes.length > 3 && canScrollRight && (
                <button
                  type="button"
                  onClick={() => {
                    if (vibeScrollRef.current) {
                      const container = vibeScrollRef.current;
                      const cardWidth = 160 + 12; // card width + gap
                      const currentScroll = container.scrollLeft;
                      const targetScroll = currentScroll + cardWidth;
                      
                      // Smooth scroll to center the next card
                      container.scrollTo({
                        left: targetScroll,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-border/50 rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:scale-110 pointer-events-auto"
                  aria-label="Scroll right"
                >
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              
              {/* Scroll indicator dots */}
              {vibes.length > 3 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {Array.from({ length: Math.min(5, Math.ceil(vibes.length / 2)) }).map((_, i) => {
                    const maxScrollIndex = Math.min(4, Math.ceil(vibes.length / 2) - 1);
                    const activeDot = Math.min(Math.floor(currentScrollIndex / 2), maxScrollIndex);
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          i === activeDot ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                        )}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Budget Selection */}
        <div className={cn(
          "mt-8",
          variant === 'desktop' && "col-span-2"
        )}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <Wallet className="w-5 h-5 text-secondary mr-2" />
              What's Your Budget?
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary">₹{formData.budget[0]}</span>
            </div>
          </div>
          <Slider
            value={formData.budget}
            onValueChange={(value) => setFormData(prev => ({...prev, budget: value}))}
            max={250000}
            min={25000}
            step={5000}
            className="w-full"
            data-testid="budget-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span className="flex items-center">
              <Wallet className="w-3 h-3 mr-1" />
              Budget Friendly (₹25,000)
            </span>
            <span className="flex items-center">
              Luxury <Sparkles className="w-3 h-3 ml-1" />
              (₹2,50,000)
            </span>
          </div>
        </div>

        {/* Custom Request Section */}
        <div className={cn(
          "mt-8",
          variant === 'desktop' && "col-span-2"
        )}>
          {!showCustomRequest ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomRequest(true)}
              className="w-full border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <Wand2 className="w-4 h-4 mr-2 text-primary" />
              <span className="text-foreground">Add Custom Request</span>
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center text-sm font-medium text-foreground">
                  <Wand2 className="w-4 h-4 text-primary mr-2" />
                  Custom Request
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustomRequest(false);
                    setCustomRequest("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove
                </Button>
              </div>
              <textarea
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                placeholder="Add any special requests or preferences (e.g., 'I want to visit only vegetarian restaurants', 'Include water sports activities', 'Prefer luxury hotels')"
                className="w-full min-h-[100px] px-4 py-3 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                data-testid="custom-request-input"
              />
            </div>
          )}
        </div>

        {/* Create Plan Button */}
        <Button
          type="submit"
          disabled={generateTripMutation.isPending}
          className={cn(
            "w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold shadow-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-xl mt-8",
            variant === 'desktop' 
              ? "py-6 px-8 text-lg col-span-2 max-w-md mx-auto" 
              : "py-4 px-6"
          )}
          data-testid="create-plan-button"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Create My Perfect Plan!
        </Button>

        {/* Advanced Options */}
        <div className={cn(
          "mt-6 p-4 bg-muted/50 rounded-lg border border-border",
          variant === 'desktop' && "col-span-2"
        )}>
          <h3 className="font-medium text-foreground mb-2 flex items-center">
            <Sparkles className="w-4 h-4 text-muted-foreground mr-2" />
            Advanced Options
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-border/50">
              <Checkbox 
                id="select-all" 
                checked={advancedOptions.selectAll}
                onCheckedChange={(checked) => handleAdvancedOption('selectAll', checked as boolean)}
                data-testid="checkbox-select-all" 
              />
              <Label htmlFor="select-all" className="text-sm font-semibold text-foreground">
                Select All
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-flights" 
                checked={advancedOptions.includeFlights}
                onCheckedChange={(checked) => handleAdvancedOption('includeFlights', checked as boolean)}
                data-testid="checkbox-flights" 
              />
              <Label htmlFor="include-flights" className="text-sm text-foreground">
                Include flights in planning
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="auto-book" 
                checked={advancedOptions.autoBook}
                onCheckedChange={(checked) => handleAdvancedOption('autoBook', checked as boolean)}
                data-testid="checkbox-auto-book" 
              />
              <Label htmlFor="auto-book" className="text-sm text-foreground">
                Book accommodations automatically
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="local-recommendations" 
                checked={advancedOptions.localRecommendations}
                onCheckedChange={(checked) => handleAdvancedOption('localRecommendations', checked as boolean)}
                data-testid="checkbox-local" 
              />
              <Label htmlFor="local-recommendations" className="text-sm text-foreground">
                Get local recommendations
              </Label>
            </div>
          </div>
        </div>
      </form>
      </div>
    </main>
  );
}
