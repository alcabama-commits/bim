import React from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App'

const el = document.getElementById('root')
if (el) {
  const root = createRoot(el)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
