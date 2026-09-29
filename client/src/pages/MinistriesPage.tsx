import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getImageUrl } from "@/lib/api-config";
import { Input } from "@/components/ui/input";
import { 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  ExternalLink, 
  Search,
  Eye,
  Calendar,
  Filter
} from "lucide-react";
import { MinistryProfile } from "@shared/schema";

export default function MinistriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [denominationFilter, setDenominationFilter] = useState("");

  const { data: ministries = [], isLoading } = useQuery({
    queryKey: ["/api/ministries"],
  });

  // Filter ministries based on search and denomination
  const filteredMinistries = Array.isArray(ministries) 
    ? ministries.filter((ministry: MinistryProfile) => {
        const matchesSearch = !searchQuery || 
          ministry.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ministry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ministry.location?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesDenomination = !denominationFilter || 
          ministry.denomination?.toLowerCase().includes(denominationFilter.toLowerCase());
        
        return matchesSearch && matchesDenomination;
      })
    : [];

  // Get unique denominations for filter
  const denominations = Array.from(new Set(
    Array.isArray(ministries) 
      ? ministries.map((m: MinistryProfile) => m.denomination).filter(Boolean)
      : []
  ));

  return (
    <>
      <Helmet>
        <title>Ministries - Christ Collective</title>
        <meta name="description" content="Connect with Christian ministries and churches in your community through Christ Collective." />
      </Helmet>
      
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="bg-black py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Christian Ministries
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Discover and connect with ministries, churches, and Christian organizations making a difference in communities worldwide
            </p>
            <div className="mb-10">
              <Link href="/join/ministry">
                <Button className="bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold h-12 px-8 text-base">
                  List your ministry — free
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-3">Takes about 2 minutes. Founding ministries get featured first.</p>
            </div>

            {/* Search and Filter */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search ministries by name, location, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={denominationFilter === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDenominationFilter("")}
                  className="text-xs"
                >
                  All Denominations
                </Button>
                {denominations.slice(0, 6).map((denomination) => (
                  <Button
                    key={denomination}
                    variant={denominationFilter === denomination ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDenominationFilter(denomination === denominationFilter ? "" : (denomination || ""))}
                    className="text-xs"
                  >
                    {denomination}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ministries Grid */}
        <div className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-12">
            {isLoading ? (
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
          ) : filteredMinistries.length === 0 ? (
            <div className="text-center py-16">
              <Building className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">
                {searchQuery || denominationFilter ? "No ministries found" : "No ministries yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || denominationFilter 
                  ? "Try adjusting your search or filter criteria" 
                  : "Be the first to add your ministry to our community"
                }
              </p>
              {!searchQuery && !denominationFilter && (
                <Link href="/join/ministry">
                  <Button className="bg-primary hover:bg-primary/90">
                    Add Your Ministry
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>


              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMinistries.map((ministry: MinistryProfile) => (
                  <Card key={ministry.id} className="bg-black border-gray-800 hover:bg-gray-900 transition-all duration-300">
                    <CardHeader className="text-center pb-4">
                      <Avatar className="h-20 w-20 mx-auto mb-4">
                        <AvatarImage src={ministry.logo ? getImageUrl(ministry.logo) : undefined} alt={ministry.name} />
                        <AvatarFallback className="bg-primary text-black text-2xl font-bold">
                          {ministry.name?.charAt(0) || 'M'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <CardTitle className="text-white text-lg">{ministry.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                          {ministry.denomination && (
                            <Badge variant="outline" className="text-xs bg-[#D4AF37]/30 border-[#D4AF37] text-[#D4AF37]">
                              {ministry.denomination}
                            </Badge>
                          )}
                          {ministry.isVerified && (
                            <Badge className="text-xs bg-green-900/30 border-green-600 text-green-300">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">
                        {ministry.description}
                      </p>
                      
                      <div className="space-y-2 mb-4">
                        {ministry.location && (
                          <div className="flex items-center text-xs text-gray-400">
                            <MapPin className="h-3 w-3 mr-2 text-primary" />
                            <span className="truncate">{ministry.location}</span>
                          </div>
                        )}
                        {ministry.email && (
                          <div className="flex items-center text-xs text-gray-400">
                            <Mail className="h-3 w-3 mr-2 text-primary" />
                            <span className="truncate">{ministry.email}</span>
                          </div>
                        )}
                        {ministry.website && (
                          <div className="flex items-center text-xs text-gray-400">
                            <ExternalLink className="h-3 w-3 mr-2 text-primary" />
                            <a 
                              href={ministry.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline truncate"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Link href={`/ministry/${ministry.id}`} className="flex-1">
                          <Button 
                            size="sm" 
                            className="w-full bg-primary hover:bg-primary/90"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 border-gray-600 hover:bg-gray-800"
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Events
                        </Button>
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