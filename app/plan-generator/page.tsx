'use client'

import { Header } from '../components/header'
import QGroundControl from '../components/QGroundControl'

export default function TrajectoryGenerator() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <div style={{ width: '100vw', height: '100vh' }}>
        <QGroundControl />
      </div>
    </div>
  )
}

