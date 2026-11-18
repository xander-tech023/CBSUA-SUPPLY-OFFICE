# XAMPP database setup

The `schema.sql` file contains the MySQL/MariaDB tables used by the CBSUA Supply Office app. It creates the default `cbsua_supply_office` database and can be imported with phpMyAdmin or the MySQL command line.

## Recommended setup

1. Copy the project to `C:\xampp\htdocs\CBSUA-SUPPLY-OFFICE` and start Apache and MySQL in the XAMPP Control Panel.
2. Open `http://localhost/CBSUA-SUPPLY-OFFICE/setup.php`. This creates the database and tables, then seeds the initial admin/staff accounts and sample suppliers and inventory.
3. Delete `setup.php` after setup succeeds, then open `http://localhost/CBSUA-SUPPLY-OFFICE/html/index.html`.

## Import the SQL schema directly

In phpMyAdmin (`http://localhost/phpmyadmin`), choose **Import**, select `database/schema.sql`, and run it. Alternatively, from a terminal in the project directory run:

```sh
mysql -u root < database/schema.sql
```

The schema is for structure only; it does not insert login accounts or sample inventory. After importing it, visit `http://localhost/CBSUA-SUPPLY-OFFICE/setup.php` once so the app's initial accounts and starter data are created. The default XAMPP connection is `127.0.0.1:3306`, database `cbsua_supply_office`, user `root`, and an empty password; edit `db_config.php` or set its documented environment variables if your local setup differs.

The setup script is intended for local development. Delete it after running, and change the default passwords before using the app beyond a local test environment.
