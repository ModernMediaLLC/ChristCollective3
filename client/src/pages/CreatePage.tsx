import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { 
  Heart, 
  Users, 
  Briefcase, 
  Video, 
  Camera, 
  PenTool, 
  Megaphone,
  Building,
  DollarSign,
  Sparkles,
  Share2
} from "lucide-react";
import { Helmet } from "react-helmet";
import { CreatePostModal } from "@/components/CreatePostModal";
import { isNativeApp } from "@/lib/platform";

type CreateOption = {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  href: string;
  badge: string | null;
  userType: string;
  action?: string;
};

export default function CreatePage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Get user's profile data to determine capabilities
  const { data: creatorStatus } = useQuery({
    queryKey: ["/api/user/creator-status"],
    enabled: !!user,
  });

  const { data: businessProfiles } = useQuery({
    queryKey: ["/api/business-profiles"],
    enabled: !!user,
  });

  const { data: ministryProfile } = useQuery({
    queryKey: ["/api/user/ministry-profile"],
    enabled: !!user,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate(isNativeApp() ? "/auth/mobile" : "/auth");
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Base options available to all regular users
  const baseCreateOptions: CreateOption[] = [
    {
      id: "creator",
      title: "Creator Profile",
      description: "Set up your content creator profile and get sponsored",
      icon: Video,
      color: "text-white",
      bgColor: "bg-purple-500",
      href: "/creators/profile/manage",
      badge: null,
      userType: "all"
    },
    {
      id: "business",
      title: "Business Profile",
      description: "Create or update your business profile for networking",
      icon: Briefcase,
      color: "text-white",
      bgColor: "bg-[#D4AF37]",
      href: "/join/business",
      badge: null,
      userType: "all"
    },
    {
      id: "ministry",
      title: "Ministry Profile",
      description: "Create a profile for your ministry or church organization",
      icon: Building,
      color: "text-white",
      bgColor: "bg-gray-700",
      href: "/join/ministry",
      badge: null,
      userType: "all"
    },
    {
      id: "post",
      title: "Create Post",
      description: "Share inspirational content, testimonies, or updates with the community",
      icon: PenTool,
      color: "text-white",
      bgColor: "bg-gray-800",
      href: "/feed",
      badge: null,
      userType: "all",
      action: "create-post"
    }
  ];

  // Additional options for creator profiles
  const creatorOnlyOptions: CreateOption[] = [
    {
      id: "share-social",
      title: "Share Social Media Content",
      description: "Import and share content from YouTube, TikTok, and Instagram",
      icon: Share2,
      color: "text-white",
      bgColor: "bg-[#D4AF37]",
      href: "/creators/share",
      badge: "Creator Only",
      userType: "creator",
      action: "social-share"
    }
  ];

  // Additional options for ministry profiles
  const ministryOnlyOptions: CreateOption[] = [
    {
      id: "create-event",
      title: "Create Event",
      description: "Organize community events, church services, and gatherings",
      icon: Users,
      color: "text-white",
      bgColor: "bg-green-600",
      href: "/events/create",
      badge: "Ministry Only",
      userType: "ministry"
    }
  ];

  // Check what profiles user already has
  const hasCreatorProfile = (creatorStatus as any)?.isCreator;
  // /api/business-profiles lists everyone's — only count the one this user owns
  const hasBusinessProfile = Array.isArray(businessProfiles) && businessProfiles.some((p: any) => p.userId === user.id);
  const hasMinistryProfile = ministryProfile && !(ministryProfile as any)?.message;

  // Filter base options based on existing profiles
  const filteredBaseOptions = baseCreateOptions.filter(option => {
    if (option.id === "creator" && hasCreatorProfile) return false;
    if (option.id === "business" && hasBusinessProfile) return false;
    if (option.id === "ministry" && hasMinistryProfile) return false;
    return true;
  });

  // Build final create options based on user profiles
  let createOptions = [...filteredBaseOptions];
  
  // Add creator-specific options
  if (hasCreatorProfile) {
    createOptions = [...createOptions, ...creatorOnlyOptions];
  }
  
  // Add ministry-specific options
  if (hasMinistryProfile) {
    createOptions = [...createOptions, ...ministryOnlyOptions];
  }

  return (
    <>
      <Helmet>
        <title>Create - Christ Collective</title>
        <meta name="description" content="Create campaigns, business profiles, content, and more to share with the Christ Collective community." />
      </Helmet>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="bg-black border-b border-border sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">Create</h1>
              <Sparkles className="h-6 w-6 text-[#D4AF37]" />
            </div>
            <p className="text-gray-300 text-sm mt-1">
              What would you like to create today?
              {hasCreatorProfile && (
                <span className="block text-[#D4AF37] text-xs mt-1">
                  ✨ Creator features unlocked! Share content from your platforms.
                </span>
              )}
              {hasMinistryProfile && (
                <span className="block text-green-400 text-xs mt-1">
                  ⛪ Ministry features unlocked! Create events and organize gatherings.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="grid grid-cols-1 gap-4">
            {createOptions.map((option) => {
              const IconComponent = option.icon;
              const isComingSoon = option.badge === "Coming Soon";
              
              return (
                <Card 
                  key={option.id} 
                  className={`hover:shadow-md transition-all duration-200 bg-black border-gray-600 ${
                    !isComingSoon ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60'
                  }`}
                  onClick={() => {
                    if (!isComingSoon) {
                      if (option.action === "create-post") {
                        // Handle create post action handled by CreatePostModal
                        return; // Let the modal handle the click
                      } else if (option.action === "social-share") {
                        // Handle social share - show platform selection
                        navigate("/creators/share/youtube"); // Default to YouTube for now
                      } else {
                        navigate(option.href);
                      }
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className={`p-3 rounded-lg ${option.bgColor} flex-shrink-0`}>
                        <IconComponent className={`h-6 w-6 ${option.color}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white text-lg">{option.title}</h3>
                          {option.badge && (
                            <Badge 
                              variant={option.badge === "Popular" ? "default" : "secondary"}
                              className={`ml-2 text-xs ${
                                option.badge === "Popular" 
                                  ? "bg-[#D4AF37] text-black hover:bg-[#B8941F]" 
                                  : "bg-gray-700 text-gray-300"
                              }`}
                            >
                              {option.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {option.description}
                        </p>
                        
                        {!isComingSoon && option.action === "create-post" ? (
                          <div className="mt-3">
                            <CreatePostModal 
                              trigger={
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-[#D4AF37] border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
                                  data-testid="button-create-post"
                                >
                                  Get Started
                                </Button>
                              }
                            />
                          </div>
                        ) : !isComingSoon && (
                          <div className="mt-3">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-[#D4AF37] border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
                            >
                              Get Started
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <Card className="mt-8 bg-black border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">Your Creative Impact</CardTitle>
              <CardDescription className="text-gray-400">
                Track what you've created and shared with the community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#D4AF37]">0</div>
                  <div className="text-xs text-gray-400">Campaigns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#D4AF37]">1</div>
                  <div className="text-xs text-gray-400">Profiles</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#D4AF37]">0</div>
                  <div className="text-xs text-gray-400">Events</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}