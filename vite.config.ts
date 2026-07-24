import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // L'app viene pubblicata in una sottocartella (non alla radice del dominio),
  // quindi gli asset generati devono usare percorsi relativi a quel path.
  base: '/projects/mixflowdj/',
})
