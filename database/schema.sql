-- ================================================================
-- CBSUA Supply Office - XAMPP / MySQL Workbench setup
-- Execute this entire file with MySQL Workbench (lightning bolt).
-- ================================================================

CREATE DATABASE IF NOT EXISTS `cbsua_supply_office`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cbsua_supply_office`;

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(255) DEFAULT NULL,
  `contact` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff') NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `title` VARCHAR(150) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  `unit` VARCHAR(50) NOT NULL,
  `minimum` INT UNSIGNED NOT NULL DEFAULT 0,
  `supplier_id` VARCHAR(30) DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_inventory_supplier` (`supplier_id`),
  CONSTRAINT `fk_inventory_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_requests` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `requested_date` DATE NOT NULL,
  `office` VARCHAR(150) NOT NULL,
  `recipient` VARCHAR(150) NOT NULL,
  `employee_id` VARCHAR(50) DEFAULT NULL,
  `item_id` VARCHAR(30) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Pending',
  `reviewed_by` BIGINT UNSIGNED DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remarks` TEXT DEFAULT NULL,
  INDEX `idx_requests_item` (`item_id`),
  INDEX `idx_requests_status` (`status`),
  INDEX `idx_requests_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_requests_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_requests_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_request_status` CHECK (`status` IN ('Pending','Approved','Rejected','Issued'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_receipts` (
  `id` VARCHAR(30) NOT NOT NULL PRIMARY KEY,
  `item_id` VARCHAR(30) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `supplier_id` VARCHAR(30) DEFAULT NULL,
  `received_by` BIGINT UNSIGNED DEFAULT NULL,
  `received_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivery_reference` VARCHAR(100) DEFAULT NULL,
  `batch_number` VARCHAR(100) DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `attachment_name` VARCHAR(255) DEFAULT NULL,
  INDEX `idx_receipts_item` (`item_id`),
  INDEX `idx_receipts_supplier` (`supplier_id`),
  INDEX `idx_receipts_user` (`received_by`),
  UNIQUE INDEX `uq_receipts_delivery_reference` (`delivery_reference`),
  CONSTRAINT `fk_receipts_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_receipts_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_receipts_user` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_issuances` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `request_id` VARCHAR(30) NOT NULL,
  `item_id` VARCHAR(30) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `office` VARCHAR(150) DEFAULT NULL,
  `recipient` VARCHAR(150) DEFAULT NULL,
  `handled_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `issuance_date` DATE DEFAULT NULL,
  `recipient_employee_id` VARCHAR(100) DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  INDEX `idx_issuances_request` (`request_id`),
  INDEX `idx_issuances_item` (`item_id`),
  INDEX `idx_issuances_user` (`handled_by`),
  CONSTRAINT `fk_issuances_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_issuances_request` FOREIGN KEY (`request_id`) REFERENCES `stock_requests` (`id`),
  CONSTRAINT `fk_issuances_user` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED DEFAULT NULL,
  `username_attempted` VARCHAR(100) NOT NULL,
  `role_attempted` ENUM('admin', 'staff') DEFAULT NULL,
  `success` TINYINT(1) NOT NULL,
  `failure_reason` VARCHAR(255) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `logged_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_logs_logged_at` (`logged_at`),
  INDEX `idx_login_logs_username` (`username_attempted`),
  INDEX `idx_login_logs_user` (`user_id`),
  CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed users. MySQL Workbench cannot generate PHP password_hash(), so the PHP
-- setup script also updates these accounts with valid application passwords.
INSERT INTO `users` (`username`, `password_hash`, `role`, `full_name`, `title`, `is_active`) VALUES
('admin', '$2y$10$PLACEHOLDER_ADMIN_PASSWORD_HASH', 'admin', 'Jo-Ann Michelle Dio', 'OIC, Supply Officer', 1),
('staff', '$2y$10$PLACEHOLDER_STAFF_PASSWORD_HASH', 'staff', 'Jezrel Oribiana', 'Supply Staff Officer', 1)
ON DUPLICATE KEY UPDATE
  `full_name` = VALUES(`full_name`),
  `title` = VALUES(`title`),
  `is_active` = 1;

SELECT 'CBSUA Supply Office schema created successfully.' AS `status`;
SELECT `id`, `username`, `role`, `full_name` FROM `users`;
