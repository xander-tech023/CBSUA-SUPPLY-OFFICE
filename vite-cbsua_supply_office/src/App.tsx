import { useEffect } from 'react'
import loginDocument from './html/index.html?raw'
import logo from './Image/logo.png'
import { initializeLogin } from './Javascript/login.js'
import './CSS/style.css'
import './Javascript/accounts.js'
import './Javascript/records.js'
import './Javascript/script.js'

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
