SET @avatar_path_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_path'
);
SET @avatar_path_sql = IF(
  @avatar_path_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE avatar_path_statement FROM @avatar_path_sql;
EXECUTE avatar_path_statement;
DEALLOCATE PREPARE avatar_path_statement;

SET @avatar_updated_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_updated_at'
);
SET @avatar_updated_at_sql = IF(
  @avatar_updated_at_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_updated_at DATETIME NULL',
  'SELECT 1'
);
PREPARE avatar_updated_at_statement FROM @avatar_updated_at_sql;
EXECUTE avatar_updated_at_statement;
DEALLOCATE PREPARE avatar_updated_at_statement;
