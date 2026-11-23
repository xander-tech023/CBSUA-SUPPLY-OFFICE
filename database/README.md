# CBSUA Supply Office database

## Run in MySQL Workbench

1. Start MySQL in XAMPP and connect to that same server in MySQL Workbench.
2. Open `database/schema.sql` using **File > Open SQL Script**.
3. Confirm the connection is selected, then click the lightning-bolt **Execute** button.
4. The script creates `cbsua_supply_office`, all application tables, working login accounts, suppliers, and starter inventory. No PHP setup step is required.
5. Make sure `db_config.php` (or its documented environment variables) uses the same host, port, database name, and MySQL credentials as the Workbench connection.

## Login accounts

| Workspace | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |

Run this script only against a local development database. It is intended for MySQL Workbench and XAMPP.
