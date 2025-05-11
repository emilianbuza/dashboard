import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [stats, setStats] = useState([])

  useEffect(() => {
    axios.get('https://your-backend.onrender.com/api/gclid-stats', {
      headers: {
        'x-api-key': 'DEIN_API_KEY'
      }
    }).then(res => {
      setStats(res.data)
    }).catch(err => {
      console.error("Fehler beim Laden:", err)
    })
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>GCLID Statistik</h1>
      {stats.map((item, index) => (
        <div key={index} style={{ marginBottom: '1rem' }}>
          <h3>{item.label}</h3>
          <p>Total: {item.total}</p>
          <p>Consent: Ja – {item.consentYes}, Nein – {item.consentNo}</p>
        </div>
      ))}
    </div>
  )
}

export default App
