# CBSUA Supply Office database

## Run in MySQL Workbench

1. Open MySQL Workbench and connect to MySQL 8.0 or MariaDB/MySQL-compatible server used by XAMPP.
2. Open `database/schema.sql` using **File > Open SQL Script**.
3. Confirm the connection is selected, then click the lightning-bolt **Execute** button.
4. The script creates `cbsua_supply_office`, all application tables, foreign keys, and seed account rows.
5. In XAMPP, open `http://localhost/CBSUA-SUPPLY-OFFICE/setup.php` once. It replaces placeholder password hashes with working PHP password hashes and adds starter inventory. Then delete `setup.php`.

You can also import the script using **Server > Data Import** or copy/paste it into a Workbench SQL tab and execute it.

## Login accounts

| Workspace | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |

Do not run the schema against a production database. It is intended for local XAMPP/MySQL Workbench setup.
