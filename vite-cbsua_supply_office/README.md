# CBSUA Supply Office Inventory Management System

The sign-in screen is mounted by React and preserves the existing login, registration, and password-change flows. The workspace pages are separate Vite HTML entries so their existing layouts and navigation remain unchanged.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open the URL printed by Vite. After signing in, use the existing workspace navigation.

## Production build

```sh
npm run build
npm run preview
```

Tailwind CSS and optional page integrations load from their existing CDNs and require an internet connection.
