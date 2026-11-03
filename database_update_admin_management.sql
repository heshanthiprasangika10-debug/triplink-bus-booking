-- Admin management schema additions. Select the target database in phpMyAdmin.
-- Safe to run repeatedly; does not create, drop, or select a database.
SET @database_name = DATABASE();

DROP PROCEDURE IF EXISTS triplink_add_admin_column;
DELIMITER //
CREATE PROCEDURE triplink_add_admin_column(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = @database_name AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @database_name AND table_name = p_table AND column_name = p_column
  ) THEN
    SET @triplink_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(p_table, '`', '``'), '` ADD COLUMN `',
      REPLACE(p_column, '`', '``'), '` ', p_definition
    );
    PREPARE triplink_stmt FROM @triplink_ddl;
    EXECUTE triplink_stmt;
    DEALLOCATE PREPARE triplink_stmt;
  END IF;
END//
DELIMITER ;

CALL triplink_add_admin_column('cities', 'lat', 'DECIMAL(9,6) NULL');
CALL triplink_add_admin_column('cities', 'lng', 'DECIMAL(9,6) NULL');
CALL triplink_add_admin_column('cities', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL triplink_add_admin_column('cities', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL triplink_add_admin_column('routes', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL triplink_add_admin_column('routes', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL triplink_add_admin_column('routes', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL triplink_add_admin_column('buses', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL triplink_add_admin_column('buses', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL triplink_add_admin_column('buses', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL triplink_add_admin_column('schedules', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL triplink_add_admin_column('schedules', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL triplink_add_admin_column('schedules', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL triplink_add_admin_column('trips', 'status', "ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled'");

DROP PROCEDURE triplink_add_admin_column;

DROP PROCEDURE IF EXISTS triplink_add_admin_bus_index;
DELIMITER //
CREATE PROCEDURE triplink_add_admin_bus_index()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = @database_name AND table_name = 'buses'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = @database_name AND table_name = 'buses' AND index_name = 'uq_buses_reg_no'
  ) THEN
    IF EXISTS (
      SELECT reg_no FROM buses GROUP BY reg_no HAVING COUNT(*) > 1
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Duplicate bus registration numbers must be fixed before applying this migration.';
    END IF;
    CREATE UNIQUE INDEX uq_buses_reg_no ON buses (reg_no);
  END IF;
END//
DELIMITER ;
CALL triplink_add_admin_bus_index();
DROP PROCEDURE triplink_add_admin_bus_index;

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin VARCHAR(100) NOT NULL DEFAULT 'admin',
  action VARCHAR(30) NOT NULL,
  entity VARCHAR(30) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_created_at (created_at),
  KEY idx_admin_audit_entity (entity, entity_id)
) ENGINE=InnoDB;

UPDATE cities SET lat = 6.927100, lng = 79.861200 WHERE name = 'Colombo' AND lat IS NULL;
UPDATE cities SET lat = 7.290600, lng = 80.633700 WHERE name = 'Kandy' AND lat IS NULL;
UPDATE cities SET lat = 6.053500, lng = 80.221000 WHERE name = 'Galle' AND lat IS NULL;
UPDATE cities SET lat = 5.954900, lng = 80.555000 WHERE name = 'Matara' AND lat IS NULL;
UPDATE cities SET lat = 9.661500, lng = 80.025500 WHERE name = 'Jaffna' AND lat IS NULL;
UPDATE cities SET lat = 8.311400, lng = 80.403700 WHERE name = 'Anuradhapura' AND lat IS NULL;
UPDATE cities SET lat = 6.949700, lng = 80.789100 WHERE name = 'Nuwara Eliya' AND lat IS NULL;
UPDATE cities SET lat = 6.993400, lng = 81.055000 WHERE name = 'Badulla' AND lat IS NULL;
UPDATE cities SET lat = 7.731000, lng = 81.674700 WHERE name = 'Batticaloa' AND lat IS NULL;
UPDATE cities SET lat = 8.587400, lng = 81.215200 WHERE name = 'Trincomalee' AND lat IS NULL;
UPDATE cities SET lat = 7.486300, lng = 80.364700 WHERE name = 'Kurunegala' AND lat IS NULL;
UPDATE cities SET lat = 6.705600, lng = 80.384700 WHERE name = 'Ratnapura' AND lat IS NULL;
