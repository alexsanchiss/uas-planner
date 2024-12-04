'use client'

import { Header } from '../components/header'
import { FlightPlansUploader } from '../components/FlightPlansUploader'

export default function TrajectoryGenerator() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">Trajectory Generator</h1>
        <FlightPlansUploader />
      </main>
    </div>
  )
}

