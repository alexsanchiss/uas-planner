import { useState } from 'react'
import { AppChoice } from './app-choice'
import { Header } from './header'

const apps = [
  {
    name: 'UAS Planner',
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

export function MainPage() {
  const [userEmail] = useState('user@example.com') // Replace with actual user email from authentication
  
  const handleLogout = () => {
    // Implement logout logic here
    console.log('User logged out')
  }

  const handleLaunchApp = (appName: string) => {
    // Implement app launch logic here
    console.log(`Launching ${appName}`)
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      <Header 
        userEmail={userEmail}
        onLogout={handleLogout}
        apps={apps.map(app => ({ name: app.name, onLaunch: () => handleLaunchApp(app.name) }))}
      />
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

