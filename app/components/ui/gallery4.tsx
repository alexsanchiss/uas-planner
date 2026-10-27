"use client"

import { ArrowLeft, ArrowRight, Map, Radar, ShieldCheck, type LucideIcon } from "lucide-react"
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
  icon: LucideIcon
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
    icon: Map,
  },
  {
    id: "2",
    title: "Real-Time Airspace Awareness",
    description:
      "Stay informed with live geoawareness data. Monitor restricted zones, weather conditions, and other airspace users in real time.",
    icon: Radar,
  },
  {
    id: "3",
    title: "Automated Authorization",
    description:
      "Submit flight plans and receive authorization through our streamlined approval pipeline. Compliance made effortless.",
    icon: ShieldCheck,
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
            <h2 className="mb-3 text-3xl font-semibold md:mb-4 md:text-4xl lg:mb-6 text-fg">
              {title}
            </h2>
            <p className="text-base text-fg-2 md:text-lg lg:max-w-2xl">
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
              aria-label="Previous slide"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                carouselApi?.scrollNext()
              }}
              disabled={!canScrollNext}
              className="disabled:pointer-events-auto"
              aria-label="Next slide"
            >
              <ArrowRight className="size-5" aria-hidden="true" />
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
                <div className="group flex flex-col justify-between">
                  <div className="flex aspect-[3/2] items-center justify-center overflow-clip rounded-xl bg-gradient-to-br from-surface-2 via-surface to-subtle">
                    <item.icon
                      className="h-16 w-16 text-brand-text transition duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mb-2 line-clamp-3 break-words pt-4 text-lg font-medium md:mb-3 md:pt-4 md:text-xl lg:pt-4 lg:text-2xl text-fg">
                    {item.title}
                  </div>
                  <div className="mb-8 line-clamp-2 text-sm text-fg-2 md:mb-12 md:text-base lg:mb-9">
                    {item.description}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="flex justify-center gap-2 mt-6">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollTo(index)}
              className={`h-2 rounded-full transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                currentIndex === index
                  ? "w-8 bg-fg"
                  : "w-2 bg-line-2 hover:bg-line-hover"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={currentIndex === index || undefined}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export { Gallery4 }
export type { GalleryItem, Gallery4Props }
