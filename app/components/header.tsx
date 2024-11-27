import Image from 'next/image'
import { Button } from './ui/button'

interface HeaderProps {
  userEmail: string
  onLogout: () => void
  apps: { name: string; onLaunch: () => void }[]
}

export function Header({ userEmail, onLogout, apps }: HeaderProps) {
  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {apps.map((app, index) => (
            <button
              key={index}
              onClick={app.onLaunch}
              className="text-gray-300 hover:text-white transition-colors"
            >
              {app.name}
            </button>
          ))}
        </div>
        <div className="flex-shrink-0">
          <Image src="/images/logo.jpg" alt="UAS PLANNER Logo" width={150} height={50} />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Image src="/images/pfp.jpg" alt="User Profile" width={32} height={32} className="rounded-full" />
            <span className="text-gray-300">{userEmail}</span>
          </div>
          <Button onClick={onLogout} variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </div>
      </div>
    </header>
  )
}

