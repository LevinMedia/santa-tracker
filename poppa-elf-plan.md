# Poppa Elf AI Agent Architecture

## Overview

Create an AI agent called "Poppa Elf" that answers questions about Santa's 2024 flight using OpenAI Agents SDK. Poppa Elf is the oldest, wisest elf with a playful personality. Messages stored in browser sessionStorage (cleared when tab closes). Agent must handle sensitive topics (religion, politics) gracefully via system prompt.

## Architecture Components

### 1. Data Access Layer

- **CSV Parser Utility** (`src/lib/flight-data.ts`)
  - Parse `2024_santa_tracker.csv` into structured data
  - Provide query functions for filtering/searching stops
  - Cache parsed data in memory for performance

### 2. Agent Tools (OpenAI Functions)

Create tools that the agent can call to answer questions:

- **`get_stop_by_number`**: Get specific stop details by stop number
- **`search_stops_by_location`**: Find stops by city, country, or state/province (exact matches)
- **`geocode_location_candidates`**: Geocode a location name (using OpenStreetMap Nominatim API) and return multiple candidate matches if ambiguous (e.g., "Springfield" returns Springfield, IL; Springfield, MA; etc.). Agent uses this to ask clarifying questions before proceeding.
- **`find_nearest_stop_to_location`**: Takes confirmed lat/lng coordinates, finds nearest stop using haversine distance, returns stop details, time, and distance. Used after location is confirmed via geocode_location_candidates.
- **`search_stops_by_region`**: Find stops by geographic region (e.g., "west coast of US", "east coast", "midwest", "Pacific Northwest", "New England", etc.) - uses lat/lng bounds
- **`get_stops_by_time`**: Find stops within a time range (UTC or local)
- **`get_stops_by_timezone`**: Get all stops in a specific timezone
- **`get_stops_by_region_and_time`**: Combined query for region + time range (e.g., "west coast between 8pm-10pm")
- **`calculate_statistics`**: Compute stats (total stops, distance, average speed, etc.) - can filter by region/time
- **`get_weather_at_stop`**: Get weather data for a specific stop
- **`get_route_segment`**: Get stops between two points or time ranges
- **`get_top_locations`**: Get most visited countries/cities by stop count

### 3. API Route

- **`src/app/api/poppa-elf/chat/route.ts`**
  - Next.js API route using OpenAI Agents SDK
  - Accepts user messages
  - Calls agent with tools
  - Returns agent responses
  - No server-side message storage (privacy-first)

### 4. Client-Side Components

- **`src/components/PoppaElfChat.tsx`**
  - Chat UI component
  - Manages message state in React (in-memory)
  - Uses `sessionStorage` for persistence during session
  - Clears messages on component unmount or explicit "clear chat" action
  - Sends messages to API route
  - Displays agent responses with streaming support

### 5. Agent Configuration

- **`src/lib/poppa-elf-agent.ts`**
  - Agent initialization with OpenAI
  - Main system prompt for Poppa Elf personality (oldest, wisest elf, playful tone, handles sensitive topics)
  - Tool definitions with individual descriptions (each tool has instructions on when/how to use it)
  - Tool function implementations
  - Error handling

### 6. Dependencies to Add

- `@ai-sdk/openai` - OpenAI SDK for agents
- `ai` - Vercel AI SDK core
- CSV parsing already available via `csv-parse`

## Data Flow

1. User asks question in chat UI
2. Message stored in component state + sessionStorage
3. Message sent to `/api/poppa-elf/chat`
4. Agent receives message, determines which tools to use
5. Tools query CSV data (parsed in memory)
6. Agent formulates response using tool results
7. Response streamed back to client
8. Response added to message history (local only)
9. On page close/refresh, sessionStorage cleared

## Privacy Considerations

- No messages stored on server
- No database persistence
- Messages only in browser sessionStorage
- CSV data loaded server-side but not logged
- Agent responses not stored server-side

## File Structure

```
src/
  app/
    api/
      poppa-elf/
        chat/
          route.ts          # API endpoint for agent
  components/
    PoppaElfChat.tsx        # Chat UI component
  lib/
    flight-data.ts          # CSV parsing and query utilities
    poppa-elf-agent.ts      # Agent configuration and tools
```

## Phased Implementation Approach

### Phase 1: Basic Chat (No Tools)
- Install OpenAI SDK dependencies (`@ai-sdk/openai`, `ai`)
- Create basic API route (`src/app/api/poppa-elf/chat/route.ts`) with agent (no tools, just conversation)
- Create minimal chat UI component (`src/components/PoppaElfChat.tsx`) with sessionStorage
- Basic system prompt for Poppa Elf personality (oldest, wisest elf, playful tone, handles sensitive topics)
- Test basic conversation flow

### Phase 2: Add First Tool - Basic Lookup
- Create CSV parser utility (`src/lib/flight-data.ts`)
- Add `get_stop_by_number` tool
- Test: "What was stop number 1000?"

### Phase 3: Add Location Search
- Add `search_stops_by_location` tool (exact match by city/country/state)
- Test: "When was Santa in New York?"

### Phase 4: Add Time Queries
- Add `get_stops_by_time` tool
- Test: "Where was Santa at 10pm EST?"

### Phase 5: Add Statistics
- Add `calculate_basic_stats` tool
- Test: "How many stops did Santa make?"

### Phase 6+: Additional Tools (One at a time)
- Geographic regions (`search_stops_by_region`)
- Nearest stop lookup with geocoding (`geocode_location_candidates`, `find_nearest_stop_to_location`)
- Weather queries (`get_weather_at_stop`)
- Advanced statistics
- Timezone queries
- Route segments
- Top locations
- etc.

## Implementation Notes

- Each tool gets its own description that acts as instructions for the agent
- Tools are added incrementally, one at a time, with testing after each addition
- System prompt handles Poppa Elf's personality and sensitive topic deflection
- All message storage is client-side only (sessionStorage)
- CSV data is parsed server-side and cached in memory for tool queries

