-- Enforce 1 daily report per intern per calendar day
CREATE UNIQUE INDEX idx_daily_reports_intern_date ON daily_reports (intern_id, (created_at::date));
