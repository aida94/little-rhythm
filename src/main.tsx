import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { askPersistentStorage } from './lib/db'
import './styles.css'

askPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
