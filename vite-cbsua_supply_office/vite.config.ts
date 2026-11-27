import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(projectRoot, 'index.html'),
        login: resolve(projectRoot, 'src/html/index.html'),
        dashboard: resolve(projectRoot, 'src/html/dashboard.html'),
        end_user_dashboard: resolve(projectRoot, 'src/html/end_user_dashboard.html'),
        asset_scanner: resolve(projectRoot, 'src/html/asset_scanner.html'),
        inventory: resolve(projectRoot, 'src/html/inventory.html'),
        issue_supply: resolve(projectRoot, 'src/html/issue_supply.html'),
        navigation: resolve(projectRoot, 'src/html/navigation.html'),
        offices: resolve(projectRoot, 'src/html/offices.html'),
        receive_stock: resolve(projectRoot, 'src/html/receive_stock.html'),
        stock_request: resolve(projectRoot, 'src/html/stock_request.html'),
        suppliers: resolve(projectRoot, 'src/html/suppliers.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
