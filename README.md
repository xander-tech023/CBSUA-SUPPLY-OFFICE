# CBSUA Supply Office Inventory Management System

## Start the application with XAMPP

1. Copy the project folder into `C:\xampp\htdocs\CBSUA-SUPPLY-OFFICE`.
2. Start **Apache** and **MySQL** from the XAMPP Control Panel.
3. Open `http://localhost/CBSUA-SUPPLY-OFFICE/setup.php` once to create the MySQL database, tables, initial accounts, and starter inventory.
4. Delete `setup.php` after setup succeeds.
5. Open `http://localhost/CBSUA-SUPPLY-OFFICE/html/index.html`. Do not open the HTML files directly or use Live Server; PHP must run through Apache.

The default database is `cbsua_supply_office` with XAMPP's `root` account and an empty password. Setup creates this database and its tables, including the extra receipt/request/issuance fields the app needs. Update the values in `db_config.php` or set the corresponding `CBSUA_DB_HOST`, `CBSUA_DB_PORT`, `CBSUA_DB_NAME`, `CBSUA_DB_USER`, and `CBSUA_DB_PASSWORD` environment variables if your MySQL configuration differs.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Admin and staff credentials are fixed in MySQL and cannot be changed from **Settings**. Passwords are hashed in the database. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records. Inventory, suppliers, requests, receipts, issuances, and workspace accounts are stored through the PHP API in MySQL.

Appearance preferences are local to the browser. Delivery attachments are not uploaded; only the selected filename is recorded.

The Stock Requests page exports its currently filtered rows as CSV. Issue Supplies can print an approved requisition gate pass and export a recorded receipt through the browser's print dialog; choose **Save as PDF** to create a PDF. Dashboard metrics are loaded from MySQL, and status messages appear as floating notifications.

React and ReactDOM are included from jsDelivr and power the toast notification component. Tailwind CSS and Chart.js are also loaded from their CDNs, so use a network connection when opening the pages.




HAHAHAHA