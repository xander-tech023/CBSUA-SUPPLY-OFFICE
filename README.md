# CBSUA Supply Office Inventory Management System

## Start the application

Run the API from the repository root and the Vite app from `vite-cbsua_supply_office` in separate terminals:

```sh
npm run api
```

```sh
cd vite-cbsua_supply_office
npm install
npm run dev -- --host 0.0.0.0
```

The Vite server proxies `/api` requests to the API on port `3001`. Build the frontend with `npm run build` from `vite-cbsua_supply_office`; the API serves the built files from `vite-cbsua_supply_office/dist`. Set `PUBLIC_APP_URL` to the public application base URL when deploying behind a domain or path prefix.

The workspace includes starter inventory, supplier, request, receipt, and issuance data. Added or edited records are saved in local browser storage and remain available until browser data is cleared.

Data and appearance preferences are stored locally in browser storage. Clearing browser data resets the workspace.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Admin and staff credentials are fixed and cannot be changed from **Settings**. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records.

Appearance preferences are local to the browser. Delivery attachments are not uploaded; only the selected filename is recorded.

The Stock Requests page exports its currently filtered rows as CSV. Issue Supplies can print official forms and export printable QR labels for issued ICS and PAR assets through the browser's print dialog; choose **Save as PDF** to create a PDF. Status messages appear as floating notifications.

Admin, staff, and end-user home pages can request a mobile scanner link from the API. QR labels contain a self-contained snapshot of eligible asset details, not holder or employee information; anyone with a QR link can view that snapshot. Regenerate labels after item details change. Camera scanning requires a secure HTTPS origin on mobile devices.

Tailwind CSS and optional page integrations are loaded from their CDNs and require an internet connection.
