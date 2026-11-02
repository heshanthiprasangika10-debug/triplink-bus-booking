-- Add indexes used by the admin analytics dashboard.
-- Run against the selected database in phpMyAdmin; safe to run repeatedly.
SET @database_name = DATABASE();

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @database_name AND table_name = 'bookings'
    AND index_name = 'idx_bookings_created_at'
);
SET @statement = IF(@index_exists = 0,
  'ALTER TABLE bookings ADD INDEX idx_bookings_created_at (created_at)',
  'SELECT 1');
PREPARE admin_analytics_stmt FROM @statement;
EXECUTE admin_analytics_stmt;
DEALLOCATE PREPARE admin_analytics_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @database_name AND table_name = 'trips'
    AND index_name = 'idx_trips_depart_date'
);
SET @statement = IF(@index_exists = 0,
  'ALTER TABLE trips ADD INDEX idx_trips_depart_date (depart_date)',
  'SELECT 1');
PREPARE admin_analytics_stmt FROM @statement;
EXECUTE admin_analytics_stmt;
DEALLOCATE PREPARE admin_analytics_stmt;
