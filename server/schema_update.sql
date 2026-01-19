-- Add last_refreshed column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_refreshed TIMESTAMPTZ;
