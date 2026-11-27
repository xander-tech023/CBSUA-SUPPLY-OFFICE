import { useEffect } from 'react'
import loginDocument from './html/index.html?raw'
import logo from './Image/logo.png'
import { initializeLogin } from './TypeScript/login.ts'
import './CSS/style.css'
import './TypeScript/accounts.ts'
import './TypeScript/records.ts'
import './TypeScript/script.ts'

const loginMarkup = new DOMParser()
  .parseFromString(loginDocument, 'text/html')
  .body.innerHTML.replaceAll('../Image/logo.png', logo)

function App() {
  useEffect(() => {
    initializeLogin()
  }, [])

  return (
    <div
      className="font-sans min-h-screen"
      dangerouslySetInnerHTML={{ __html: loginMarkup }}
    />
  )
}

export default App
