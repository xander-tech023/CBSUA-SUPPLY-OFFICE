# CBSUA Supply Office Inventory Management System

## Start the application

Open `html/index.html` in a browser, preferably through VS Code Live Server.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Change your username, display name, and password from **Settings** after signing in. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records.

This version stores accounts, records, and sessions in the current browser. It has no server-side authentication or shared database, so changes are not shared across devices and browser storage is not a secure location for real passwords or official records. Delivery attachments are not uploaded; only the selected filename is recorded. A real multi-user deployment requires a secured backend, database, and file storage.

## MongoDB connection backend

The Node.js backend connects to MongoDB Atlas without exposing database credentials to browser code. This connection currently provides a health check only; the login, accounts, and inventory data still use browser storage.

1. Install Node.js, then run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` in `.env` to the Atlas URI and replace `YOUR_URL_ENCODED_PASSWORD` with the database user's URL-encoded password. Do not commit or share `.env`.
4. Optionally change `MONGODB_DB` or `PORT`.
5. Run `npm start` and open `http://127.0.0.1:3000/health`. A successful connection returns `{"status":"ok","database":"cbsua_supply_office"}`.

The Atlas database user's password must be supplied locally; it is not included in this repository. Ensure the machine running the backend is permitted by the cluster's Atlas network access rules.