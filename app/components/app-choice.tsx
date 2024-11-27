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
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <div className="p-4 flex-grow">
        <div className="aspect-square overflow-hidden rounded-lg mb-4">
          <Image
            className="w-full h-full object-cover"
            src={image}
            alt={name}
            width={300}
            height={300}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">{name}</h2>
          <p className="text-gray-400">{description}</p>
        </div>
      </div>
      <div className="p-4 bg-gray-700">
        <Button onClick={onLaunch} className="w-full">
          Launch App
        </Button>
      </div>
    </div>
  )
}

