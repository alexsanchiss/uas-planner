'use client'

import { Header } from '../components/header'
import QGroundControl from '../components/QGroundControl'

export default function TrajectoryGenerator() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <QGroundControl />
    </div>
  )
}

