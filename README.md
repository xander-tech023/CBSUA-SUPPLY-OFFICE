# CBSUA Supply Office Inventory Management System

## Start the application

Open `html/index.html` in a browser, preferably through VS Code Live Server.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Change your username, display name, and password from **Settings** after signing in. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records.

This version stores accounts, inventory, requests, suppliers, receipts, and issuances in the current browser's `localStorage`. Changes remain on that browser and device, but are not shared across devices. Browser storage is not a secure location for real passwords or official records. Delivery attachments are not uploaded; only the selected filename is recorded.

The Stock Requests page exports its currently filtered rows as CSV. Issue Supplies can print an approved requisition gate pass and export a recorded receipt through the browser's print dialog; choose **Save as PDF** to create a PDF. Dashboard metrics show loading skeletons while browser records are read, and status messages appear as floating notifications.

React and ReactDOM are included from jsDelivr and power the toast notification component. Tailwind CSS and Chart.js are also loaded from their CDNs, so use a network connection when opening the pages. Open `html/index.html` directly or use VS Code Live Server.