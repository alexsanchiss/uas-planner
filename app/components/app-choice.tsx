'use client'

import Image from 'next/image'
import { Button } from './ui/button'

interface AppChoiceProps {
  name: string
  description: string
  image: string
  onLaunch: () => void
}

export function AppChoice({ name, description, image, onLaunch }: AppChoiceProps) {
  return (
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <Image src={image} alt={name} width={400} height={200} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h2 className="text-xl font-bold text-white mb-2">{name}</h2>
        <p className="text-gray-300 mb-4">{description}</p>
        <Button onClick={onLaunch} className="w-full">
          Launch
        </Button>
      </div>
    </div>
  )
}

