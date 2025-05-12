import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [stats, setStats] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get('https://conversion-tracking-server.onrender.com/api/gclid-stats', {
      headers: {
        'x-api-key': 'meinGeheimerApiKey'
      }
    })
    .then(res => {
      setStats(res.data)
    })
    .catch(err => {
      console.error("Fehler beim Laden:", err)
      setError('API konnte nicht geladen werden')
    })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>GCLID Statistik</h1>

      {error && <p style={{ color: 'red' }}>❌ {error}</p>}

      {!error && stats.length === 0 && (
        <p>ℹ️ Keine Daten gefunden – heute wurde noch nichts getrackt.</p>
      )}

      {stats.map((item, index) => (
        <div key={index} style={{ marginBottom: '1rem' }}>
          <h3>{item.label}</h3>
          <p>Total: {item.total}</p>
          <p>Consent: ✅ {item.consentYes} | ❌ {item.consentNo}</p>
        </div>
      ))}
    </div>
  )
}

export default App
