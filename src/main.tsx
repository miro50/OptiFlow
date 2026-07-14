import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeSupabaseSync } from './utils/db'

// Trigger Supabase cloud storage synchronization asynchronously on application launch
initializeSupabaseSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
