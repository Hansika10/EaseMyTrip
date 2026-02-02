import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Share, MapPin, Clock, Star, BarChart3, Wand2, X } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTripStore } from "@/hooks/use-trip-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CartItem } from "@shared/schema";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type UpgradeOption = {
  id: string;
  title: string;
  details: string;
  provider?: string;
  price: number;
  badge?: string;
};

export type ItineraryVariant = "mobile" | "desktop";

export default function ItineraryContent({ variant }: { variant: ItineraryVariant }) {
  const [, setLocation] = useLocation();
  const { currentTrip, selectedDay, setSelectedDay, cartItems, setCartItems } = useTripStore();
  const queryClient = useQueryClient();
  const dayRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const mainRef = useRef<HTMLElement | null>(null);
  
  // State for upgrade functionality
  const [openUpgradeItemId, setOpenUpgradeItemId] = useState<string | null>(null);
  const [originalItems, setOriginalItems] = useState<Map<string, CartItem>>(new Map());

  // Fetch cart items when trip is loaded
  const { data: cartData, isLoading: cartLoading, refetch: refetchCart } = useQuery({
    queryKey: ["/api/trips", currentTrip?.id, "cart"],
    queryFn: async () => {
      if (!currentTrip?.id) return [];
      console.log('Fetching cart items for trip:', currentTrip.id);
      const items = await api.getCartItems(currentTrip.id);
      console.log('Received cart items:', items?.length || 0, items);
      return items;
    },
    enabled: !!currentTrip?.id,
    refetchOnMount: true,
    retry: 2,
  });

  // Mutation to update cart item inclusion status
  const updateCartItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CartItem> }) => 
      api.updateCartItem(id, updates),
    onSuccess: () => {
      if (currentTrip) {
        queryClient.invalidateQueries({ queryKey: ["/api/trips", currentTrip.id, "cart"] });
      }
    },
  });

  // Helper function to find original item from trip plan
  // Matches cart items to trip plan recommendations by type and day
  const findOriginalItemFromTripPlan = (cartItem: CartItem): CartItem | null => {
    if (!currentTrip?.days) return null;
    
    const day = (currentTrip.days as any[]).find(d => d.day_number === cartItem.dayNumber);
    if (!day) return null;
    
    const recommendations = day.recommendations || day.items || [];
    const itemsOfSameType = recommendations.filter((rec: any) => rec.type === cartItem.type);
    
    if (itemsOfSameType.length === 0) return null;
    
    // If only one item of this type exists in the day, use it
    if (itemsOfSameType.length === 1) {
      const rec = itemsOfSameType[0];
      return {
        ...rec,
        id: cartItem.id, // Keep the cart item ID
        dayNumber: cartItem.dayNumber,
        included: cartItem.included,
      } as CartItem;
    }
    
    // If multiple items of same type, try to match by finding the one that doesn't exist in cart
    // OR match by position/order (cart items are created in the same order as recommendations)
    // For now, check if cartItem's title matches any recommendation exactly
    const exactMatch = itemsOfSameType.find((rec: any) => 
      rec.title === cartItem.title && rec.price === cartItem.price
    );
    
    if (exactMatch) {
      return {
        ...exactMatch,
        id: cartItem.id,
        dayNumber: cartItem.dayNumber,
        included: cartItem.included,
      } as CartItem;
    }
    
    // If no exact match, the item has been upgraded - use the first recommendation of this type
    // This assumes cart items are created in order
    return {
      ...itemsOfSameType[0],
      id: cartItem.id,
      dayNumber: cartItem.dayNumber,
      included: cartItem.included,
    } as CartItem;
  };

  // Helper function to detect if a cart item has been upgraded
  const isItemUpgradedFromTripPlan = (cartItem: CartItem): boolean => {
    if (!currentTrip?.days) return false;
    
    const day = (currentTrip.days as any[]).find(d => d.day_number === cartItem.dayNumber);
    if (!day) return false;
    
    const recommendations = day.recommendations || day.items || [];
    
    // Check if any recommendation matches this cart item exactly
    const hasExactMatch = recommendations.some((rec: any) => 
      rec.type === cartItem.type &&
      rec.title === cartItem.title &&
      rec.price === cartItem.price
    );
    
    // If no exact match found, the item has been upgraded
    return !hasExactMatch;
  };

  useEffect(() => {
    if (cartData && Array.isArray(cartData) && currentTrip) {
      console.log('Setting cart items:', cartData.length, cartData);
      console.log('Cart items by day:', cartData.reduce((acc: any, item: any) => {
        const day = item.dayNumber || 'unknown';
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {}));
      
      setCartItems(cartData);
      
      // Restore originalItems Map by detecting upgrades from trip plan
      const restoredOriginals = new Map<string, CartItem>();
      cartData.forEach((item: CartItem) => {
        if (isItemUpgradedFromTripPlan(item)) {
          const original = findOriginalItemFromTripPlan(item);
          if (original) {
            restoredOriginals.set(item.id, original);
          }
        }
      });
      
      if (restoredOriginals.size > 0) {
        console.log('Restored upgraded items:', restoredOriginals.size);
        setOriginalItems(restoredOriginals);
      }
    } else if (cartData === undefined && !cartLoading && currentTrip?.id) {
      // If no cart data and query has completed, try refetching once after a short delay
      console.log('No cart data, attempting refetch after delay...');
      const timeoutId = setTimeout(() => {
        refetchCart();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [cartData, setCartItems, cartLoading, currentTrip, refetchCart]);

  // Get trip days early (needed for useEffect)
  const tripDays = currentTrip?.days as any[] || [];
  
  // Set default selected day to Day 1 if no day is selected and trip has days
  useEffect(() => {
    if (currentTrip && tripDays.length > 0 && !selectedDay) {
      setSelectedDay(tripDays[0].day_number);
    }
  }, [currentTrip, tripDays, selectedDay, setSelectedDay]);

  // Scroll to top when day changes (since we're showing single day per page)
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [selectedDay]);

  if (!currentTrip) {
    return (
      <div className="flex-grow flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">No Trip Found</h2>
          <p className="text-muted-foreground mb-4">Please create a trip first</p>
          <Button onClick={() => setLocation("/")} data-testid="go-home-button">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Helper function to get date for a specific day
  const getDateForDay = (dayNumber: number) => {
    if (!currentTrip.startDate) return null;
    const startDate = new Date(currentTrip.startDate);
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + (dayNumber - 1));
    return dayDate;
  };
  
  // Helper function to format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Helper function to get day name
  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'flight': return '✈️';
      case 'hotel': return '🏨';
      case 'activity': return '🎯';
      default: return '📍';
    }
  };

  const getDayStats = (dayNumber: number) => {
    const dayCartItems = cartItems.filter(item => item.dayNumber === dayNumber);
    return {
      activities: dayCartItems.length,
      cost: dayCartItems.filter(item => item.included).reduce((sum, item) => sum + item.price, 0),
      duration: "8hr" // Mock duration
    };
  };

  const handleToggleItem = (itemId: string, newIncluded: boolean) => {
    setCartItems(cartItems.map(cartItem => 
      cartItem.id === itemId 
        ? { ...cartItem, included: newIncluded }
        : cartItem
    ));
    updateCartItemMutation.mutate({
      id: itemId,
      updates: { included: newIncluded }
    });
  };

  // Generate upgrade options based on item type
  const generateUpgradeOptions = (item: CartItem): UpgradeOption[] => {
    const basePrice = item.price;
    
    if (item.type === 'flight') {
      // Extract flight details
      const flightMatch = item.details.match(/(\d+):(\d+)\s*(AM|PM)/i);
      const airline = item.provider || 'IndiGo';
      
      return [
        {
          id: `${item.id}-upgrade-1`,
          title: `${item.title} - Premium Seats`,
          details: item.details.replace(airline, airline + ' with Premium Seats'),
          provider: airline,
          price: Math.round(basePrice * 1.3),
          badge: 'Premium Seats'
        },
        {
          id: `${item.id}-upgrade-2`,
          title: `${item.title} - With Food`,
          details: item.details + ' Includes complimentary meals and beverages.',
          provider: airline,
          price: Math.round(basePrice * 1.2),
          badge: 'Meals Included'
        },
        {
          id: `${item.id}-upgrade-3`,
          title: `${item.title} - Premium Seats + Food`,
          details: item.details.replace(airline, airline) + ' Premium seats with complimentary meals and beverages.',
          provider: airline,
          price: Math.round(basePrice * 1.5),
          badge: 'Premium + Meals'
        },
        {
          id: `${item.id}-upgrade-4`,
          title: `${item.title} - Business Class`,
          details: item.details.replace(airline, airline + ' Business Class'),
          provider: airline,
          price: Math.round(basePrice * 2.5),
          badge: 'Business Class'
        },
        {
          id: `${item.id}-upgrade-5`,
          title: `${item.title} - Different Time (Premium)`,
          details: item.details.replace(/\d+:\d+\s*(AM|PM)/i, flightMatch ? 
            (parseInt(flightMatch[1]) + 2).toString().padStart(2, '0') + ':' + flightMatch[2] + ' ' + flightMatch[3] : 
            '10:00 AM') + ' More convenient departure time.',
          provider: airline,
          price: Math.round(basePrice * 1.4),
          badge: 'Better Timing'
        }
      ];
    } else if (item.type === 'hotel') {
      const hotelName = item.title;
      const location = item.provider || '';
      
      return [
        {
          id: `${item.id}-upgrade-1`,
          title: `${hotelName} - Deluxe Room`,
          details: item.details.replace(/standard|basic/i, 'deluxe') + ' Larger room with better amenities.',
          provider: location,
          price: Math.round(basePrice * 1.3),
          badge: 'Deluxe'
        },
        {
          id: `${item.id}-upgrade-2`,
          title: `${hotelName} - Suite`,
          details: item.details.replace(/room|accommodation/i, 'suite') + ' Spacious suite with separate living area.',
          provider: location,
          price: Math.round(basePrice * 2),
          badge: 'Suite'
        },
        {
          id: `${item.id}-upgrade-3`,
          title: `${hotelName} - Sea View`,
          details: item.details + ' Beautiful sea/ocean view from your room.',
          provider: location,
          price: Math.round(basePrice * 1.4),
          badge: 'Sea View'
        },
        {
          id: `${item.id}-upgrade-4`,
          title: `${hotelName} - All Inclusive`,
          details: item.details + ' Includes breakfast, lunch, and dinner.',
          provider: location,
          price: Math.round(basePrice * 1.6),
          badge: 'All Inclusive'
        },
        {
          id: `${item.id}-upgrade-5`,
          title: `${hotelName} - Premium Hotel Nearby`,
          details: `Luxury 5-star hotel in ${location} with premium amenities and services.`,
          provider: location,
          price: Math.round(basePrice * 1.8),
          badge: '5 Star'
        }
      ];
    } else if (item.type === 'activity') {
      return [
        {
          id: `${item.id}-upgrade-1`,
          title: `${item.title} - VIP Experience`,
          details: item.details + ' Skip the lines with VIP access and priority booking.',
          provider: item.provider,
          price: Math.round(basePrice * 1.5),
          badge: 'VIP'
        },
        {
          id: `${item.id}-upgrade-2`,
          title: `${item.title} - Private Tour`,
          details: item.details.replace(/group|shared/i, 'private') + ' Enjoy a personalized private experience.',
          provider: item.provider,
          price: Math.round(basePrice * 2),
          badge: 'Private'
        },
        {
          id: `${item.id}-upgrade-3`,
          title: `${item.title} - Extended Duration`,
          details: item.details + ' Extended 3-4 hour experience with additional activities.',
          provider: item.provider,
          price: Math.round(basePrice * 1.6),
          badge: 'Extended'
        },
        {
          id: `${item.id}-upgrade-4`,
          title: `${item.title} - With Guide`,
          details: item.details + ' Includes expert guide for enhanced experience.',
          provider: item.provider,
          price: Math.round(basePrice * 1.4),
          badge: 'Guided'
        },
        {
          id: `${item.id}-upgrade-5`,
          title: `${item.title} - Premium Package`,
          details: item.details + ' Premium package with all add-ons, meals, and exclusive access.',
          provider: item.provider,
          price: Math.round(basePrice * 2.2),
          badge: 'Premium'
        }
      ];
    }
    
    return [];
  };

  // Handle upgrade selection
  const handleSelectUpgrade = (itemId: string, upgrade: UpgradeOption) => {
    const currentItem = cartItems.find(item => item.id === itemId);
    if (!currentItem) return;

    // Prevent upgrading an already upgraded item
    if (originalItems.has(itemId)) {
      console.log('Item is already upgraded, cannot upgrade again');
      return;
    }

    // Store original - use trip plan original if available, otherwise use current item
    const tripPlanOriginal = findOriginalItemFromTripPlan(currentItem);
    const originalToStore = tripPlanOriginal || { ...currentItem };
    
    if (!originalItems.has(itemId)) {
      setOriginalItems(prev => new Map(prev).set(itemId, originalToStore));
    }

    // Replace item with upgrade
    const upgradedItem: CartItem = {
      ...currentItem,
      title: upgrade.title,
      details: upgrade.details,
      provider: upgrade.provider || currentItem.provider,
      price: upgrade.price,
    };

    setCartItems(cartItems.map(item => 
      item.id === itemId ? upgradedItem : item
    ));

    // Update in backend
    updateCartItemMutation.mutate({
      id: itemId,
      updates: {
        title: upgrade.title,
        details: upgrade.details,
        provider: upgrade.provider || currentItem.provider,
        price: upgrade.price,
      }
    });

    // Close upgrade panel
    setOpenUpgradeItemId(null);
  };

  // Handle rollback to original
  const handleRollback = (itemId: string) => {
    const original = originalItems.get(itemId);
    if (!original) return;

    setCartItems(cartItems.map(item => 
      item.id === itemId ? original : item
    ));

    // Update in backend
    updateCartItemMutation.mutate({
      id: itemId,
      updates: {
        title: original.title,
        details: original.details,
        provider: original.provider,
        price: original.price,
      }
    });

    // Remove from originals map
    setOriginalItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });

    // Close upgrade panel
    setOpenUpgradeItemId(null);
  };

  // Check if item has been upgraded
  const isItemUpgraded = (itemId: string) => {
    return originalItems.has(itemId);
  };

  // Generate PDF function
  const handleGeneratePDF = async () => {
    if (!currentTrip || tripDays.length === 0) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    try {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Create a hidden container for rendering all days
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'fixed';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '800px';
      pdfContainer.style.backgroundColor = '#ffffff';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.fontFamily = 'Inter, sans-serif';
      document.body.appendChild(pdfContainer);

      try {
        // Render each day's content in the container
        for (let i = 0; i < tripDays.length; i++) {
          const day = tripDays[i];
          const dayCartItems = cartItems.filter(item => item.dayNumber === day.day_number);
          const dayDate = getDateForDay(day.day_number);
          
          const dayDiv = document.createElement('div');
          dayDiv.style.marginBottom = '40px';
          dayDiv.style.backgroundColor = '#ffffff';
          
          // Day header
          const header = document.createElement('div');
          header.style.marginBottom = '20px';
          header.innerHTML = `
            <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #1a1a1a;">
              Day ${day.day_number} - ${day.theme || 'Itinerary'}
            </h2>
            ${dayDate ? `<p style="font-size: 12px; color: #666; margin-bottom: 10px;">${getDayName(dayDate)}, ${formatDate(dayDate)}</p>` : ''}
            <p style="font-size: 14px; color: #444; line-height: 1.6;">${day.ai_summary || day.summary || ''}</p>
          `;
          dayDiv.appendChild(header);

          // Flights section
          const flightItems = dayCartItems.filter(item => item.type === 'flight');
          if (flightItems.length > 0) {
            const section = document.createElement('div');
            section.style.marginBottom = '20px';
            section.innerHTML = '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: #1a1a1a;">✈️ Flights & Transportation</h3>';
            
            flightItems.forEach(item => {
              const isUpgraded = isItemUpgraded(item.id);
              const itemDiv = document.createElement('div');
              itemDiv.style.backgroundColor = isUpgraded ? 'rgba(255, 237, 178, 0.9)' : '#f9fafb';
              itemDiv.style.border = `1px solid ${isUpgraded ? '#fbbf24' : '#e5e7eb'}`;
              itemDiv.style.borderRadius = '8px';
              itemDiv.style.padding = '15px';
              itemDiv.style.marginBottom = '10px';
              itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <h4 style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">${item.title}${isUpgraded ? ' <span style="background: #fbbf24; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Upgraded</span>' : ''}</h4>
                </div>
                <p style="font-size: 12px; color: #666; margin: 8px 0; line-height: 1.5;">${item.details}</p>
                ${item.provider ? `<p style="font-size: 11px; color: #888; margin: 4px 0;">📍 ${item.provider}</p>` : ''}
                <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-top: 8px;">₹${item.price.toLocaleString('en-IN')}</p>
              `;
              section.appendChild(itemDiv);
            });
            dayDiv.appendChild(section);
          }

          // Hotels section
          const hotelItems = dayCartItems.filter(item => item.type === 'hotel');
          if (hotelItems.length > 0) {
            const section = document.createElement('div');
            section.style.marginBottom = '20px';
            section.innerHTML = '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: #1a1a1a;">🏨 Accommodations</h3>';
            
            hotelItems.forEach(item => {
              const isUpgraded = isItemUpgraded(item.id);
              const itemDiv = document.createElement('div');
              itemDiv.style.backgroundColor = isUpgraded ? 'rgba(255, 237, 178, 0.9)' : '#f9fafb';
              itemDiv.style.border = `1px solid ${isUpgraded ? '#fbbf24' : '#e5e7eb'}`;
              itemDiv.style.borderRadius = '8px';
              itemDiv.style.padding = '15px';
              itemDiv.style.marginBottom = '10px';
              itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <h4 style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">${item.title}${isUpgraded ? ' <span style="background: #fbbf24; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Upgraded</span>' : ''}</h4>
                </div>
                <p style="font-size: 12px; color: #666; margin: 8px 0; line-height: 1.5;">${item.details}</p>
                ${item.provider ? `<p style="font-size: 11px; color: #888; margin: 4px 0;">📍 ${item.provider}</p>` : ''}
                <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-top: 8px;">₹${item.price.toLocaleString('en-IN')}</p>
              `;
              section.appendChild(itemDiv);
            });
            dayDiv.appendChild(section);
          }

          // Activities section
          const activityItems = dayCartItems.filter(item => item.type === 'activity');
          if (activityItems.length > 0) {
            const section = document.createElement('div');
            section.style.marginBottom = '20px';
            section.innerHTML = '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: #1a1a1a;">🎯 Activities & Experiences</h3>';
            
            activityItems.forEach(item => {
              const isUpgraded = isItemUpgraded(item.id);
              const itemDiv = document.createElement('div');
              itemDiv.style.backgroundColor = isUpgraded ? 'rgba(255, 237, 178, 0.9)' : '#f9fafb';
              itemDiv.style.border = `1px solid ${isUpgraded ? '#fbbf24' : '#e5e7eb'}`;
              itemDiv.style.borderRadius = '8px';
              itemDiv.style.padding = '15px';
              itemDiv.style.marginBottom = '10px';
              itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <h4 style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0;">${item.title}${isUpgraded ? ' <span style="background: #fbbf24; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">Upgraded</span>' : ''}</h4>
                </div>
                <p style="font-size: 12px; color: #666; margin: 8px 0; line-height: 1.5;">${item.details}</p>
                ${item.provider ? `<p style="font-size: 11px; color: #888; margin: 4px 0;">📍 ${item.provider}</p>` : ''}
                <div style="display: flex; gap: 15px; margin-top: 8px; align-items: center;">
                  <p style="font-size: 14px; font-weight: 600; color: #1a1a1a;">₹${item.price.toLocaleString('en-IN')}</p>
                  <span style="font-size: 11px; color: #888;">⭐ 4.5</span>
                </div>
              `;
              section.appendChild(itemDiv);
            });
            dayDiv.appendChild(section);
          }

          pdfContainer.appendChild(dayDiv);
        }

        await wait(500); // Wait for rendering

        // Capture all days
        const canvas = await html2canvas(pdfContainer, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Split into pages if needed
        let position = 0;
        let srcY = 0;
        let remainingHeight = imgHeight;
        let pageAdded = false;

        while (remainingHeight > 0) {
          const heightOnPage = Math.min(pageHeight - 20, remainingHeight);
          const srcHeight = (heightOnPage / imgHeight) * canvas.height;

          if (pageAdded) {
            pdf.addPage();
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = srcHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(canvas, 0, srcY, canvas.width, srcHeight, 0, 0, canvas.width, srcHeight);
            const tempImgData = tempCanvas.toDataURL('image/png');
            pdf.addImage(tempImgData, 'PNG', 10, 10, imgWidth - 20, heightOnPage);
          }

          remainingHeight -= heightOnPage;
          srcY += srcHeight;
          pageAdded = true;
        }
      } finally {
        document.body.removeChild(pdfContainer);
      }

      // Add summary page
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.text('Trip Summary', 10, 20);

      pdf.setFontSize(12);
      let yPos = 35;

      // Trip details
      pdf.setFontSize(14);
      pdf.text(`Trip: ${currentTrip.title}`, 10, yPos);
      yPos += 10;

      pdf.setFontSize(11);
      pdf.text(`From: ${currentTrip.from}`, 10, yPos);
      yPos += 7;
      pdf.text(`To: ${currentTrip.to}`, 10, yPos);
      yPos += 7;
      
      if (currentTrip.startDate && currentTrip.endDate) {
        const startDate = new Date(currentTrip.startDate);
        const endDate = new Date(currentTrip.endDate);
        pdf.text(`Dates: ${formatDate(startDate)} - ${formatDate(endDate)}`, 10, yPos);
        yPos += 7;
      }

      yPos += 5;

      // Calculate totals
      const totalCost = cartItems
        .filter(item => item.included)
        .reduce((sum, item) => sum + item.price, 0);
      
      const flightCost = cartItems
        .filter(item => item.included && item.type === 'flight')
        .reduce((sum, item) => sum + item.price, 0);
      
      const hotelCost = cartItems
        .filter(item => item.included && item.type === 'hotel')
        .reduce((sum, item) => sum + item.price, 0);
      
      const activityCost = cartItems
        .filter(item => item.included && item.type === 'activity')
        .reduce((sum, item) => sum + item.price, 0);

      // Cost breakdown
      pdf.setFontSize(14);
      pdf.text('Cost Breakdown', 10, yPos);
      yPos += 10;

      pdf.setFontSize(11);
      pdf.text(`Flights & Transportation: ₹${flightCost.toLocaleString('en-IN')}`, 10, yPos);
      yPos += 7;
      pdf.text(`Accommodations: ₹${hotelCost.toLocaleString('en-IN')}`, 10, yPos);
      yPos += 7;
      pdf.text(`Activities & Experiences: ₹${activityCost.toLocaleString('en-IN')}`, 10, yPos);
      yPos += 10;

      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Total Cost: ₹${totalCost.toLocaleString('en-IN')}`, 10, yPos);

      // Save the PDF
      pdf.save(`${currentTrip.title.replace(/\s+/g, '_')}_Itinerary.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Source label for "API vs Gemini" — each recommendation has source: gemini | amadeus | liteapi | opentripmap
  const getSourceLabel = (source: string | undefined) => {
    if (!source) return null;
    const labels: Record<string, string> = {
      gemini: "From Gemini (AI)",
      amadeus: "From Amadeus API",
      liteapi: "From LiteAPI",
      opentripmap: "From OpenTripMap",
    };
    return labels[source] ?? `From ${source}`;
  };

  // Activity Card Component with Upgrade Functionality
  const ActivityCard = ({ item, onToggle, source }: { item: any; onToggle: (id: string, included: boolean) => void; source?: string }) => {
    const upgradeOptions = generateUpgradeOptions(item);
    const isUpgradeOpen = openUpgradeItemId === item.id;
    const isUpgraded = isItemUpgraded(item.id);
    const sourceLabel = getSourceLabel(source);
    
    return (
      <div className="space-y-3">
        <div
          className={cn(
            "border rounded-lg p-4 transition-all hover:border-primary/30 relative",
            !item.included && "opacity-50",
            isUpgraded 
              ? "border-amber-400/70 shadow-lg" 
              : "bg-card"
          )}
          style={isUpgraded ? {
            background: 'linear-gradient(135deg, rgba(255, 237, 178, 0.92) 0%, rgba(255, 224, 130, 0.90) 50%, rgba(255, 248, 220, 0.92) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          } : undefined}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-muted">
              {getIconForType(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">
                      {item.title}
                    </h3>
                    {isUpgraded && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-full">
                        Upgraded
                      </span>
                    )}
                    {sourceLabel && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-full" title="Where this result was fetched from">
                        {sourceLabel}
                      </span>
                    )}
                  </div>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.included ?? true}
                    onChange={(e) => onToggle(item.id, e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-primary/30 text-primary focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    data-testid={`item-checkbox-${item.id}`}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                {item.details}
              </p>
              {item.provider && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.provider}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  {item.type === 'activity' && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      1-2 hours
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                    ₹{item.price.toLocaleString('en-IN')}
                  </span>
                  {item.type !== 'flight' && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      4.5
                    </span>
                  )}
                </div>
                
                {/* Upgrade Button - Bottom Right - Only show if not already upgraded */}
                {!isUpgraded && (
                  <button
                    onClick={() => setOpenUpgradeItemId(isUpgradeOpen ? null : item.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all",
                      "bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10",
                      "border border-primary/20 hover:border-primary/30",
                      "text-primary hover:text-primary/90",
                      isUpgradeOpen && "bg-primary/20 border-primary/40"
                    )}
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Upgrade</span>
                  </button>
                )}
              </div>
              
              {/* Rollback Button - Show if upgraded */}
              {isUpgraded && (
                <button
                  onClick={() => handleRollback(item.id)}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Restore original option
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade Options Panel - Horizontal Scrollable */}
        {isUpgradeOpen && upgradeOptions.length > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                24x7 Support & Personal Travel Advisor
              </h4>
              <button
                onClick={() => setOpenUpgradeItemId(null)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {upgradeOptions.map((upgrade) => (
                <button
                  key={upgrade.id}
                  onClick={() => handleSelectUpgrade(item.id, upgrade)}
                  className={cn(
                    "flex-shrink-0 w-64 bg-card border rounded-lg p-4 text-left",
                    "hover:border-primary/50 hover:shadow-md transition-all",
                    "flex flex-col gap-2"
                  )}
                >
                  {upgrade.badge && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-full w-fit">
                      {upgrade.badge}
                    </span>
                  )}
                  <h5 className="font-semibold text-sm text-foreground line-clamp-1">
                    {upgrade.title}
                  </h5>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {upgrade.details}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    {upgrade.provider && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {upgrade.provider}
                      </span>
                    )}
                    <span className="text-sm font-bold text-foreground ml-auto">
                      ₹{upgrade.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main ref={mainRef} className={cn(
      "flex-grow overflow-y-auto custom-scrollbar relative",
      variant === 'desktop' && "p-6"
    )}>
      {/* Header - Glass Morphism with Rounded Edges - Fixed at top */}
      <header className={cn(
        "sticky top-0 z-30 mb-4",
        variant === 'desktop' ? "mx-0 mt-0" : "mx-4 sm:mx-6 mt-4 sm:mt-6"
      )}>
        <div className="rounded-2xl bg-background/95 backdrop-blur-xl border border-border/50 shadow-lg overflow-hidden">
          {/* Trip Title Section */}
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="p-2 hover:bg-muted/50 rounded-full transition-all"
              data-testid="back-button"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center flex-1 px-4" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em' }}>
              {currentTrip.title}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGeneratePDF}
              className="p-2 hover:bg-muted/50 rounded-full transition-all"
              data-testid="share-button"
            >
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
      </header>
      
      {/* Day Tabs Navigation - Below title, fixed while scrolling */}
      <nav className="sticky top-[72px] z-20 mx-4 sm:mx-6 mb-4">
        <div className="rounded-xl bg-background/95 backdrop-blur-xl border border-border/50 shadow-md overflow-hidden">
          <div className="flex overflow-x-auto custom-scrollbar px-4 py-3 space-x-2">
            {tripDays.map((day) => {
              const dayDate = getDateForDay(day.day_number);
              const dateStr = dayDate ? formatDate(dayDate) : '';
              const dayName = dayDate ? getDayName(dayDate) : '';
              
              return (
                <Button
                  key={day.day_number}
                  variant="ghost"
                  onClick={() => setSelectedDay(day.day_number)}
                  className={cn(
                    "day-tab px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all rounded-lg flex flex-col items-center gap-0.5",
                    selectedDay === day.day_number
                      ? "text-primary bg-primary/20 border border-primary/30 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  data-testid={`day-tab-${day.day_number}`}
                >
                  <span className="font-semibold" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, letterSpacing: '-0.01em' }}>Day {day.day_number}</span>
                  {dayDate && (
                    <span className="text-[10px] sm:text-xs opacity-75">
                      {dayName}, {dateStr}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </nav>
      
      {/* Content Area with padding - Show only selected day */}
      <div className="px-4 sm:px-6 pb-8">
        {/* Single Day Content - Show only the selected day */}
        {tripDays.filter((day) => selectedDay === day.day_number).length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Please select a day from the tabs above</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {tripDays
              .filter((day) => selectedDay === day.day_number) // Only show selected day
              .map((day) => {
            // Match cart items by day_number (simple matching like working version)
            const dayCartItems = cartItems.filter(item => item.dayNumber === day.day_number);
            const dayStats = getDayStats(day.day_number);
            const isActive = selectedDay === day.day_number;
            const dayDate = getDateForDay(day.day_number);
            
            return (
              <div
                key={day.day_number}
                ref={(el) => (dayRefs.current[day.day_number] = el)}
                className={cn(
                  "space-y-4 scroll-mt-[180px]",
                  isActive && "ring-1 ring-primary/30 rounded-xl -m-1 p-1"
                )}
                data-day={day.day_number}
                id={`day-${day.day_number}`}
                style={{ scrollMarginTop: '180px' }}
              >
                {/* Day Theme Header - Minimal */}
                <div className={cn(
                  "rounded-xl p-5 border transition-all",
                  isActive 
                    ? "bg-card border-primary/40 shadow-sm"
                    : "bg-card border-border hover:border-primary/20"
                )}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm",
                        isActive 
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}>
                        {day.day_number}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
                          Day {day.day_number}
                        </span>
                        {dayDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {getDayName(dayDate)}, {formatDate(dayDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
                      <span className="font-medium">{dayStats.activities} activities</span>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em' }}>
                    {day.theme || day.summary || `Day ${day.day_number} Overview`}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {day.ai_summary || day.summary || `Enjoy your ${day.day_number === 1 ? 'first' : day.day_number === tripDays.length ? 'final' : ''} day in ${currentTrip.to}`}
                  </p>
                  {/* Show custom request badge if present in trip */}
                  {(currentTrip as any).customRequest && day.day_number === 1 && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
                      <span className="text-xs font-medium text-primary">✨ Custom Request</span>
                      <span className="text-xs text-muted-foreground">{((currentTrip as any).customRequest as string).substring(0, 60)}{((currentTrip as any).customRequest as string).length > 60 ? '...' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Activities organized by type - Flights, Hotels, Activities */}
                <div className="space-y-6">
                  {/* Flights Section */}
                  {dayCartItems.filter(item => item.type === 'flight').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="text-lg">✈️</span>
                        Flights & Transportation
                      </h3>
                      {dayCartItems.filter(item => item.type === 'flight').map((item) => (
                        <ActivityCard key={item.id} item={item} onToggle={handleToggleItem} source={findOriginalItemFromTripPlan(item)?.source} />
                      ))}
                    </div>
                  )}

                  {/* Hotels Section */}
                  {dayCartItems.filter(item => item.type === 'hotel').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="text-lg">🏨</span>
                        Accommodations
                      </h3>
                      {dayCartItems.filter(item => item.type === 'hotel').map((item) => (
                        <ActivityCard key={item.id} item={item} onToggle={handleToggleItem} source={findOriginalItemFromTripPlan(item)?.source} />
                      ))}
                    </div>
                  )}

                  {/* Activities Section */}
                  {dayCartItems.filter(item => item.type === 'activity').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        Activities & Experiences
                      </h3>
                      {dayCartItems.filter(item => item.type === 'activity').map((item) => (
                        <ActivityCard key={item.id} item={item} onToggle={handleToggleItem} source={findOriginalItemFromTripPlan(item)?.source} />
                      ))}
                    </div>
                  )}

                  {/* Empty State */}
                  {dayCartItems.length === 0 && (
                    <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">No activities planned for this day</p>
                    </div>
                  )}
                </div>

                {/* Day Summary - Minimal */}
                <div className="bg-muted/30 border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span>Day {day.day_number} Summary</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">{dayStats.activities}</div>
                      <div className="text-xs text-muted-foreground">Activities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">₹{dayStats.cost}</div>
                      <div className="text-xs text-muted-foreground">Cost</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-foreground">{dayStats.duration}</div>
                      <div className="text-xs text-muted-foreground">Duration</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </main>
  );
}
