<?php
declare(strict_types=1);

define('DB_HOST', getenv('CBSUA_DB_HOST') ?: '127.0.0.1');
define('DB_PORT', (int) (getenv('CBSUA_DB_PORT') ?: 3306));
define('DB_NAME', getenv('CBSUA_DB_NAME') ?: 'cbsua_supply_office');
define('DB_USER', getenv('CBSUA_DB_USER') ?: 'root');
define('DB_PASSWORD', getenv('CBSUA_DB_PASSWORD') ?: '');

function database(): mysqli
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);
    $connection->set_charset('utf8mb4');
    return $connection;
}
