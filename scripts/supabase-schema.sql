-- Live Weather Table for 2025 Santa Tracker
-- Run this in your Supabase SQL editor to create the table

-- Drop existing table if needed (careful in production!)
-- DROP TABLE IF EXISTS live_weather;

CREATE TABLE live_weather (
  stop_number INT PRIMARY KEY,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  lat DECIMAL(10, 6) NOT NULL,
  lng DECIMAL(10, 6) NOT NULL,
  timezone TEXT,
  utc_offset_rounded INT,
  utc_time TIMESTAMP WITH TIME ZONE,
  local_time TIMESTAMP WITH TIME ZONE,
  -- Weather data (null until fetched)
  temperature_c DECIMAL(5, 2),
  weather_condition TEXT,
  wind_speed_mps DECIMAL(6, 2),
  wind_direction_deg DECIMAL(5, 1),
  wind_gust_mps DECIMAL(6, 2),
  weather_fetched_at TIMESTAMP WITH TIME ZONE,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for timezone-based queries (fetch all stops in a timezone)
CREATE INDEX idx_live_weather_timezone ON live_weather(utc_offset_rounded);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on row changes
CREATE TRIGGER update_live_weather_updated_at
    BEFORE UPDATE ON live_weather
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE live_weather ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the frontend)
CREATE POLICY "Allow public read access" ON live_weather
    FOR SELECT USING (true);

-- Allow service role full access (for the API to write weather)
CREATE POLICY "Allow service role full access" ON live_weather
    FOR ALL USING (true);

