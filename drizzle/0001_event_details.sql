-- Evolución del esquema: permite registrar metadatos opcionales del evento.
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS player_name VARCHAR(100);
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS match_events_created_at_idx ON match_events(created_at);
