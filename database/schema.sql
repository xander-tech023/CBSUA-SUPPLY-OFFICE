-- CBSUA Supply Office Inventory Management System
-- MySQL/MariaDB schema for XAMPP. Safe to import repeatedly: existing tables are preserved.
-- Import via phpMyAdmin (Import tab) or: mysql -u root < database/schema.sql

CREATE DATABASE IF NOT EXISTS `cbsua_supply_office`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cbsua_supply_office`;

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
  KEY `fk_inventory_supplier` (`supplier_id`),
  CONSTRAINT `fk_inventory_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_requests` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `requested_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `office` VARCHAR(150) NOT NULL,
  `recipient` VARCHAR(150) NOT NULL,
  `employee_id` VARCHAR(50) DEFAULT NULL,
  `item_id` VARCHAR(30) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (`status` IN ('Pending', 'Approved', 'Rejected', 'Issued')),
  `reviewed_by` BIGINT UNSIGNED DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remarks` TEXT DEFAULT NULL,
  KEY `fk_requests_item` (`item_id`),
  KEY `stock_requests_status_idx` (`status`),
  KEY `fk_requests_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_requests_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_requests_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_receipts` (
  `id` VARCHAR(30) NOT NULL PRIMARY KEY,
  `item_id` VARCHAR(30) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `supplier_id` VARCHAR(30) DEFAULT NULL,
  `received_by` BIGINT UNSIGNED DEFAULT NULL,
  `received_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivery_reference` VARCHAR(100) DEFAULT NULL,
  `batch_number` VARCHAR(100) DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `attachment_name` VARCHAR(255) DEFAULT NULL,
  KEY `fk_receipts_item` (`item_id`),
  KEY `fk_receipts_supplier` (`supplier_id`),
  KEY `fk_receipts_user` (`received_by`),
  UNIQUE KEY `stock_receipts_delivery_reference_unique` (`delivery_reference`),
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
  KEY `fk_issuances_request` (`request_id`),
  KEY `fk_issuances_item` (`item_id`),
  KEY `fk_issuances_user` (`handled_by`),
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
  KEY `idx_login_logs_logged_at` (`logged_at`),
  KEY `idx_login_logs_username` (`username_attempted`),
  KEY `fk_login_logs_user` (`user_id`),
  CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
