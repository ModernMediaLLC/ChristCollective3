import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Users, Video, Building2, Heart } from "lucide-react";
import worldCrossBackground from "@assets/Untitled design_1749616500817.jpg";
import blueSkyBg from "@assets/Beautiful_blue_sky_background_7b0e6fef20.jpg";
import businessNetworkImg from "@assets/pexels-fauxels-3184325.jpg";
import contentCreationImg from "@assets/pexels-cottonbro-6883807.jpg";
import charityVolunteerImg from "@assets/pexels-julia-m-cameron-6994855.jpg";

// Define slider content type
type SlideContent = {
  id: number;
  image: string;
  heading: string;
  subheading: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
};

export default function HeroSection() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const slides: SlideContent[] = [
    {
      id: 1,
      image: worldCrossBackground,
      heading: "Uniting Christians Worldwide",
      subheading: "Christ Collective is a community of creatives, who have chosen to use their gifts & influence to bridge the gap between sacred & secular spaces, bringing jesus to the creative community through content creation & various creative means.",
      primaryButtonText: isAuthenticated ? "My Account" : "Join the Collective",
      primaryButtonLink: isAuthenticated ? "/profile" : "/join",
      secondaryButtonText: "Learn More",
      secondaryButtonLink: "/#about",
    },
    {
      id: 2,
      image: contentCreationImg,
      heading: "Create for Christ",
      subheading: "Join a community of Christian creatives who connect, create and grow in faith together.",
      primaryButtonText: "Join as a Creator",
      primaryButtonLink: "/join",
      secondaryButtonText: "Meet the Creators",
      secondaryButtonLink: "/creators",
    },
    {
      id: 3,
      image: businessNetworkImg,
      heading: "Christian Business Network",
      subheading: "Get your business in our directory of Christian-owned businesses. Listing is free.",
      primaryButtonText: "List Your Business",
      primaryButtonLink: "/join/business",
      secondaryButtonText: "Browse Businesses",
      secondaryButtonLink: "/business",
    },
    {
      id: 4,
      image: charityVolunteerImg,
      heading: "Supporting Christian Ministries",
      subheading: "Churches and ministries — get listed so believers can find a place to serve, give and belong.",
      primaryButtonText: "List Your Ministry",
      primaryButtonLink: "/join/ministry",
      secondaryButtonText: "Browse Ministries",
      secondaryButtonLink: "/ministries",
    },
  ];

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="h-[600px] relative overflow-hidden">
      <div className="embla h-full" ref={emblaRef}>
        <div className="embla__container h-full flex">
          {slides.map((slide) => (
            <div key={slide.id} className="embla__slide relative h-full flex-[0_0_100%]">
              <div 
                className="h-full flex items-center justify-center relative bg-cover bg-center"
                style={{
                  backgroundImage: `url(${slide.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                <div className="container mx-auto px-4 text-center text-white relative z-10">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{slide.heading}</h1>
                  <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8">
                    {slide.subheading}
                  </p>
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
                    <Link href={slide.primaryButtonLink}>
                      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-black hover:bg-primary/90 h-11 px-8 font-semibold py-3 text-lg">
                        {slide.primaryButtonText}
                      </button>
                    </Link>
                    <Link href={slide.secondaryButtonLink}>
                      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-white hover:bg-gray-100 text-black h-11 px-8 font-semibold py-3 text-lg">
                        {slide.secondaryButtonText}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Slider Controls with Icons - Hidden on mobile */}
      <div className="absolute z-20 bottom-8 left-0 right-0 justify-center gap-4 hidden md:flex">
        {slides.map((_, index) => {
          // Define icons for each slide
          const icons = [
            <Users className="w-4 h-4" />, // Community/Fellowship
            <Video className="w-4 h-4" />, // Content Creators
            <Building2 className="w-4 h-4" />, // Business Network
            <Heart className="w-4 h-4" /> // Donations/Missions
          ];
          
          return (
            <button
              key={index}
              className={`w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center ${
                index === selectedIndex 
                  ? "bg-primary text-white shadow-lg scale-110" 
                  : "bg-white bg-opacity-60 text-gray-700 hover:bg-opacity-80"
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            >
              {icons[index]}
            </button>
          );
        })}
      </div>
      
      <button
        className="absolute z-20 left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-opacity hidden md:block"
        onClick={scrollPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft size={24} />
      </button>
      
      <button
        className="absolute z-20 right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-opacity hidden md:block"
        onClick={scrollNext}
        aria-label="Next slide"
      >
        <ChevronRight size={24} />
      </button>
    </section>
  );
}
