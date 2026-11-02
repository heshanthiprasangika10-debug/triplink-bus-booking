-- Run with the TripLink database selected in phpMyAdmin.
-- Safe to run repeatedly; does not drop or replace existing data.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @add_user_id = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'user_id') = 0,
  'ALTER TABLE bookings ADD COLUMN user_id INT NULL',
  'DO 0'
);
PREPARE add_user_id_stmt FROM @add_user_id;
EXECUTE add_user_id_stmt;
DEALLOCATE PREPARE add_user_id_stmt;

SET @add_user_index = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'idx_bookings_user_id') = 0,
  'CREATE INDEX idx_bookings_user_id ON bookings (user_id)',
  'DO 0'
);
PREPARE add_user_index_stmt FROM @add_user_index;
EXECUTE add_user_index_stmt;
DEALLOCATE PREPARE add_user_index_stmt;

SET @users_engine = IF(
  (SELECT engine FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'users') <> 'InnoDB',
  'ALTER TABLE users ENGINE=InnoDB',
  'DO 0'
);
PREPARE users_engine_stmt FROM @users_engine;
EXECUTE users_engine_stmt;
DEALLOCATE PREPARE users_engine_stmt;

SET @bookings_engine = IF(
  (SELECT engine FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'bookings') <> 'InnoDB',
  'ALTER TABLE bookings ENGINE=InnoDB',
  'DO 0'
);
PREPARE bookings_engine_stmt FROM @bookings_engine;
EXECUTE bookings_engine_stmt;
DEALLOCATE PREPARE bookings_engine_stmt;

SET @add_user_fk = IF(
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE() AND table_name = 'bookings'
     AND column_name = 'user_id' AND referenced_table_name = 'users') = 0,
  'ALTER TABLE bookings ADD CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'DO 0'
);
PREPARE add_user_fk_stmt FROM @add_user_fk;
EXECUTE add_user_fk_stmt;
DEALLOCATE PREPARE add_user_fk_stmt;
