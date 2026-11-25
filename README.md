# CBSUA Supply Office Inventory Management System

## Database setup

Start MySQL from XAMPP. The API connects to MySQL and creates the `cbsua_supply_office` database and required tables if they do not already exist. Existing tables and rows are preserved; the application does not import browser-local records or accounts.

Set the connection and initial account passwords in PowerShell before starting the API:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_NAME = "cbsua_supply_office"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:ADMIN_PASSWORD = "REPLACE_WITH_A_UNIQUE_PASSWORD_1"
$env:STAFF_PASSWORD = "REPLACE_WITH_ANOTHER_UNIQUE_PASSWORD_2"
npm run api
```

Replace the example passwords with strong, unique values. Use the configured MySQL account and strong, unique passwords for deployments. Do not commit credentials. If an admin or staff row already exists without a password hash, the API sets its password from the corresponding environment variable on first startup; an existing hashed password is left unchanged. If a role has no account, the API creates one using `ADMIN_USERNAME` or `STAFF_USERNAME` (defaulting to `admin` and `staff`). For an existing account, sign in with its current username in the `users` table. Initial passwords must be 12-64 characters and contain a letter and a number.

Environment variables are read by the API process. Set them again in each new terminal session or configure them through your deployment environment. The API hashes passwords and stores only hashed, expiring session tokens. The browser does not keep business records, account credentials, or sessions in local storage.

## Run the application

Run the API from the repository root, and the Vite app from `vite-cbsua_supply_office` in separate terminals. Start MySQL and configure the API environment first.

```powershell
npm run api
```

```powershell
cd vite-cbsua_supply_office
npm install
npm run dev -- --host 0.0.0.0
```

Vite proxies `/api` requests to `http://127.0.0.1:3001`. Build the frontend with `npm run build` from `vite-cbsua_supply_office`; the API serves the built files from `vite-cbsua_supply_office/dist`. Set `PUBLIC_APP_URL` to the public application base URL when deploying behind a domain or path prefix. Set `TRUST_PROXY=1` when HTTPS is terminated by a trusted reverse proxy.

The database stores users, inventory items, categories, suppliers, requests, receipts, issuances, stock movements, request status history, and password reset requests. End-users can edit the item, classification, quantity, and remarks on their own pending requests for their office; reviewed requests cannot be edited. Receipt and issuance stock changes, request edits, approvals/cancellations, and generated references are handled by database transactions. Fund Cluster, P.O. No., and IAR No. sequences continue across months and restart each year.

Password reset requests are stored in the database and require administrator approval. Delivery attachments are not uploaded; only the selected filename is stored.

The Stock Requests page exports its currently filtered rows as CSV. Issue Supplies can print official forms and export one printable QR label for a selected issued Semi-expendable (ICS) or Fixed Asset (PAR) through the browser's print dialog; choose **Save as PDF** to create a PDF. Status messages appear as floating notifications.

Admin, staff, and end-user home pages can request a mobile scanner link from the API. When the app is opened on this computer through `localhost`, the API uses the computer's LAN IPv4 address in the scanner link; connect the phone to the same Wi-Fi and allow the app's port through Windows Firewall. Set `PUBLIC_APP_URL` to a phone-accessible URL when using a domain or another network. QR labels contain a self-contained snapshot of eligible asset details, not holder or employee information; anyone with a QR link can view that snapshot. Regenerate labels after item details, network addresses, or `PUBLIC_APP_URL` change. Camera scanning requires a secure HTTPS origin on mobile devices.

Tailwind CSS and optional page integrations are loaded from their CDNs and require an internet connection.
