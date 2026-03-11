"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/app/components/ui/button"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/app/components/ui/carousel"

interface GalleryItem {
  id: string
  title: string
  description: string
  href: string
  image: string
}

interface Gallery4Props {
  title?: string
  description?: string
  items?: GalleryItem[]
}

const defaultItems: GalleryItem[] = [
  {
    id: "1",
    title: "Intelligent Flight Planning",
    description:
      "Design precise drone flight paths with our interactive map interface. Set waypoints, define altitudes, and preview your mission before takeoff.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&h=600&fit=crop",
  },
  {
    id: "2",
    title: "Real-Time Airspace Awareness",
    description:
      "Stay informed with live geoawareness data. Monitor restricted zones, weather conditions, and other airspace users in real time.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1508444845599-5c89863b1c44?w=800&h=600&fit=crop",
  },
  {
    id: "3",
    title: "Automated Authorization",
    description:
      "Submit flight plans and receive authorization through our streamlined approval pipeline. Compliance made effortless.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&h=600&fit=crop",
  },
  {
    id: "4",
    title: "Mission Analytics",
    description:
      "Review completed missions with detailed 3D trajectory visualization. Analyze performance and optimize future operations.",
    href: "#",
    image:
      "https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&h=600&fit=crop",
  },
]

const Gallery4 = ({
  title = "Platform Capabilities",
  description = "Discover the tools that power modern drone operations.",
  items = defaultItems,
}: Gallery4Props) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!carouselApi) {
      return
    }

    const updateState = () => {
      setCanScrollPrev(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
      setCurrentIndex(carouselApi.selectedScrollSnap())
    }

    updateState()
    carouselApi.on("select", updateState)
    carouselApi.on("reInit", updateState)

    return () => {
      carouselApi.off("select", updateState)
      carouselApi.off("reInit", updateState)
    }
  }, [carouselApi])

  const scrollTo = useCallback(
    (index: number) => {
      carouselApi?.scrollTo(index)
    },
    [carouselApi]
  )

  return (
    <section className="py-16">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col justify-between md:mb-14 md:flex-row md:items-end lg:mb-16">
          <div>
            <h2 className="mb-3 text-3xl font-semibold md:mb-4 md:text-4xl lg:mb-6 text-white">
              {title}
            </h2>
            <p className="text-base text-white/60 md:text-lg lg:max-w-2xl">
              {description}
            </p>
          </div>
          <div className="mt-8 flex shrink-0 items-center justify-start gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                carouselApi?.scrollPrev()
              }}
              disabled={!canScrollPrev}
              className="disabled:pointer-events-auto"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                carouselApi?.scrollNext()
              }}
              disabled={!canScrollNext}
              className="disabled:pointer-events-auto"
            >
              <ArrowRight className="size-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            breakpoints: {
              "(min-width: 768px)": {
                dragFree: true,
              },
            },
          }}
        >
          <CarouselContent className="ml-[calc(1rem-20px)] mr-4 2xl:ml-[calc(50vw-700px+1rem-20px)] 2xl:mr-[calc(50vw-700px+1rem)]">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="pl-[20px] md:max-w-[452px]"
              >
                <a
                  href={item.href}
                  className="group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex aspect-[3/2] overflow-clip rounded-xl">
                      <div className="flex-1">
                        <div className="relative h-full w-full origin-bottom transition duration-300 group-hover:scale-105">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-cover object-center"
                            unoptimized
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 line-clamp-3 break-words pt-4 text-lg font-medium md:mb-3 md:pt-4 md:text-xl lg:pt-4 lg:text-2xl text-white">
                    {item.title}
                  </div>
                  <div className="mb-8 line-clamp-2 text-sm text-white/60 md:mb-12 md:text-base lg:mb-9">
                    {item.description}
                  </div>
                </a>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="flex justify-center gap-2 mt-6">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === index
                  ? "w-8 bg-white"
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export { Gallery4 }
export type { GalleryItem, Gallery4Props }
