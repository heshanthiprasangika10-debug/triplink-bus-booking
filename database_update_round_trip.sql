-- Run with the TripLink database selected in phpMyAdmin.
-- Adds round-trip grouping and ensures booking writes can roll back atomically.

SET @add_group_ref = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'group_ref') = 0,
  'ALTER TABLE bookings ADD COLUMN group_ref VARCHAR(14) NULL',
  'DO 0'
);
PREPARE add_group_ref_stmt FROM @add_group_ref;
EXECUTE add_group_ref_stmt;
DEALLOCATE PREPARE add_group_ref_stmt;

SET @add_leg = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'leg') = 0,
  "ALTER TABLE bookings ADD COLUMN leg ENUM('outbound','return') NULL",
  'DO 0'
);
PREPARE add_leg_stmt FROM @add_leg;
EXECUTE add_leg_stmt;
DEALLOCATE PREPARE add_leg_stmt;

SET @add_group_ref_index = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'idx_bookings_group_ref') = 0,
  'CREATE INDEX idx_bookings_group_ref ON bookings (group_ref)',
  'DO 0'
);
PREPARE add_group_ref_index_stmt FROM @add_group_ref_index;
EXECUTE add_group_ref_index_stmt;
DEALLOCATE PREPARE add_group_ref_index_stmt;

SET @ensure_trips_innodb = IF(
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'trips' AND engine <> 'InnoDB') = 1,
  'ALTER TABLE trips ENGINE=InnoDB',
  'DO 0'
);
PREPARE ensure_trips_innodb_stmt FROM @ensure_trips_innodb;
EXECUTE ensure_trips_innodb_stmt;
DEALLOCATE PREPARE ensure_trips_innodb_stmt;

SET @ensure_bookings_innodb = IF(
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'bookings' AND engine <> 'InnoDB') = 1,
  'ALTER TABLE bookings ENGINE=InnoDB',
  'DO 0'
);
PREPARE ensure_bookings_innodb_stmt FROM @ensure_bookings_innodb;
EXECUTE ensure_bookings_innodb_stmt;
DEALLOCATE PREPARE ensure_bookings_innodb_stmt;

SET @ensure_booking_seats_innodb = IF(
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'booking_seats' AND engine <> 'InnoDB') = 1,
  'ALTER TABLE booking_seats ENGINE=InnoDB',
  'DO 0'
);
PREPARE ensure_booking_seats_innodb_stmt FROM @ensure_booking_seats_innodb;
EXECUTE ensure_booking_seats_innodb_stmt;
DEALLOCATE PREPARE ensure_booking_seats_innodb_stmt;
