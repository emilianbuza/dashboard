import { useEffect, useState } from 'react'
import axios from 'axios'

function GclidTable() {
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get('https://conversion-tracking-server.onrender.com/api/gclid-entries', {
      headers: {
        'x-api-key': 'meinGeheimerApiKey'
      }
    })
    .then(res => setEntries(res.data))
    .catch(err => {
      console.error("Fehler beim Laden der Tabelle:", err)
      setError("API konnte nicht geladen werden")
    })
  }, [])

  return (
    <div style={{ paddingTop: '2rem' }}>
      <h2>GCLID Einträge (Heute)</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Uhrzeit</th>
            <th>GCLID</th>
            <th>Consent</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td>{new Date(e.timestamp).toLocaleString()}</td>
              <td>{e.clickId || "–"}</td>
              <td style={{ textAlign: 'center' }}>{e.consent ? '✅ Ja' : '❌ Nein'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default GclidTable
