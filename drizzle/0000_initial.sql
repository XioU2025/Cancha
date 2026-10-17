CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished');
CREATE TYPE event_type AS ENUM ('goal', 'foul', 'substitution', 'yellow_card', 'red_card', 'start', 'half_time', 'full_time');
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  status match_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE match_events (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type event_type NOT NULL,
  minute INTEGER NOT NULL,
  team VARCHAR(100),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX match_events_match_minute_idx ON match_events(match_id, minute, created_at);
