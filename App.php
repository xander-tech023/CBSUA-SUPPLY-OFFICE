<?php
declare(strict_types=1);

require_once __DIR__ . '/Setup.php';

final class App
{
    private PDO $database;

    public function __construct()
    {
        $this->database = Setup::connect();
    }

    public function getDatabase(): PDO
    {
        return $this->database;
    }
}
