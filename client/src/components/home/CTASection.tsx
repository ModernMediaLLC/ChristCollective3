import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import blueSkyBg from "@assets/Beautiful_blue_sky_background_7b0e6fef20.jpg";
import communityGroupImg from "@assets/pexels-bertellifotografia-3752600.jpg";

export default function CTASection() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  
  // Fetch live statistics
  const { data: statistics, isLoading } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  return (
    <section 
      className="py-20 text-white relative"
      style={{
        backgroundImage: `url(${communityGroupImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#121212', // Fallback color
      }}
    >
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Our Growing Community Today</h2>
        <p className="text-lg text-white max-w-3xl mx-auto mb-8">
          Together, we can make a difference through faith, service, and fellowship.
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
          <Button 
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-8 rounded-md transition-colors text-lg"
          >
            {isAuthenticated ? (
              <Link href="/profile">
                <span>My Account</span>
              </Link>
            ) : (
              <Link href="/join">
                <span>Create Your Account</span>
              </Link>
            )}
          </Button>
          <Button 
            asChild
            size="lg"
            variant="outline"
            className="bg-transparent border border-white hover:border-primary hover:text-primary text-white font-semibold py-3 px-8 rounded-md transition-colors text-lg"
          >
            <Link href="/#about">
              <span>Learn More</span>
            </Link>
          </Button>
        </div>
        
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">
              {isLoading ? (
                <div className="h-10 bg-gray-300 rounded animate-pulse"></div>
              ) : (
                `${statistics?.communityMembers || 0}+`
              )}
            </div>
            <p className="text-gray-300">Community Members</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">
              {isLoading ? (
                <div className="h-10 bg-gray-300 rounded animate-pulse"></div>
              ) : (
                `$${Math.round(statistics?.donationsRaised || 0).toLocaleString()}+`
              )}
            </div>
            <p className="text-gray-300">Donations Raised</p>
          </div>
          {/* Directories are brand new — until they fill up, these tiles invite signups instead of showing "0+" */}
          <DirectoryStat count={statistics?.businessMembers} label="Business Members" noun="business" cta="List your business" href="/join/business" isLoading={isLoading} />
          <DirectoryStat count={statistics?.ministries} label="Ministries" noun="ministry" cta="List your ministry" href="/join/ministry" isLoading={isLoading} />
        </div>
      </div>
    </section>
  );
}

const MIN_TO_SHOW_COUNT = 10;

function DirectoryStat({ count, label, noun, cta, href, isLoading }: { count?: number; label: string; noun: string; cta: string; href: string; isLoading: boolean }) {
  if (isLoading) return <div><div className="h-10 bg-gray-300 rounded animate-pulse mb-2"></div><p className="text-gray-300">{label}</p></div>;
  if ((count || 0) >= MIN_TO_SHOW_COUNT) {
    return (
      <div>
        <div className="text-4xl font-bold text-primary mb-2">{count}+</div>
        <p className="text-gray-300">{label}</p>
      </div>
    );
  }
  return (
    <Link href={href}>
      <div className="cursor-pointer group">
        <div className="text-2xl md:text-3xl font-bold text-primary mb-2 group-hover:underline">{cta} →</div>
        <p className="text-gray-300">Be a founding {noun} — free</p>
      </div>
    </Link>
  );
}
