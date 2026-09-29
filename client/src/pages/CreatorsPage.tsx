import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Users, Play, Calendar } from "lucide-react";
import { Link } from "wouter";
import { ContentCreator } from "@shared/schema";
import instagramIconPath from "@assets/db059a4689b94fbb9a3d0a81e9ae8f52-32bits-32_1750620933253.png";
import tiktokIconPath from "@assets/9e020c743d8609911095831c2a867c84-32bits-32_1753981722521.png";
import youtubeIconPath from "@assets/6ed49f7596c2f434dba2edeb8fb15b54-32bits-32_1753981720269.png";

export default function CreatorsPage() {
  const { data: creators, isLoading } = useQuery<ContentCreator[]>({
    queryKey: ["/api/content-creators"],
    queryFn: async () => {
      const response = await fetch("/api/content-creators?sponsored=true");
      if (!response.ok) throw new Error("Failed to fetch creators");
      return response.json();
    },
  });

  const { data: youtubeVideo, isLoading: isYouTubeLoading } = useQuery({
    queryKey: ["/api/youtube/video", "https://youtu.be/oWN9m7O9BH0?si=xYaLydzt5kTxcR4S"],
    queryFn: async () => {
      const response = await fetch(
        "/api/youtube/video?url=" + encodeURIComponent("https://youtu.be/oWN9m7O9BH0?si=xYaLydzt5kTxcR4S")
      );
      if (!response.ok) throw new Error("Failed to fetch video data");
      return response.json();
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "youtube":   return <img src={youtubeIconPath}   alt="YouTube"   className="w-4 h-4 object-contain" />;
      case "instagram": return <img src={instagramIconPath} alt="Instagram" className="w-4 h-4 object-contain" />;
      case "tiktok":   return <img src={tiktokIconPath}    alt="TikTok"    className="w-4 h-4 object-contain" />;
      case "twitter":  return <span className="text-sm">𝕏</span>;
      default:         return <span className="text-sm">🌐</span>;
    }
  };

  const formatCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000)     return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 pt-14 pb-12 text-center">
          <Badge className="glass-gold text-[#D4AF37] border-0 mb-4 text-xs tracking-widest uppercase px-3 py-1">
            Sponsored Creators
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Creators for{" "}
            <span className="text-[#D4AF37]">Christ</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-base mb-8 leading-relaxed">
            Discover our sponsored creators spreading faith-based messages across platforms.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/join">
              <Button className="bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold px-7">
                Join as a Creator
              </Button>
            </Link>
            <Link href="/sponsorship-application">
              <Button variant="glass">Apply for Sponsorship</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Featured Video ── */}
      {!isYouTubeLoading && youtubeVideo && (
        <div className="max-w-2xl mx-auto px-4 mb-14 animate-fade-up">
          <p className="text-xs text-[#D4AF37] font-semibold uppercase tracking-widest mb-3 text-center">Featured</p>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeVideo.id}`}
                title={youtubeVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-white text-sm leading-snug mb-1">{youtubeVideo.title}</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                {youtubeVideo.viewCount && (
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{parseInt(youtubeVideo.viewCount).toLocaleString()} views</span>
                  </div>
                )}
                {youtubeVideo.publishedAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(youtubeVideo.publishedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Creator Grid ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Featured Creators</h2>
          <p className="text-gray-500 text-sm mt-1">Sharing faith-based content with the community</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 shimmer rounded w-3/4" />
                    <div className="h-3 shimmer rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 shimmer rounded w-full" />
                <div className="h-3 shimmer rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : !creators || creators.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Creators Yet</h3>
            <p className="text-gray-500 text-sm mb-5">We're reviewing applications. Check back soon!</p>
            <Link href="/join">
              <Button className="bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold px-7">Join as a Creator</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creators.map((creator, i) => (
              <div
                key={creator.id}
                className="glass rounded-2xl p-5 flex flex-col gap-4 hover:border-white/15 transition-all duration-300 animate-fade-up press-effect"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Creator header */}
                <div className="flex items-center gap-3">
                  <Avatar className="w-14 h-14 ring-2 ring-[#D4AF37]/30 flex-shrink-0">
                    <AvatarImage src={creator.profileImage || ""} alt={creator.name} />
                    <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] font-bold text-lg">
                      {creator.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-white leading-tight truncate">{creator.name}</p>
                    <Badge className="glass-gold border-0 text-[#D4AF37] text-[10px] px-2 py-0 mt-1 font-semibold">
                      Sponsored
                    </Badge>
                  </div>
                </div>

                {/* Bio */}
                {creator.bio && (
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{creator.bio}</p>
                )}

                {/* Content type + audience */}
                <div className="space-y-1">
                  {creator.content && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Play className="w-3 h-3 text-[#D4AF37] flex-shrink-0" />
                      <span className="truncate">{creator.content}</span>
                    </div>
                  )}
                  {creator.audience && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users className="w-3 h-3 text-[#D4AF37] flex-shrink-0" />
                      <span className="truncate">{creator.audience}</span>
                    </div>
                  )}
                </div>

                {/* Platform chips */}
                {(creator.platforms as any[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(creator.platforms as any[]).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-1"
                      >
                        {getPlatformIcon(p.platform)}
                        <span className="text-[10px] font-medium text-gray-300 capitalize">{p.platform}</span>
                        {p.subscriberCount && (
                          <span className="text-[10px] text-[#D4AF37] font-semibold ml-0.5">
                            {formatCount(p.subscriberCount)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* View profile */}
                <Link href={`/creators/${creator.id}`} className="mt-auto">
                  <Button variant="glass-gold" className="w-full text-xs h-9">
                    View Profile
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
