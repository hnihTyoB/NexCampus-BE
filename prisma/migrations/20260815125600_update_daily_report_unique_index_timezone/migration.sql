-- Create an immutable helper function to get Vietnam date from timestamp
CREATE OR REPLACE FUNCTION get_vietnam_date(t TIMESTAMP)
RETURNS DATE AS $$
BEGIN
    RETURN (t + INTERVAL '7 hours')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the old unique index on UTC date
DROP INDEX IF EXISTS idx_daily_reports_intern_date;

-- Create the new unique index on Vietnam local date using the immutable helper
CREATE UNIQUE INDEX idx_daily_reports_intern_date ON daily_reports (intern_id, get_vietnam_date(created_at));
