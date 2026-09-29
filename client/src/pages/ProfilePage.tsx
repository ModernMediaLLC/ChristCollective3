import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Edit, ArrowLeft, Play, Heart, Eye, Bookmark, Camera, AlignLeft, MoreHorizontal, UserMinus, MapPin, Instagram, BadgeCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlatformPostCard } from "@/components/PlatformPostCard";
import { FollowersModal } from "@/components/FollowersModal";
import { Link, useLocation, useParams } from "wouter";
import { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl, getImageUrl, getMobileAuthHeaders } from "@/lib/api-config";
import instagramLogo from "@/assets/instagram-icon-new.png";
import tiktokLogo from "@assets/9e020c743d8609911095831c2a867c84-32bits-32_1753981722521.png";
import youtubeIconPath from "@assets/6ed49f7596c2f434dba2edeb8fb15b54-32bits-32_1753981720269.png";
import { isNativeApp } from "@/lib/platform";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams();
  const username = params.username;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('bannerImage', file);
      const res = await fetch(buildApiUrl('/api/upload/banner-image'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: getMobileAuthHeaders(),
      });
      if (!res.ok) throw new Error('Upload failed');
      await queryClient.refetchQueries({ queryKey: ['/api/user'] });
      toast({ title: "Photo updated", description: "Your profile photo has been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to upload photo.", variant: "destructive" });
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const isOwnProfile = !username;

  useEffect(() => {
    if (!isLoading && !user && isOwnProfile) {
      const authRoute = isNativeApp() ? "/auth/mobile" : "/auth";
      navigate(`${authRoute}?redirect=/profile`);
    }
  }, [isLoading, user, isOwnProfile, navigate]);

  const { data: fetchedUser, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ["/api/users/by-username", username],
    queryFn: async () => {
      if (!username || username === 'null') throw new Error('Invalid username');
      const response = await fetch(buildApiUrl(`/api/users/by-username?username=${encodeURIComponent(username)}`), {
        credentials: 'include',
        headers: getMobileAuthHeaders(),
      });
      if (!response.ok) throw new Error('User not found');
      return response.json();
    },
    enabled: !!username && username !== 'null',
    retry: false,
  });

  const displayUser = isOwnProfile ? user : fetchedUser;

  const { data: creatorProfile = {} } = useQuery({
    queryKey: isOwnProfile ? ["/api/user/creator-status"] : ["/api/users/creator-status", displayUser?.id],
    enabled: !!displayUser,
  });

  const { data: followingData = [] } = useQuery({
    queryKey: [`/api/users/${displayUser?.id}/following`],
    enabled: !!displayUser?.id,
  });

  const { data: userStats = {} } = useQuery({
    queryKey: [`/api/users/${displayUser?.id}/stats`],
    enabled: !!displayUser?.id,
  });

  const { data: isFollowingData } = useQuery({
    queryKey: [`/api/users/${displayUser?.id}/is-following`],
    queryFn: async () => {
      if (!user || !displayUser?.id || isOwnProfile) return { isFollowing: false };
      const response = await fetch(buildApiUrl(`/api/users/${displayUser.id}/is-following`), {
        credentials: 'include',
        headers: getMobileAuthHeaders(),
      });
      if (!response.ok) return { isFollowing: false };
      return response.json();
    },
    enabled: !!user && !!displayUser?.id && !isOwnProfile,
  });

  const isFollowing = isFollowingData?.isFollowing || false;

  const { data: platformPosts = [], isLoading: platformPostsLoading } = useQuery<any[]>({
    queryKey: ["/api/users", displayUser?.id, "posts"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/users/${displayUser?.id}/posts`), {
        credentials: 'include',
        headers: getMobileAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!displayUser?.id,
  });

  const { data: savedPosts = [], isLoading: savedPostsLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-posts"],
    enabled: isOwnProfile && !!user,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/users/${displayUser?.id}/follow`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to follow user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${displayUser?.id}/is-following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${displayUser?.id}/stats`] });
      toast({ title: "Following!", description: `You are now following ${displayUser?.firstName || displayUser?.username}!` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to follow user.", variant: "destructive" });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/users/${displayUser?.id}/follow`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to unfollow user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${displayUser?.id}/is-following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${displayUser?.id}/stats`] });
      toast({ title: "Unfollowed", description: `You have unfollowed ${displayUser?.firstName || displayUser?.username}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to unfollow user.", variant: "destructive" });
    },
  });

  const handleFollowToggle = () => {
    if (isFollowing) unfollowMutation.mutate();
    else followMutation.mutate();
  };

  const blockUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/users/${displayUser?.id}/block`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to block user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-posts"] });
      toast({ title: "User blocked", description: "You will no longer see content from this user." });
      navigate("/feed");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not block user. Please try again.", variant: "destructive" });
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'youtube': return <img src={youtubeIconPath} alt="YouTube" className="w-6 h-6" />;
      case 'instagram': return <img src={instagramLogo} alt="Instagram" className="w-6 h-6" />;
      case 'tiktok': return <img src={tiktokLogo} alt="TikTok" className="w-6 h-6" />;
      case 'twitter': return <span className="text-2xl">🐦</span>;
      case 'facebook': return <span className="text-2xl">👥</span>;
      case 'linkedin': return <span className="text-2xl">💼</span>;
      case 'twitch': return <span className="text-2xl">🎮</span>;
      default: return <span className="text-2xl">🌐</span>;
    }
  };

  const formatSubscriberCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleBack = () => {
    const currentPath = window.location.pathname;
    window.history.back();
    // If back() had nowhere to go (first page in session), navigate to feed
    setTimeout(() => {
      if (window.location.pathname === currentPath) navigate('/feed');
    }, 150);
  };

  if (isLoading || (isOwnProfile && !user) || (username && userLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (username && (userError || !fetchedUser || username === 'null')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">User Not Found</h1>
          <p className="text-gray-400 mb-6">The profile you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/")} className="bg-[#D4AF37] text-black hover:bg-[#B8941F]">Go Home</Button>
        </div>
      </div>
    );
  }

  const creator = (creatorProfile as any)?.creatorProfile;
  const displayName = displayUser?.displayName
    || (displayUser?.firstName && displayUser?.lastName ? `${displayUser.firstName} ${displayUser.lastName}` : null)
    || displayUser?.username;

  return (
    <>
      <Helmet>
        <title>{displayName ? `${displayName} - Christ Collective` : 'Profile - Christ Collective'}</title>
        <meta name="description" content="Your profile on Christ Collective - connect with the Christian community." />
      </Helmet>

      {/* Hidden photo upload inputs */}
      <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />

      <div className="min-h-screen bg-black text-white pb-20">
      <div className="max-w-[480px] mx-auto">

        {/* ── Banner ── */}
        <div className="relative h-32 bg-gradient-to-br from-gray-800 via-gray-900 to-black overflow-hidden">
          {displayUser?.bannerImageUrl && (
            <img
              src={getImageUrl(displayUser.bannerImageUrl)}
              alt="Profile banner"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          {/* Top bar overlaid on banner */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4 pb-2">
            <button onClick={handleBack} className="text-white bg-black/40 backdrop-blur-sm rounded-full p-1.5">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-[15px] tracking-tight truncate max-w-[60%] text-center text-white drop-shadow">
              {displayUser?.username || displayName}
            </span>
            {isOwnProfile ? (
              <button onClick={() => navigate("/settings")} className="text-white bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                <Settings className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={bannerUploading}
              className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white p-1.5 rounded-full"
            >
              {bannerUploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="px-4">
          {/* ── Avatar + Stats row (avatar overlaps banner) ── */}
          <div className="flex items-end gap-6 -mt-10">
            <div className="relative flex-shrink-0">
              <Avatar className="w-[84px] h-[84px] ring-2 ring-[#D4AF37] border-2 border-black">
                <AvatarImage src={getImageUrl(displayUser?.profileImageUrl || creator?.profileImage)} alt={displayName || ''} />
                <AvatarFallback className="bg-gray-800 text-white text-2xl font-bold">
                  {displayUser?.firstName?.[0] || displayUser?.username?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-1 justify-around text-center">
              <div>
                <p className="text-[17px] font-bold text-white leading-tight">
                  {platformPosts.length || creator?.posts?.length || creator?.totalPosts || 0}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Posts</p>
              </div>
              <button
                onClick={() => { setFollowersModalTab("followers"); setFollowersModalOpen(true); }}
                className="hover:opacity-70 transition-opacity"
              >
                <p className="text-[17px] font-bold text-white leading-tight">
                  {(userStats as any)?.followersCount || creator?.totalFollowers || 0}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Followers</p>
              </button>
              <button
                onClick={() => { setFollowersModalTab("following"); setFollowersModalOpen(true); }}
                className="hover:opacity-70 transition-opacity"
              >
                <p className="text-[17px] font-bold text-white leading-tight">
                  {(userStats as any)?.followingCount || (followingData as any)?.length || 0}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Following</p>
              </button>
            </div>
          </div>

          {/* ── Name / Badge / Bio ── */}
          <div className="mt-3 space-y-1">
            <p className="font-semibold text-[14px] text-white leading-snug">{displayName}</p>
            {(creatorProfile as any)?.isCreator && (
              <div>
                <Badge className="bg-[#D4AF37] text-black text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  Sponsored Creator
                </Badge>
              </div>
            )}
            {(displayUser?.bio || creator?.bio) && (
              <p className="text-[13px] text-gray-200 leading-snug">{displayUser?.bio || creator?.bio}</p>
            )}
            {(creatorProfile as any)?.isCreator && (creator?.content || creator?.audience || creator?.sponsorshipStartDate) && (
              <p className="text-[12px] text-gray-500">
                {creator?.content}
                {creator?.audience && `${creator?.content ? " · " : ""}${creator.audience}`}
                {creator?.sponsorshipStartDate && ` · Sponsored since ${formatDate(creator.sponsorshipStartDate)}`}
              </p>
            )}
          </div>

          {/* ── Community profile (from onboarding) ── */}
          {(displayUser?.city || (displayUser?.disciplines?.length ?? 0) > 0 || displayUser?.instagram || (displayUser?.interests?.length ?? 0) > 0) && (
            <div className="mt-3 space-y-2.5">
              {(displayUser?.disciplines?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {displayUser.disciplines.map((d: string, i: number) => (
                    <span key={i} className="text-[11px] font-medium bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 rounded-full px-2.5 py-0.5">{d}</span>
                  ))}
                </div>
              )}
              {(displayUser?.city || displayUser?.instagram) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-400">
                  {displayUser?.city && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />{displayUser.city}</span>
                  )}
                  {displayUser?.instagram && (
                    <a
                      href={`https://instagram.com/${String(displayUser.instagram).replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-[#D4AF37] transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5 text-[#D4AF37]" />@{String(displayUser.instagram).replace(/^@/, "")}
                      {(displayUser as any).instagramVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#D4AF37]" aria-label="Verified Instagram" />}
                    </a>
                  )}
                </div>
              )}
              {(displayUser?.interests?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {displayUser.interests.map((it: string, i: number) => (
                    <span key={i} className="text-[11px] text-gray-300 bg-gray-800/70 rounded-full px-2.5 py-0.5">{it}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit / complete community profile (own profile only) */}
          {isOwnProfile && (
            <button
              onClick={() => navigate(user?.onboardingCompleted ? "/onboarding?edit=1" : "/onboarding")}
              className="mt-2 text-[12px] text-[#D4AF37] hover:underline inline-flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              {user?.onboardingCompleted ? "Edit community profile" : "Complete your community profile"}
            </button>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex gap-2 mt-4">
            {isOwnProfile ? (
              <button
                onClick={() => navigate("/edit-profile")}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-semibold rounded-lg py-[7px] transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollowToggle}
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                  className={`flex-1 text-[13px] font-semibold rounded-lg py-[7px] transition-colors ${
                    isFollowing
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-[#D4AF37] hover:bg-[#B8941F] text-black'
                  }`}
                >
                  {followMutation.isPending || unfollowMutation.isPending ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={() => {
                    if (!displayUser?.id) return;
                    (async () => {
                      try {
                        const response = await apiRequest('/api/direct-chats', { method: 'POST', data: { recipientId: displayUser.id } });
                        if (response.ok) {
                          const chat = await response.json();
                          navigate(`/direct-chat/${chat.id}`);
                        } else {
                          const errorData = await response.json();
                          toast({ title: "Error", description: errorData.message || "Failed to start chat", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", description: "Failed to start chat. Please try again.", variant: "destructive" });
                      }
                    })();
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-semibold rounded-lg py-[7px] transition-colors"
                >
                  Message
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-2.5 py-[7px] transition-colors flex items-center">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                    <DropdownMenuItem
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 cursor-pointer"
                      onClick={() => blockUserMutation.mutate()}
                      disabled={blockUserMutation.isPending}
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Block User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* ── Platform links (creator highlight circles) ── */}
          {creator?.platforms && (creator.platforms as any[]).length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-1 mt-5 no-scrollbar">
              {(creator.platforms as any[]).map((platform, index) => (
                <button
                  key={index}
                  onClick={() => window.open(platform.profileUrl, '_blank')}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center border border-gray-700">
                    {getPlatformIcon(platform.platform)}
                  </div>
                  <span className="text-[10px] text-gray-400 capitalize w-[60px] text-center truncate">
                    {platform.platform}
                    {platform.subscriberCount ? ` · ${formatSubscriberCount(platform.subscriberCount)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {displayUser?.id && (
            <FollowersModal
              open={followersModalOpen}
              onOpenChange={setFollowersModalOpen}
              userId={displayUser.id}
              initialTab={followersModalTab}
              currentUserId={user?.id}
              displayName={displayUser?.firstName || displayUser?.username}
            />
          )}

        </div>

        {/* ── Instagram-style tab bar (underline, icon-only) ── */}
        <div className="flex border-b border-gray-800 mt-5">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors border-b-2 ${
              activeTab === 'posts' ? 'border-white text-white' : 'border-transparent text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors border-b-2 ${
              activeTab === 'saved' ? 'border-white text-white' : 'border-transparent text-gray-500'
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content grid ── */}
        <div className="mt-0.5">
          {activeTab === 'posts' ? (
            <>
              {platformPostsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37] mx-auto"></div>
                </div>
              ) : platformPosts.length === 0 && (!creator?.posts || creator.posts.length === 0) ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                  {isOwnProfile ? (
                    <>
                      <p className="text-gray-400 text-sm">Your content will appear here once you start sharing.</p>
                      <Button onClick={() => navigate("/create")} className="mt-4 bg-[#D4AF37] text-black hover:bg-[#B8941F]">
                        <Edit className="w-4 h-4 mr-2" />
                        Create Post
                      </Button>
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">No content has been shared yet.</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {platformPosts.map((post: any) => {
                    const firstUrl = post.mediaUrls?.[0] || '';
                    const isBroken = firstUrl.startsWith('blob:') || !firstUrl;
                    const isYoutube = post.mediaType === 'youtube' || post.mediaType === 'youtube_channel';
                    const isVideo = post.mediaType === 'video';
                    const hasMedia = post.mediaUrls && post.mediaUrls.length > 0 && post.mediaType !== 'text' && !isBroken;

                    let thumbUrl: string | null = null;
                    if (isYoutube && firstUrl) {
                      const match = firstUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([^&?\s\/]+)/);
                      if (match?.[1]) thumbUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
                    }

                    const showAsText = !hasMedia || (isYoutube && !thumbUrl);

                    return (
                      <Link
                        key={`platform-${post.id}`}
                        href={`/post/${post.id}`}
                        className="aspect-square overflow-hidden group relative block"
                      >
                        {!showAsText ? (
                          <>
                            <div className="absolute inset-0 bg-gray-900">
                              {isVideo ? (
                                <video
                                  src={getImageUrl(firstUrl)}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  muted
                                  preload="metadata"
                                />
                              ) : isYoutube && thumbUrl ? (
                                <img src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <img src={getImageUrl(firstUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              )}
                            </div>

                            {(isVideo || isYoutube) && (
                              <div className="absolute top-1.5 right-1.5 bg-black/70 rounded-full p-1 z-10">
                                <Play className="w-3 h-3 text-white fill-white" />
                              </div>
                            )}

                            {post.mediaUrls.length > 1 && (
                              <div className="absolute top-1.5 left-1.5 bg-black/70 rounded px-1.5 py-0.5 z-10">
                                <span className="text-[10px] text-white font-medium">+{post.mediaUrls.length - 1}</span>
                              </div>
                            )}

                            {post.content && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pt-5 pb-1.5 z-10">
                                <p className="text-[10px] text-white/90 line-clamp-2 leading-snug">{post.content}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-black border border-gray-800 flex flex-col justify-between p-3">
                            <AlignLeft className="w-3.5 h-3.5 text-[#D4AF37]/60" />
                            <div className="flex-1 flex flex-col justify-center min-h-0">
                              {post.title && (
                                <p className="text-[#D4AF37] text-[11px] font-semibold line-clamp-2 leading-snug mb-1">{post.title}</p>
                              )}
                              <p className="text-gray-200 text-[11px] line-clamp-3 leading-relaxed">{post.content}</p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <div className="flex items-center gap-0.5">
                                <Heart className="w-2.5 h-2.5" />
                                <span>{post.likesCount || 0}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                          <div className="flex items-center gap-3 text-white text-xs">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 fill-white" />
                              <span>{post.likesCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {creator?.posts && creator.posts.length > 0 && creator.posts.map((post: any) => (
                    <button
                      key={`creator-${post.id}`}
                      onClick={() => window.open(post.postUrl, '_blank')}
                      className="aspect-square bg-gray-900 overflow-hidden group relative hover:opacity-75 transition-opacity"
                    >
                      {post.thumbnailUrl ? (
                        <img src={post.thumbnailUrl} alt={post.postTitle || 'Post'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <Play className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex items-center gap-4 text-white text-sm">
                          {post.viewCount && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              <span>{post.viewCount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="px-4 mt-4">
              {!isOwnProfile ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bookmark className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Saved posts are private</h3>
                  <p className="text-gray-400 text-sm">Only you can see your saved posts.</p>
                </div>
              ) : savedPostsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37] mx-auto"></div>
                </div>
              ) : savedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bookmark className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No saved posts</h3>
                  <p className="text-gray-400 text-sm">Tap the bookmark icon on any post to save it here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedPosts.map((post: any) => (
                    <PlatformPostCard
                      key={`saved-${post.id}`}
                      post={post}
                      currentUserId={user?.id}
                      showActions={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
      </div>
    </>
  );
}
