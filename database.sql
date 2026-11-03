-- TripLink database  (MySQL / MariaDB)
-- Import into the database selected in phpMyAdmin; this file does not create or select a database.

DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS buses;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS cities;

CREATE TABLE cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_city INT NOT NULL,
  to_city INT NOT NULL,
  distance_km INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (from_city) REFERENCES cities(id),
  FOREIGN KEY (to_city) REFERENCES cities(id),
  UNIQUE KEY uq_route (from_city, to_city)
) ENGINE=InnoDB;

CREATE TABLE buses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  reg_no VARCHAR(20) NOT NULL,
  bus_type ENUM('Normal','Semi Luxury','Luxury','Super Luxury') NOT NULL DEFAULT 'Semi Luxury',
  total_seats INT NOT NULL DEFAULT 40,
  amenities VARCHAR(160) DEFAULT 'AC,Charging,WiFi',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_buses_reg_no (reg_no)
) ENGINE=InnoDB;

-- Daily timetable template. Real trips (dated) are generated from this automatically.
CREATE TABLE schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  bus_id INT NOT NULL,
  depart_time TIME NOT NULL,
  duration_min INT NOT NULL,
  fare DECIMAL(10,2) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (bus_id) REFERENCES buses(id)
) ENGINE=InnoDB;

CREATE TABLE trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  route_id INT NOT NULL,
  bus_id INT NOT NULL,
  depart_date DATE NOT NULL,
  depart_time TIME NOT NULL,
  arrive_time TIME NOT NULL,
  fare DECIMAL(10,2) NOT NULL,
  status ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
  UNIQUE KEY uq_trip (schedule_id, depart_date),
  KEY idx_trips_depart_date (depart_date),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id),
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (bus_id) REFERENCES buses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  avatar_path VARCHAR(255) NULL,
  avatar_updated_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref VARCHAR(12) NOT NULL UNIQUE,
  trip_id INT NOT NULL,
  passenger_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) DEFAULT NULL,
  user_id INT NULL,
  group_ref VARCHAR(14) NULL,
  leg ENUM('outbound','return') NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  KEY idx_bookings_created_at (created_at),
  KEY idx_bookings_user_id (user_id),
  KEY idx_bookings_group_ref (group_ref),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- UNIQUE(trip_id, seat_no) makes double-booking impossible, even with simultaneous users
CREATE TABLE booking_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  trip_id INT NOT NULL,
  seat_no INT NOT NULL,
  UNIQUE KEY uq_seat (trip_id, seat_no),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE admin_audit (
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

-- ---------- Sample data ----------
INSERT INTO cities (name) VALUES
('Colombo'),('Kandy'),('Galle'),('Matara'),('Jaffna'),('Anuradhapura'),
('Nuwara Eliya'),('Badulla'),('Batticaloa'),('Trincomalee'),('Kurunegala'),('Ratnapura');

UPDATE cities SET lat = 6.927100, lng = 79.861200 WHERE name = 'Colombo';
UPDATE cities SET lat = 7.290600, lng = 80.633700 WHERE name = 'Kandy';
UPDATE cities SET lat = 6.053500, lng = 80.221000 WHERE name = 'Galle';
UPDATE cities SET lat = 5.954900, lng = 80.555000 WHERE name = 'Matara';
UPDATE cities SET lat = 9.661500, lng = 80.025500 WHERE name = 'Jaffna';
UPDATE cities SET lat = 8.311400, lng = 80.403700 WHERE name = 'Anuradhapura';
UPDATE cities SET lat = 6.949700, lng = 80.789100 WHERE name = 'Nuwara Eliya';
UPDATE cities SET lat = 6.993400, lng = 81.055000 WHERE name = 'Badulla';
UPDATE cities SET lat = 7.731000, lng = 81.674700 WHERE name = 'Batticaloa';
UPDATE cities SET lat = 8.587400, lng = 81.215200 WHERE name = 'Trincomalee';
UPDATE cities SET lat = 7.486300, lng = 80.364700 WHERE name = 'Kurunegala';
UPDATE cities SET lat = 6.705600, lng = 80.384700 WHERE name = 'Ratnapura';

-- routes (id order: 1..)  both directions
INSERT INTO routes (from_city,to_city,distance_km) VALUES
(1,2,115),(2,1,115),
(1,3,125),(3,1,125),
(1,4,160),(4,1,160),
(1,5,395),(5,1,395),
(1,6,205),(6,1,205),
(2,7,80),(7,2,80),
(1,8,230),(8,1,230),
(4,2,260),(2,4,260),
(1,10,260),(10,1,260),
(3,4,45),(4,3,45);

INSERT INTO buses (name,reg_no,bus_type,total_seats,amenities) VALUES
('Lanka Express','NB-4521','Super Luxury',40,'AC,Charging,WiFi,Reclining Seats'),
('Ceylon Star','NA-7788','Luxury',40,'AC,Charging,WiFi'),
('Island Rider','ND-3302','Semi Luxury',40,'AC,Charging'),
('Southern Pearl','NC-9150','Luxury',40,'AC,Charging,WiFi'),
('Hill Country Cruiser','NB-1177','Semi Luxury',40,'AC,Charging');

-- schedules: route_id, bus_id, depart_time, duration(min), fare (LKR)
INSERT INTO schedules (route_id,bus_id,depart_time,duration_min,fare) VALUES
(1,1,'06:00:00',210,1200),(1,2,'09:30:00',210,1100),(1,3,'14:00:00',220,900),(1,1,'18:30:00',210,1200),
(2,1,'07:00:00',210,1200),(2,2,'11:00:00',210,1100),(2,3,'15:30:00',220,900),(2,2,'19:30:00',210,1100),
(3,4,'05:30:00',150,1000),(3,2,'08:30:00',150,900),(3,4,'13:00:00',160,1000),(3,3,'17:00:00',160,800),
(4,4,'06:30:00',150,1000),(4,2,'10:00:00',150,900),(4,4,'14:30:00',160,1000),(4,3,'18:00:00',160,800),
(5,4,'06:00:00',210,1500),(5,1,'10:00:00',200,1600),(5,4,'16:00:00',210,1500),
(6,4,'07:00:00',210,1500),(6,1,'12:00:00',200,1600),(6,4,'17:30:00',210,1500),
(7,1,'19:00:00',540,3200),(7,2,'21:00:00',560,3000),
(8,1,'19:30:00',540,3200),(8,2,'21:30:00',560,3000),
(9,2,'06:30:00',330,2000),(9,3,'13:00:00',340,1800),
(10,2,'08:00:00',330,2000),(10,3,'15:00:00',340,1800),
(11,5,'07:30:00',150,700),(11,5,'13:30:00',150,700),
(12,5,'09:30:00',150,700),(12,5,'15:30:00',150,700),
(13,5,'20:00:00',420,2400),(14,5,'20:30:00',420,2400),
(15,4,'05:00:00',420,2200),(16,4,'06:00:00',420,2200),
(17,1,'21:00:00',450,2800),(18,1,'21:30:00',450,2800),
(19,3,'07:00:00',75,350),(19,3,'12:00:00',75,350),(20,3,'09:00:00',75,350),(20,3,'16:00:00',75,350);
