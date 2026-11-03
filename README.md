# CBSUA Supply Office Inventory Management System

## Start the application

Open `html/index.html` in a browser, preferably through VS Code Live Server.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Change your username, display name, and password from **Settings** after signing in. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records.

This version stores accounts, records, and sessions in the current browser. It has no server-side authentication or shared database, so changes are not shared across devices and browser storage is not a secure location for real passwords or official records. Delivery attachments are not uploaded; only the selected filename is recorded. A real multi-user deployment requires a secured backend, database, and file storage.