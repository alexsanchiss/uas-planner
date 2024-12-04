'use client'

import { Header } from './components/header'
import { AppChoice } from './components/app-choice'
import { useRouter } from 'next/navigation'

const apps = [
  {
    name: 'Trajectory Generator',
    description: 'Plan and manage your UAS missions efficiently.',
    image: '/images/uas-planner.jpg'
  },
  {
    name: 'Flight Tracker',
    description: 'Real-time tracking and analytics for your flights.',
    image: '/images/flight-tracker.jpg'
  },
  {
    name: 'Maintenance Log',
    description: 'Keep detailed maintenance records for your UAS fleet.',
    image: '/images/maintenance-log.jpg'
  }
]

export default function MainPage() {
  const router = useRouter()

  const handleLaunchApp = (appName: string) => {
    // Implement app launch logic here
    console.log(`Launching ${appName}`)
    // For example, navigate to the trajectory-generator page when launching UAS Planner
    if (appName === 'Trajectory Generator') {
      router.push('/trajectory-generator')
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app, index) => (
            <AppChoice 
              key={index} 
              {...app} 
              onLaunch={() => handleLaunchApp(app.name)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

