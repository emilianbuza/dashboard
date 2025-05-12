import { useEffect, useState } from 'react'
import axios from 'axios'
import GclidTable from './GclidTable'

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>GCLID Einträge (Dashboard)</h1>
      <GclidTable />
    </div>
  )
}

export default App
