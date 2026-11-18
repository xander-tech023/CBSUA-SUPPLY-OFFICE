# CBSUA Supply Office Inventory Management System

## Start the application

Open `html/index.html` in a browser. The application runs entirely in the browser and does not require a server or additional setup.

The workspace includes starter inventory, supplier, request, receipt, and issuance data. Added or edited records are saved in local browser storage and remain available until browser data is cleared.

Data and appearance preferences are stored locally in browser storage. Clearing browser data resets the workspace.

| Workspace | Initial username | Initial password | Home |
|---|---|---|---|
| Admin — Supply Office head | `admin` | `admin123` | Dashboard and request approvals |
| Staff — Supply Office team | `staff` | `staff123` | Inventory and stock operations |

Admin and staff credentials are fixed and cannot be changed from **Settings**. The admin can approve or reject requests. Approval checks current stock; approved requests can then be issued by staff, which records the issuance and deducts inventory. New requests require the requesting employee's name and employee ID. Staff can create requests, add and inspect items, receive deliveries, and maintain supplier records.

Appearance preferences are local to the browser. Delivery attachments are not uploaded; only the selected filename is recorded.

The Stock Requests page exports its currently filtered rows as CSV. Issue Supplies can print an approved requisition gate pass and export a recorded receipt through the browser's print dialog; choose **Save as PDF** to create a PDF. Status messages appear as floating notifications.

React and ReactDOM are included from jsDelivr and power the toast notification component. Tailwind CSS and Chart.js are also loaded from their CDNs, so use a network connection when opening the pages.
