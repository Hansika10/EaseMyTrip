# Environment Variables Configuration

## Required Environment Variables

### Backend (Render)
```
NODE_ENV=production
PORT=10000
DATABASE_URL=your_neon_database_connection_string
SESSION_SECRET=your_random_session_secret_key
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### Frontend (Netlify)
```
VITE_API_URL=https://your-render-backend-url.onrender.com
```

## How to Get These Values

### DATABASE_URL
1. Go to [Neon Console](https://console.neon.tech/)
2. Select your project
3. Copy the connection string from the dashboard
4. Format: `postgresql://username:password@host/database?sslmode=require`

### SESSION_SECRET
- Generate a random string (at least 32 characters)
- You can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### GEMINI_API_KEY
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the generated key

### ELEVENLABS_API_KEY
1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Sign up or log in
3. Go to your profile settings
4. Copy your API key from the API section

### VITE_API_URL
- This will be your Render backend URL
- Format: `https://your-app-name.onrender.com`
- Replace `your-app-name` with your actual Render service name

## Optional: Trip Enrichment (Flights, Hotels, Activities)

When generating a trip plan, the app can enrich the itinerary with real data from external APIs. If these variables are **not set**, the app still works: Gemini placeholders are used for flights, hotels, and activities.

### AMADEUS_API_KEY and AMADEUS_API_SECRET
- Used for **flight** search (Amadeus test environment).
- Get them at [Amadeus for Developers](https://developers.amadeus.com/) (create an app, use test credentials).
- If both are missing, flight recommendations remain AI-generated placeholders.

### LITEAPI_KEY
- Used for **hotel** search (LiteAPI).
- Get a key at [LiteAPI Travel](https://www.liteapi.travel/) (free trial available).
- If missing, hotel recommendations remain AI-generated placeholders.

### OPENTRIPMAP_API_KEY
- Used for **activities / points of interest** (OpenTripMap).
- Get a free API key at [OpenTripMap](https://dev.opentripmap.org/).
- If missing, activity recommendations remain AI-generated placeholders.

### Summary
| Variable | Purpose | Enrichment skipped when missing |
|----------|---------|---------------------------------|
| `AMADEUS_API_KEY` | Flights (Amadeus test) | Yes |
| `AMADEUS_API_SECRET` | Flights (Amadeus test) | Yes |
| `LITEAPI_KEY` | Hotels (LiteAPI) | Yes |
| `OPENTRIPMAP_API_KEY` | Activities (OpenTripMap) | Yes |

## Where each result is fetched from (API vs Gemini)

You can tell exactly where each recommendation came from by the **`source`** field on each item (and the "Source" badge in the itinerary UI).

| Source value   | Meaning |
|----------------|--------|
| **gemini**     | AI-generated placeholder. No external API; from `generateTripPlan()` in `server/services/gemini.ts`. |
| **amadeus**    | Real flight data from **Amadeus Flight Offers Search API** (`server/services/amadeus.ts`). Used when `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` are set. |
| **liteapi**    | Real hotel data from **LiteAPI** (`server/services/hotels.ts`). Used when `LITEAPI_KEY` is set. |
| **opentripmap**| Real activities/POI from **OpenTripMap** (`server/services/activities.ts`). Used when `OPENTRIPMAP_API_KEY` is set. |

**Flow:**  
1. Plan structure and placeholders come from **Gemini** (`/api/generate-trip` → `generateTripPlan`).  
2. Optional enrichment runs in **enrich-trip.ts**: it calls Amadeus, LiteAPI, and OpenTripMap (when keys exist) and replaces matching slots in the plan.  
3. Replaced items get `source: "amadeus" | "liteapi" | "opentripmap"`; anything left from the AI plan keeps `source: "gemini"`.