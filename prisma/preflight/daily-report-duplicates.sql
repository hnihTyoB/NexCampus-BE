-- Read-only preflight for 20260727140000_unique_daily_report_per_day.
-- This query must return zero rows before running `prisma migrate deploy`.
SELECT
  intern_id,
  created_at::date AS report_date,
  COUNT(*) AS report_count
FROM daily_reports
GROUP BY intern_id, created_at::date
HAVING COUNT(*) > 1
ORDER BY report_date, intern_id;
