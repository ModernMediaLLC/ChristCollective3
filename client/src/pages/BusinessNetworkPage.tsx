import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getImageUrl } from "@/lib/api-config";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Briefcase, MapPin, Mail, ExternalLink, Eye, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserDisplayName } from "@/lib/user-display";
import { Helmet } from "react-helmet";

type BusinessProfile = {
  id: number;
  companyName: string;
  industry: string;
  description: string;
  logo?: string;
  location: string;
  networkingGoals?: string;
  user: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    profileImageUrl?: string;
  };
};

type MembershipTier = {
  id: number;
  name: string;
  price: string;
  description: string;
  features: string[];
};

export default function BusinessNetworkPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  
  // Fetch business profiles
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["/api/business-profiles"],
  });
  
  // Fetch membership tiers
  const { data: membershipTiers = [], isLoading: isLoadingTiers } = useQuery({
    queryKey: ["/api/membership-tiers"],
  });
  
  // Fetch live statistics
  const { data: statistics, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/statistics"],
  });
  
  // Default membership tiers if API fails or while loading
  const defaultTiers: MembershipTier[] = [
    {
      id: 1,
      name: "Basic Membership",
      price: "9",
      description: "Perfect for startups and small businesses",
      features: [
        "Basic profile in our business directory",
        "Access to monthly virtual networking events",
        "Join industry-specific groups",
        "Email support"
      ]
    },
    {
      id: 2,
      name: "Professional Membership",
      price: "29",
      description: "For established businesses and professionals",
      features: [
        "Enhanced profile with portfolio showcase",
        "Priority access to all networking events",
        "1:1 business matchmaking service",
        "Access to exclusive resources and training",
        "Priority support"
      ]
    },
    {
      id: 3,
      name: "Executive Membership",
      price: "99",
      description: "For industry leaders and executives",
      features: [
        "Premium featured profile with brand spotlight",
        "VIP access to all events including exclusive executive roundtables",
        "Dedicated business advisor",
        "Opportunity to host and speak at events",
        "All Professional benefits plus executive coaching sessions"
      ]
    }
  ];
  
  // Use API data if available, otherwise use default tiers
  const tiers = Array.isArray(membershipTiers) && membershipTiers.length > 0 ? membershipTiers : defaultTiers;
  
  // Get unique industries for filter
  const industries = Array.from(new Set(
    Array.isArray(profiles) 
      ? profiles.map((p: BusinessProfile) => p.industry).filter(Boolean)
      : []
  ));
  
  // Filter and search profiles
  const filteredProfiles = Array.isArray(profiles) ? profiles.filter((profile: BusinessProfile) => {
    const matchesSearch = !searchQuery || 
      profile.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.location?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesIndustry = !industryFilter || profile.industry?.toLowerCase().includes(industryFilter.toLowerCase());
    
    return matchesSearch && matchesIndustry;
  }) : [];
  
  return (
    <>
      <Helmet>
        <title>Business Network - Christ Collective</title>
        <meta name="description" content="Connect with Christian business owners and professionals who share your values through Christ Collective." />
      </Helmet>
      
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="bg-black py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Christian Business Network
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Connect with Christian business owners and professionals who share your values. Build meaningful relationships and grow your network in our faith-centered community.
            </p>
            <div className="mb-10">
              <Link href="/join/business">
                <Button className="bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold h-12 px-8 text-base">
                  List your business — free
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-3">Takes about 2 minutes. Founding businesses get featured first.</p>
            </div>

            {/* Search and Filter */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search businesses by name, location, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={industryFilter === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIndustryFilter("")}
                  className="text-xs"
                >
                  All Industries
                </Button>
                {industries.slice(0, 6).map((industry) => (
                  <Button
                    key={industry}
                    variant={industryFilter === industry ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIndustryFilter(industry === industryFilter ? "" : industry)}
                    className="text-xs"
                  >
                    {industry}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Business Grid */}
        <div className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-12">
            {isLoadingProfiles ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <Card key={i} className="bg-black border-gray-800">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-16 w-16 bg-gray-700 rounded-full mb-4 mx-auto"></div>
                      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2 mx-auto"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2 mb-4 mx-auto"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-700 rounded"></div>
                        <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">
                {searchQuery || industryFilter ? "No businesses found" : "No businesses yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || industryFilter 
                  ? "Try adjusting your search or filter criteria" 
                  : "Be the first to add your business to our community"
                }
              </p>
              {!searchQuery && !industryFilter && (
                <Link href="/join/business">
                  <Button className="bg-primary hover:bg-primary/90">
                    Add Your Business
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>


              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProfiles.map((profile: BusinessProfile) => (
                  <Card key={profile.id} className="bg-black border-gray-800 hover:bg-gray-900 transition-all duration-300 flex flex-col h-full">
                    <CardHeader className="text-center pb-4">
                      <Avatar className="h-20 w-20 mx-auto mb-4">
                        <AvatarImage src={profile.logo ? getImageUrl(profile.logo) : undefined} alt={profile.companyName} />
                        <AvatarFallback className="bg-primary text-black text-2xl font-bold">
                          {profile.companyName?.charAt(0) || 'B'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <CardTitle className="text-white text-lg">{profile.companyName}</CardTitle>
                      <CardDescription className="text-gray-400">
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                          {profile.industry && (
                            <Badge variant="outline" className="text-xs bg-[#D4AF37]/30 border-[#D4AF37] text-[#D4AF37]">
                              {profile.industry}
                            </Badge>
                          )}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0 flex flex-col flex-1">
                      <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">
                        {profile.description}
                      </p>
                      
                      <div className="space-y-2 mb-4 flex-1">
                        {profile.location && (
                          <div className="flex items-center text-xs text-gray-400">
                            <MapPin className="h-3 w-3 mr-2 text-primary" />
                            <span className="truncate">{profile.location}</span>
                          </div>
                        )}
                        {profile.user && (
                          <div className="flex items-center text-xs text-gray-400">
                            <Users className="h-3 w-3 mr-2 text-primary" />
                            <span className="truncate">{getUserDisplayName(profile.user)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-auto">
                        <Link href={`/business/profile/${profile.id}`} className="flex-1">
                          <Button 
                            size="sm" 
                            className="w-full bg-primary hover:bg-primary/90"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </>
  );
}