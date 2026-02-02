import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { tripRequestSchema, vibesRequestSchema, chatMessageSchema } from "@shared/schema";
import { generateVibes, generateTripPlan, chatWithAI, detectTripAction, detectItineraryPlanningIntent, extractTripDetailsFromMessage, executeModification, analyzeBudgetOptimization, generateSmartRecommendations, generateUserInsights } from "./services/gemini";
import { enrichTripPlan } from "./services/enrich-trip";
import { textToSpeech } from "./services/elevenlabs";
import { textToSpeechIndian } from "./services/sonic";

// Simple in-memory cache for vibes (cache duration: 1 hour)
const vibesCache = new Map<string, { vibes: string[]; timestamp: number }>();
const VIBES_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Cache for trip plans (cache duration: 30 minutes)
const tripPlanCache = new Map<string, { plan: any; timestamp: number }>();
const TRIP_PLAN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Generate vibes for destination
  app.post("/api/vibes", async (req, res) => {
    try {
      const { destination } = vibesRequestSchema.parse(req.body);
      const destinationKey = destination.toLowerCase().trim();
      
      // Check cache first
      const cached = vibesCache.get(destinationKey);
      if (cached && Date.now() - cached.timestamp < VIBES_CACHE_DURATION) {
        console.log(`Returning cached vibes for ${destination}`);
        return res.json({ vibes: cached.vibes });
      }
      
      console.log("Backend received destination for vibes:", destination);
      
      // generateVibes always returns an array, even on error (has fallback)
      const vibes = await generateVibes(destination);
      console.log("Backend generated vibes:", vibes);
      
      // Cache the result
      if (Array.isArray(vibes) && vibes.length > 0) {
        vibesCache.set(destinationKey, { vibes, timestamp: Date.now() });
        res.json({ vibes });
      } else {
        // Ultimate fallback if somehow vibes is invalid
        console.warn("Invalid vibes returned, using ultimate fallback");
        const fallbackVibes = ['Adventure', 'Relaxation', 'Culture', 'Food & Dining', 'Nature', 'Photography'];
        vibesCache.set(destinationKey, { vibes: fallbackVibes, timestamp: Date.now() });
        res.json({ vibes: fallbackVibes });
      }
    } catch (error) {
      console.error("Error generating vibes:", error);
      // Always return vibes even on error - use generic fallback
      const fallbackVibes = ['Adventure', 'Relaxation', 'Culture', 'Food & Dining', 'Nature', 'Photography'];
      try {
        const destinationKey = req.body?.destination?.toLowerCase().trim() || 'unknown';
        vibesCache.set(destinationKey, { vibes: fallbackVibes, timestamp: Date.now() });
      } catch (cacheError) {
        // Ignore cache errors in error handler
      }
      res.json({ 
        vibes: fallbackVibes
      });
    }
  });

  // Generate trip plan
  app.post("/api/generate-trip", async (req, res) => {
    try {
      const tripRequest = tripRequestSchema.parse(req.body);
      
      // Create cache key from trip parameters
      const cacheKey = JSON.stringify({
        from: tripRequest.from,
        to: tripRequest.to,
        startDate: tripRequest.startDate,
        endDate: tripRequest.endDate,
        theme: tripRequest.theme,
        budget: tripRequest.budget,
        customRequest: tripRequest.customRequest || '',
        advancedOptions: tripRequest.advancedOptions || {}
      });
      
      // Check cache first
      const cached = tripPlanCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < TRIP_PLAN_CACHE_DURATION) {
        console.log('Using cached trip plan for:', tripRequest.to);
        
        // Still need to create the trip and cart items in database
        const userId = "default-user";
        const trip = await storage.createTrip({
          ...tripRequest,
          userId,
          title: cached.plan.title,
          days: cached.plan.days,
        });
        
        if (tripRequest.customRequest) {
          (trip as any).customRequest = tripRequest.customRequest;
        }
        if (tripRequest.advancedOptions) {
          (trip as any).advancedOptions = tripRequest.advancedOptions;
        }

        // Create cart items from cached plan
        if (cached.plan.days) {
          const allCartItems: any[] = [];
          
          for (const day of cached.plan.days) {
            const recs = day.recommendations || day.items || [];
            if (Array.isArray(recs) && recs.length > 0) {
              for (const rec of recs) {
                allCartItems.push({
                  tripId: trip.id,
                  type: rec.type || 'activity',
                  title: rec.title || rec.name || 'Untitled',
                  details: rec.details || rec.description || '',
                  provider: rec.provider || null,
                  price: typeof rec.price === 'number' ? rec.price : (parseInt(String(rec.price || '0')) || 0),
                  included: true,
                  dayNumber: day.day_number || day.dayNumber || 1,
                });
              }
            }
          }
          
          if (allCartItems.length > 0) {
            await storage.createCartItemsBatch(allCartItems);
          }
        }

        return res.json({ trip, plan: cached.plan });
      }
      
      console.log('Received trip generation request:');
      console.log('- Custom Request:', tripRequest.customRequest || 'None');
      console.log('- Advanced Options:', tripRequest.advancedOptions);
      console.log('- GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
      
      // --- WHERE THE RESULT COMES FROM ---
      // Step 1: Plan structure and placeholder recommendations come from GEMINI (AI).
      const generatedPlan = await generateTripPlan(
        tripRequest.from,
        tripRequest.to,
        tripRequest.startDate,
        tripRequest.endDate,
        tripRequest.theme,
        tripRequest.budget,
        tripRequest.customRequest,
        tripRequest.advancedOptions,
        tripRequest.travelers
      );

      // Step 2: Optional enrichment from EXTERNAL APIs (when keys are set):
      // - Flights: Amadeus (AMADEUS_API_KEY + AMADEUS_API_SECRET)
      // - Hotels: LiteAPI (LITEAPI_KEY)
      // - Activities: OpenTripMap (OPENTRIPMAP_API_KEY)
      // Each recommendation has a "source" field: "gemini" | "amadeus" | "liteapi" | "opentripmap".
      let enrichedPlan = generatedPlan;
      try {
        enrichedPlan = await enrichTripPlan(tripRequest, generatedPlan);
      } catch (enrichError) {
        console.warn("Enrichment failed, using Gemini plan only:", enrichError);
      }

      // Store the trip (for now, using a dummy user ID)
      const userId = "default-user";
      const trip = await storage.createTrip({
        ...tripRequest,
        userId,
        title: enrichedPlan.title,
        days: enrichedPlan.days,
      });
      
      // Store customRequest and advancedOptions as metadata (for display purposes)
      if (tripRequest.customRequest) {
        (trip as any).customRequest = tripRequest.customRequest;
      }
      if (tripRequest.advancedOptions) {
        (trip as any).advancedOptions = tripRequest.advancedOptions;
      }

      // Create cart items from recommendations (optimized with batch creation)
      if (enrichedPlan.days) {
        const allCartItems: any[] = [];
        
        for (const day of enrichedPlan.days) {
          // Handle both 'recommendations' and 'items' (for compatibility)
          const recs = day.recommendations || day.items || [];
          if (Array.isArray(recs) && recs.length > 0) {
            for (const rec of recs) {
              allCartItems.push({
                tripId: trip.id,
                type: rec.type || 'activity',
                title: rec.title || rec.name || 'Untitled',
                details: rec.details || rec.description || '',
                provider: rec.provider || null,
                price: typeof rec.price === 'number' ? rec.price : (parseInt(String(rec.price || '0')) || 0),
                included: true,
                dayNumber: day.day_number || day.dayNumber || 1,
              });
            }
          }
        }
        
        // Batch create all cart items at once
        if (allCartItems.length > 0) {
          await storage.createCartItemsBatch(allCartItems);
        }
      }

      // Cache the generated plan (enriched)
      tripPlanCache.set(cacheKey, { plan: enrichedPlan, timestamp: Date.now() });
      console.log('Cached trip plan for future requests');

      res.json({ trip, plan: enrichedPlan });
    } catch (error) {
      const err = error as Error;
      console.error("Error generating trip:", err?.message ?? error);
      if (err?.stack) console.error(err.stack);
      res.status(500).json({ error: "Failed to generate trip plan" });
    }
  });

  // Get trip by ID
  app.get("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  // Get cart items for trip
  app.get("/api/trips/:id/cart", async (req, res) => {
    try {
      const cartItems = await storage.getCartItems(req.params.id);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cart items" });
    }
  });

  // Update cart item
  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const updatedItem = await storage.updateCartItem(req.params.id, req.body);
      if (!updatedItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cart item" });
    }
  });

  // Delete cart item
  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCartItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cart item" });
    }
  });

  // Chat with AI
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, tripId } = chatMessageSchema.parse(req.body);
      
      let tripContext = null;
      if (tripId) {
        tripContext = await storage.getTrip(tripId);
      }
      
      const response = await chatWithAI(message, tripContext);
      res.json({ response });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // Detect itinerary planning intent
  app.post("/api/detect-itinerary-planning", async (req, res) => {
    try {
      const { message, conversationHistory } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const result = await detectItineraryPlanningIntent(message, conversationHistory);
      res.json(result);
    } catch (error) {
      console.error("Error detecting itinerary planning intent:", error);
      res.status(500).json({ error: "Failed to detect planning intent" });
    }
  });

  // Extract trip details from message
  app.post("/api/extract-trip-details", async (req, res) => {
    try {
      const { message, existingDetails, destination } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get available vibes for the destination if provided
      let availableVibes: string[] | undefined = undefined;
      if (destination) {
        availableVibes = await generateVibes(destination);
      }
      
      const result = await extractTripDetailsFromMessage(message, existingDetails, availableVibes);
      res.json(result);
    } catch (error) {
      console.error("Error extracting trip details:", error);
      res.status(500).json({ error: "Failed to extract trip details" });
    }
  });

  // Generate speech from text using ElevenLabs (American) or Sonic (Indian)
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text, voiceId, voiceType = "american" } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }

      // Limit text length to prevent abuse (max 5000 characters)
      const textToConvert = text.trim().substring(0, 5000);
      
      let audioBuffer: ArrayBuffer;
      let contentType: string;

      if (voiceType === "indian") {
        // Use Sonic API for Indian voice
        audioBuffer = await textToSpeechIndian(textToConvert);
        contentType = "audio/wav"; // Sonic returns WAV format
      } else {
        // Use ElevenLabs for American voice (default)
        audioBuffer = await textToSpeech(textToConvert, voiceId);
        contentType = "audio/mpeg"; // ElevenLabs returns MPEG format
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error generating speech:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Detect action from message
  app.post("/api/detect-action", async (req, res) => {
    try {
      const { message, tripId } = req.body;
      
      let tripContext = null;
      if (tripId) {
        tripContext = await storage.getTrip(tripId);
      }
      
      const action = await detectTripAction(message, tripContext);
      res.json(action);
    } catch (error) {
      console.error("Error detecting action:", error);
      res.status(500).json({ error: "Failed to detect action" });
    }
  });

  // Execute trip modification
  app.post("/api/trips/:id/modify", async (req, res) => {
    try {
      const { action, params } = req.body;
      const tripId = req.params.id;
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const result = await executeModification(action, params, trip);
      
      // Update the trip in storage
      const updatedTrip = await storage.updateTrip(tripId, result.modifiedTrip);
      
      res.json({ 
        trip: updatedTrip, 
        changes: result.changes,
        suggestion: result.suggestion 
      });
    } catch (error) {
      console.error("Error modifying trip:", error);
      res.status(500).json({ error: "Failed to modify trip" });
    }
  });

  // Budget optimization
  app.post("/api/trips/:id/optimize-budget", async (req, res) => {
    try {
      const tripId = req.params.id;
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const optimization = await analyzeBudgetOptimization(trip);
      res.json(optimization);
    } catch (error) {
      console.error("Error optimizing budget:", error);
      res.status(500).json({ error: "Failed to optimize budget" });
    }
  });

  // Smart recommendations
  app.post("/api/trips/:id/recommendations", async (req, res) => {
    try {
      const tripId = req.params.id;
      const { dayNumber } = req.body;
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const recommendations = await generateSmartRecommendations(tripId, dayNumber, trip);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // User insights
  app.post("/api/user/insights", async (req, res) => {
    try {
      const { userId } = req.body;
      
      // Get user's trip history
      const trips = await storage.getTripsByUser(userId || "default-user");
      
      const userProfile = {
        trips: trips.length,
        tripHistory: trips.slice(0, 5), // Last 5 trips
        preferences: {
          // Mock data for demo
          favoriteThemes: ["Beach & Chill", "Adventure Sports"],
          averageBudget: 8000,
          destinations: trips.map(t => t.to)
        }
      };
      
      const insights = await generateUserInsights(userProfile);
      res.json(insights);
    } catch (error) {
      console.error("Error generating user insights:", error);
      res.status(500).json({ error: "Failed to generate user insights" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
