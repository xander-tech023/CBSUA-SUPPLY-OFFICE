<?php
declare(strict_types=1);

/**
 * One-time local XAMPP installer for the CBSUA Supply Office login tables.
 * Run at http://localhost/CBSUA-SUPPLY-OFFICE/setup_xampp.php, then delete it.
 */

// Refuse requests from non-local clients. This installer is not meant for production.
$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
if (PHP_SAPI !== 'cli' && !in_array($remoteAddress, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit('Run this setup script from the local XAMPP computer only.');
}

$host = 'localhost';
$database = 'cbsua_supply_office';
$dbUser = 'root';
$dbPassword = ''; // XAMPP default. Set this if you configured a MySQL root password.

try {
    $pdo = new PDO(
        "mysql:host={$host};charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$database}`");

    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'staff') NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            title VARCHAR(150) DEFAULT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    SQL);

    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS login_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED DEFAULT NULL,
            username_attempted VARCHAR(100) NOT NULL,
            role_attempted ENUM('admin', 'staff') DEFAULT NULL,
            success BOOLEAN NOT NULL,
            failure_reason VARCHAR(255) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_logs_logged_at (logged_at),
            INDEX idx_login_logs_username (username_attempted),
            CONSTRAINT fk_login_logs_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE SET NULL
        ) ENGINE=InnoDB
    SQL);

    // Hash passwords in PHP; never store the supplied passwords as plain text.
    $accounts = [
        [
            'username' => 'admin',
            'password' => 'admin123',
            'role' => 'admin',
            'full_name' => 'Jo-Ann Michelle R. Dio',
            'title' => 'Head of Supply Office',
        ],
        [
            'username' => 'staff',
            'password' => 'staff123',
            'role' => 'staff',
            'full_name' => 'Jezrel Oribiana',
            'title' => 'Supply Staff Officer',
        ],
    ];

    // Insert initial accounts without replacing passwords for existing accounts.
    $insertUser = $pdo->prepare(<<<'SQL'
        INSERT INTO users (username, password_hash, role, full_name, title)
        VALUES (:username, :password_hash, :role, :full_name, :title)
        ON DUPLICATE KEY UPDATE
            full_name = VALUES(full_name),
            title = VALUES(title),
            role = VALUES(role)
    SQL);

    foreach ($accounts as $account) {
        $insertUser->execute([
            ':username' => $account['username'],
            ':password_hash' => password_hash($account['password'], PASSWORD_DEFAULT),
            ':role' => $account['role'],
            ':full_name' => $account['full_name'],
            ':title' => $account['title'],
        ]);
    }

    header('Content-Type: text/plain; charset=utf-8');
    echo "XAMPP database setup completed.\n";
    echo "Database: {$database}\n";
    echo "Users table and login_logs table are ready.\n";
    echo "Initial accounts: admin / admin123 and staff / staff123\n";
    echo "Delete setup_xampp.php now. Change the initial passwords before real use.\n";
} catch (Throwable $error) {
    http_response_code(500);
    error_log('CBSUA XAMPP setup error: ' . $error->getMessage());
    header('Content-Type: text/plain; charset=utf-8');
    echo "Setup failed. Ensure Apache and MySQL are running and check the database credentials at the top of this file.\n";
}
