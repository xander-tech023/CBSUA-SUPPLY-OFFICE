<?php
declare(strict_types=1);

require_once __DIR__ . '/db_config.php';
header('Content-Type: text/plain; charset=utf-8');

if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit("Run setup from this computer only.\n");
}

function ensureColumn(mysqli $db, string $table, string $column, string $definition): void
{
    $statement = $db->prepare(
        'SELECT COUNT(*) AS total FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $databaseName = DB_NAME;
    $statement->bind_param('sss', $databaseName, $table, $column);
    $statement->execute();
    if ((int) $statement->get_result()->fetch_assoc()['total'] === 0) {
        $db->query("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }
}

function ensureUniqueIndex(mysqli $db, string $table, string $index, string $column): void
{
    $statement = $db->prepare(
        'SELECT COUNT(*) AS total FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?'
    );
    $databaseName = DB_NAME;
    $statement->bind_param('sss', $databaseName, $table, $index);
    $statement->execute();
    if ((int) $statement->get_result()->fetch_assoc()['total'] === 0) {
        $db->query("CREATE UNIQUE INDEX `{$index}` ON `{$table}` (`{$column}`)");
    }
}

try {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, '', DB_PORT);
    $connection->set_charset('utf8mb4');
    $databaseName = str_replace('`', '``', DB_NAME);
    $connection->query("CREATE DATABASE IF NOT EXISTS `{$databaseName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $connection->select_db(DB_NAME);

    $connection->query(
        'CREATE TABLE IF NOT EXISTS suppliers (
            id VARCHAR(30) NOT NULL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            category VARCHAR(255) DEFAULT NULL,
            contact VARCHAR(150) DEFAULT NULL,
            phone VARCHAR(50) DEFAULT NULL,
            email VARCHAR(150) DEFAULT NULL,
            address TEXT DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->query(
        'CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM("admin", "staff") NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            title VARCHAR(150) DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->query(
        'CREATE TABLE IF NOT EXISTS inventory_items (
            id VARCHAR(30) NOT NULL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            description TEXT DEFAULT NULL,
            category VARCHAR(100) DEFAULT NULL,
            quantity INT UNSIGNED NOT NULL DEFAULT 0,
            unit VARCHAR(50) NOT NULL,
            minimum INT UNSIGNED NOT NULL DEFAULT 0,
            supplier_id VARCHAR(30) DEFAULT NULL,
            expiry_date DATE DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL,
            KEY fk_inventory_supplier (supplier_id),
            CONSTRAINT fk_inventory_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->query(
        "CREATE TABLE IF NOT EXISTS stock_requests (
            id VARCHAR(30) NOT NULL PRIMARY KEY,
            requested_date DATE NOT NULL DEFAULT (CURRENT_DATE),
            office VARCHAR(150) NOT NULL,
            recipient VARCHAR(150) NOT NULL,
            employee_id VARCHAR(50) DEFAULT NULL,
            item_id VARCHAR(30) NOT NULL,
            quantity INT UNSIGNED NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Issued')),
            reviewed_by BIGINT UNSIGNED DEFAULT NULL,
            reviewed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            remarks TEXT DEFAULT NULL,
            KEY fk_requests_item (item_id),
            KEY stock_requests_status_idx (status),
            KEY fk_requests_reviewer (reviewed_by),
            CONSTRAINT fk_requests_item FOREIGN KEY (item_id) REFERENCES inventory_items (id),
            CONSTRAINT fk_requests_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $connection->query(
        'CREATE TABLE IF NOT EXISTS stock_receipts (
            id VARCHAR(30) NOT NULL PRIMARY KEY,
            item_id VARCHAR(30) NOT NULL,
            quantity INT UNSIGNED NOT NULL,
            supplier_id VARCHAR(30) DEFAULT NULL,
            received_by BIGINT UNSIGNED DEFAULT NULL,
            received_date DATE NOT NULL DEFAULT (CURRENT_DATE),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            delivery_reference VARCHAR(100) DEFAULT NULL,
            batch_number VARCHAR(100) DEFAULT NULL,
            expiry_date DATE DEFAULT NULL,
            remarks TEXT DEFAULT NULL,
            attachment_name VARCHAR(255) DEFAULT NULL,
            KEY fk_receipts_item (item_id),
            KEY fk_receipts_supplier (supplier_id),
            KEY fk_receipts_user (received_by),
            CONSTRAINT fk_receipts_item FOREIGN KEY (item_id) REFERENCES inventory_items (id),
            CONSTRAINT fk_receipts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
            CONSTRAINT fk_receipts_user FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->query(
        'CREATE TABLE IF NOT EXISTS stock_issuances (
            id VARCHAR(30) NOT NULL PRIMARY KEY,
            request_id VARCHAR(30) NOT NULL,
            item_id VARCHAR(30) NOT NULL,
            quantity INT UNSIGNED NOT NULL,
            office VARCHAR(150) DEFAULT NULL,
            recipient VARCHAR(150) DEFAULT NULL,
            handled_by BIGINT UNSIGNED DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            issuance_date DATE DEFAULT NULL,
            recipient_employee_id VARCHAR(50) DEFAULT NULL,
            remarks TEXT DEFAULT NULL,
            KEY fk_issuances_request (request_id),
            KEY fk_issuances_item (item_id),
            KEY fk_issuances_user (handled_by),
            CONSTRAINT fk_issuances_item FOREIGN KEY (item_id) REFERENCES inventory_items (id),
            CONSTRAINT fk_issuances_request FOREIGN KEY (request_id) REFERENCES stock_requests (id),
            CONSTRAINT fk_issuances_user FOREIGN KEY (handled_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->query(
        'CREATE TABLE IF NOT EXISTS login_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED DEFAULT NULL,
            username_attempted VARCHAR(100) NOT NULL,
            role_attempted ENUM("admin", "staff") DEFAULT NULL,
            success TINYINT(1) NOT NULL,
            failure_reason VARCHAR(255) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_login_logs_logged_at (logged_at),
            KEY idx_login_logs_username (username_attempted),
            KEY fk_login_logs_user (user_id),
            CONSTRAINT fk_login_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensureColumn($connection, 'stock_requests', 'remarks', 'TEXT DEFAULT NULL');
    ensureColumn($connection, 'stock_receipts', 'delivery_reference', 'VARCHAR(100) DEFAULT NULL');
    ensureColumn($connection, 'stock_receipts', 'batch_number', 'VARCHAR(100) DEFAULT NULL');
    ensureColumn($connection, 'stock_receipts', 'expiry_date', 'DATE DEFAULT NULL');
    ensureColumn($connection, 'stock_receipts', 'remarks', 'TEXT DEFAULT NULL');
    ensureColumn($connection, 'stock_receipts', 'attachment_name', 'VARCHAR(255) DEFAULT NULL');
    ensureColumn($connection, 'stock_issuances', 'issuance_date', 'DATE DEFAULT NULL');
    ensureColumn($connection, 'stock_issuances', 'recipient_employee_id', 'VARCHAR(100) DEFAULT NULL');
    ensureColumn($connection, 'stock_issuances', 'remarks', 'TEXT DEFAULT NULL');
    ensureUniqueIndex($connection, 'stock_receipts', 'stock_receipts_delivery_reference_unique', 'delivery_reference');

    $findUser = $connection->prepare('SELECT id FROM users WHERE role = ?');
    $insertUser = $connection->prepare(
        'INSERT INTO users (role, username, password_hash, full_name, title, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    );
    $updateUser = $connection->prepare(
        'UPDATE users SET username = ?, password_hash = ?, full_name = ?, title = ?, is_active = 1 WHERE role = ?'
    );
    foreach ([
        ['admin', 'admin', 'admin123', 'Renjene D.S. Rivera', 'Head, Supply Office'],
        ['staff', 'staff', 'staff123', 'Maria Santos', 'Supply Staff Officer']
    ] as [$role, $username, $password, $name, $title]) {
        $findUser->bind_param('s', $role);
        $findUser->execute();
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($findUser->get_result()->fetch_assoc()) {
            $updateUser->bind_param('sssss', $username, $passwordHash, $name, $title, $role);
            $updateUser->execute();
        } else {
            $insertUser->bind_param('sssss', $role, $username, $passwordHash, $name, $title);
            $insertUser->execute();
        }
    }

    $itemCount = (int) $connection->query('SELECT COUNT(*) AS total FROM inventory_items')->fetch_assoc()['total'];
    if ($itemCount === 0) {
        $insertSupplier = $connection->prepare(
            'INSERT IGNORE INTO suppliers (id, name, category, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ([
            ['SUP-001', 'Bicol Office Depot', 'Office & school supplies, paper, stationery', 'Maria Cruz — Procurement', '0917-XXX-XXXX', 'bod@example.ph', 'National Highway, Sipocot, Camarines Sur'],
            ['SUP-002', 'Sipocot Print Supply', 'Printers, toner, ink, printing services', 'Juan Reyes — Manager', '0918-XXX-XXXX', 'sps@example.ph', 'Barangay San Vicente, Sipocot, Camarines Sur'],
            ['SUP-003', 'Camarines Essentials', 'Medical, hygiene, cleaning supplies', 'Ana Santos — Sales Officer', '0915-XXX-XXXX', 'ce@example.ph', 'Centro, Sipocot, Camarines Sur']
        ] as [$id, $name, $category, $contact, $phone, $email, $address]) {
            $insertSupplier->bind_param('sssssss', $id, $name, $category, $contact, $phone, $email, $address);
            $insertSupplier->execute();
        }

        $insertItem = $connection->prepare(
            'INSERT INTO inventory_items (id, name, category, quantity, unit, minimum, supplier_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ([
            ['ITM-001', 'Bond paper, A4', 'Paper supplies', 18, 'reams', 20, 'SUP-001'],
            ['ITM-002', 'Bond paper, letter', 'Paper supplies', 240, 'reams', 50, 'SUP-001'],
            ['ITM-003', 'Ballpen per pack', 'Writing tools', 24, 'pieces', 10, 'SUP-001'],
            ['ITM-004', 'Toner cartridge', 'Printing', 12, 'cartridges', 5, 'SUP-002'],
            ['ITM-005', 'Ethyl alcohol, 500 mL', 'Cleaning', 36, 'bottles', 10, 'SUP-003'],
            ['ITM-008', 'Whiteboard marker', 'Writing tools', 0, 'pieces', 10, 'SUP-001']
        ] as [$id, $name, $category, $quantity, $unit, $minimum, $supplierId]) {
            $insertItem->bind_param('sssisis', $id, $name, $category, $quantity, $unit, $minimum, $supplierId);
            $insertItem->execute();
        }
    }

    echo "Setup complete. Database: " . DB_NAME . "\n";
    echo "Initial admin login: admin / admin123\n";
    echo "Initial staff login: staff / staff123\n";
    echo "Delete setup.php now, then open the application through http://localhost/CBSUA-SUPPLY-OFFICE/html/index.html\n";
    $connection->close();
} catch (Throwable $error) {
    http_response_code(500);
    error_log('CBSUA database setup failed: ' . $error->getMessage());
    echo "Setup failed. Check the XAMPP MySQL service and db_config.php settings.\n";
}
