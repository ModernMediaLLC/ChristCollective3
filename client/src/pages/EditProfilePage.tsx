import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Briefcase, Church, Edit, Save, Plus, Eye, EyeOff, ExternalLink, Play, Upload, X } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl, getImageUrl, getMobileAuthHeaders } from "@/lib/api-config";
import { getUserDisplayName, getUserInitials } from "@/lib/user-display";

// Post Management Component
function PostManagementSection({ creatorProfile, queryClient, toast }: any) {
  const { data: allPosts, refetch } = useQuery({
    queryKey: [`/api/social-media-posts/creator/${creatorProfile.id}`],
    enabled: !!creatorProfile.id,
  });

  const updatePostVisibility = useMutation({
    mutationFn: async ({ postId, isVisible }: { postId: number; isVisible: boolean }) => {
      const response = await fetch(`/api/social-media-posts/${postId}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isVisibleOnProfile: isVisible }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update post visibility: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Post visibility updated successfully!" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/user/creator-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating post visibility",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleVisibility = (postId: number, currentVisibility: boolean) => {
    updatePostVisibility.mutate({ 
      postId, 
      isVisible: !currentVisibility 
    });
  };

  const posts = allPosts || creatorProfile.posts || [];

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Edit className="w-5 h-5" />
          Manage Your Posts
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Control which posts from your linked social media accounts appear on your profile.
        </p>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <Play className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Posts Found</h3>
            <p className="text-gray-400">
              Posts from your linked social media accounts will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: any) => (
              <div 
                key={post.id} 
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  post.isVisibleOnProfile !== false
                    ? 'bg-gray-800 border-gray-600' 
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                {/* Post Thumbnail */}
                <div className="flex-shrink-0">
                  {post.thumbnailUrl ? (
                    <img 
                      src={post.thumbnailUrl} 
                      alt={post.postTitle || 'Post thumbnail'}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                      <Play className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Post Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">
                    {post.postTitle || 'Untitled Post'}
                  </h4>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {post.postDescription || 'No description available'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="capitalize">{post.platform}</span>
                    {post.viewCount && <span>{post.viewCount.toLocaleString()} views</span>}
                    {post.likeCount && <span>{post.likeCount.toLocaleString()} likes</span>}
                    {post.postedAt && (
                      <span>{new Date(post.postedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(post.postUrl, '_blank')}
                    className="text-gray-400 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleVisibility(post.id, post.isVisibleOnProfile !== false)}
                    disabled={updatePostVisibility.isPending}
                    className={`${
                      post.isVisibleOnProfile !== false
                        ? 'text-green-400 hover:text-green-300' 
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {post.isVisibleOnProfile !== false ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Import form components
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schemas
const creatorProfileSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  audience: z.string().optional(),
  bio: z.string().optional(),
  youtubeUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  profileImage: z.string().optional(),
});

const businessProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  industry: z.string().min(1, "Industry is required"),
  description: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  employeeCount: z.string().optional(),
  foundedYear: z.string().optional(),
  profileImage: z.string().optional(),
});

const basicProfileSchema = z.object({
  displayName: z.string().optional(),
  username: z.string().min(1, "Username is required"),
  bio: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export default function EditProfilePage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [businessLogoUploading, setBusinessLogoUploading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [isLoading, user, navigate]);

  // Fetch user profiles
  const { data: creatorStatus } = useQuery({
    queryKey: ["/api/user/creator-status"],
    enabled: !!user,
  });

  const { data: businessProfiles } = useQuery({
    queryKey: ["/api/business-profiles"],
    enabled: !!user,
  });

  const userBusinessProfile = Array.isArray(businessProfiles) ? 
    businessProfiles.find((profile: any) => profile.userId === user?.id) : null;

  // Creator form
  const creatorForm = useForm({
    resolver: zodResolver(creatorProfileSchema),
    defaultValues: {
      name: creatorStatus?.creatorProfile?.name || "",
      content: creatorStatus?.creatorProfile?.content || "",
      audience: creatorStatus?.creatorProfile?.audience || "",
      bio: creatorStatus?.creatorProfile?.bio || "",
      youtubeUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      linkedinUrl: "",
      profileImage: creatorStatus?.creatorProfile?.profileImage || "",
    },
  });

  // Business form
  const businessForm = useForm({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      companyName: userBusinessProfile?.companyName || "",
      industry: userBusinessProfile?.industry || "",
      description: userBusinessProfile?.description || "",
      website: userBusinessProfile?.website || "",
      location: userBusinessProfile?.location || "",
      employeeCount: userBusinessProfile?.employeeCount || "",
      foundedYear: userBusinessProfile?.foundedYear || "",
      profileImage: userBusinessProfile?.profileImage || "",
    },
  });

  // Basic profile form for all users
  const basicProfileForm = useForm({
    resolver: zodResolver(basicProfileSchema),
    defaultValues: {
      displayName: user?.displayName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
      username: user?.username || "",
      bio: user?.bio || "",
      profileImageUrl: user?.profileImageUrl || "",
    },
  });

  // Update form defaults when data loads
  useEffect(() => {
    if (creatorStatus?.creatorProfile) {
      const creator = creatorStatus.creatorProfile;
      const platforms = creator.platforms || [];
      
      // Extract platform URLs
      const youtubeUrl = platforms.find((p: any) => p.platform === 'youtube')?.profileUrl || "";
      const instagramUrl = platforms.find((p: any) => p.platform === 'instagram')?.profileUrl || "";
      const tiktokUrl = platforms.find((p: any) => p.platform === 'tiktok')?.profileUrl || "";
      const twitterUrl = platforms.find((p: any) => p.platform === 'twitter')?.profileUrl || "";
      const facebookUrl = platforms.find((p: any) => p.platform === 'facebook')?.profileUrl || "";
      const linkedinUrl = platforms.find((p: any) => p.platform === 'linkedin')?.profileUrl || "";
      
      creatorForm.reset({
        name: creator.name || "",
        content: creator.content || "",
        audience: creator.audience || "",
        bio: creator.bio || "",
        youtubeUrl,
        instagramUrl,
        tiktokUrl,
        twitterUrl,
        facebookUrl,
        linkedinUrl,
        profileImage: creator.profileImage || "",
      });
    }
  }, [creatorStatus, creatorForm]);

  useEffect(() => {
    if (userBusinessProfile) {
      businessForm.reset({
        companyName: userBusinessProfile.companyName || "",
        industry: userBusinessProfile.industry || "",
        description: userBusinessProfile.description || "",
        website: userBusinessProfile.website || "",
        location: userBusinessProfile.location || "",
        employeeCount: userBusinessProfile.employeeCount || "",
        foundedYear: userBusinessProfile.foundedYear || "",
        profileImage: userBusinessProfile.profileImage || "",
      });
    }
  }, [userBusinessProfile, businessForm]);

  useEffect(() => {
    if (user) {
      basicProfileForm.reset({
        displayName: user.displayName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
        username: user.username || "",
        bio: user.bio || "",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user, basicProfileForm]);

  // Mutations
  const updateCreatorMutation = useMutation({
    mutationFn: async (data: any) => {
      const platforms = [];
      if (data.youtubeUrl) platforms.push({ platform: "youtube", profileUrl: data.youtubeUrl });
      if (data.instagramUrl) platforms.push({ platform: "instagram", profileUrl: data.instagramUrl });
      if (data.tiktokUrl) platforms.push({ platform: "tiktok", profileUrl: data.tiktokUrl });
      if (data.twitterUrl) platforms.push({ platform: "twitter", profileUrl: data.twitterUrl });
      if (data.facebookUrl) platforms.push({ platform: "facebook", profileUrl: data.facebookUrl });
      if (data.linkedinUrl) platforms.push({ platform: "linkedin", profileUrl: data.linkedinUrl });

      const { youtubeUrl, instagramUrl, tiktokUrl, twitterUrl, facebookUrl, linkedinUrl, ...profileData } = data;
      
      if (creatorStatus?.creatorProfile?.id) {
        const response = await fetch(`/api/content-creators/${creatorStatus.creatorProfile.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...profileData, platforms }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update creator profile: ${response.statusText}`);
        }
        
        return response.json();
      } else {
        const response = await fetch("/api/content-creators", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...profileData, platforms }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create creator profile: ${response.statusText}`);
        }
        
        return response.json();
      }
    },
    onSuccess: () => {
      toast({ title: "Creator profile updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/creator-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating creator profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: any) => {
      if (userBusinessProfile?.id) {
        const response = await fetch(`/api/business-profiles/${userBusinessProfile.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update business profile: ${response.statusText}`);
        }
        
        return response.json();
      } else {
        const response = await fetch("/api/business-profiles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create business profile: ${response.statusText}`);
        }
        
        return response.json();
      }
    },
    onSuccess: () => {
      toast({ title: "Business profile updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/business-profiles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating business profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: async () => {
      if (!userBusinessProfile?.id) {
        throw new Error("No business profile to delete");
      }
      
      const response = await fetch(`/api/business-profiles/${userBusinessProfile.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete business profile: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Business profile deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/business-profiles"] });
      // Reset the business form
      businessForm.reset({
        companyName: "",
        industry: "",
        description: "",
        website: "",
        location: "",
        employeeCount: "",
        foundedYear: "",
        profileImage: "",
      });
      // Switch back to overview tab
      setActiveTab("overview");
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting business profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBusinessLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusinessLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(buildApiUrl("/api/upload/business-logo"), {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: getMobileAuthHeaders(),
      });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/business-profiles"] });
      toast({ title: "Logo updated", description: "Business logo uploaded successfully." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo. Please try again.", variant: "destructive" });
    } finally {
      setBusinessLogoUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const onCreatorSubmit = (data: any) => {
    updateCreatorMutation.mutate(data);
  };

  const onBusinessSubmit = (data: any) => {
    updateBusinessMutation.mutate(data);
  };

  const updateBasicProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      // If there's a selected profile image, upload it first
      let profileImageUrl = data.profileImageUrl;
      
      if (selectedProfileImage) {
        console.log("Uploading profile image...");
        const formData = new FormData();
        formData.append('profileImage', selectedProfileImage);

        const uploadResponse = await fetch(buildApiUrl('/api/upload/profile-image'), {
          method: 'POST',
          credentials: 'include',
          headers: getMobileAuthHeaders(),
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error("Upload error details:", errorData);
          throw new Error(errorData.message || 'Failed to upload profile image');
        }
        
        const uploadResult = await uploadResponse.json();
        console.log("Upload successful, URL:", uploadResult.url);
        profileImageUrl = uploadResult.url;
      }
      
      console.log("Sending profile update request...");
      const updatePayload: Record<string, any> = {};
      if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
      if (data.username !== undefined) updatePayload.username = data.username;
      if (data.bio !== undefined) updatePayload.bio = data.bio;
      if (profileImageUrl !== undefined) updatePayload.profileImageUrl = profileImageUrl;
      if (data.firstName !== undefined) updatePayload.firstName = data.firstName;
      if (data.lastName !== undefined) updatePayload.lastName = data.lastName;
      if (data.location !== undefined) updatePayload.location = data.location;
      if (data.phone !== undefined) updatePayload.phone = data.phone;
      if (data.showEmail !== undefined) updatePayload.showEmail = !!data.showEmail;
      if (data.showPhone !== undefined) updatePayload.showPhone = !!data.showPhone;
      if (data.showLocation !== undefined) updatePayload.showLocation = !!data.showLocation;

      const response = await fetch(buildApiUrl('/api/user/profile'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getMobileAuthHeaders(),
        },
        body: JSON.stringify(updatePayload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.field === 'username') {
          throw new Error('Username already taken. Please choose a different username.');
        }
        throw new Error(errorData.message || 'Failed to update profile');
      }
      
      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({ title: "Profile updated successfully!" });
      // Invalidate both user and specific profile routes to ensure consistency
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (updatedUser.username) {
        queryClient.invalidateQueries({ queryKey: ["/api/users/by-username", updatedUser.username] });
      }
      if (updatedUser.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users/by-id", updatedUser.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore"] });
      // Clear the selected profile image after successful update
      setSelectedProfileImage(null);
      setProfileImagePreview("");
    },
    onError: (error: any) => {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onBasicProfileSubmit = (data: any) => {
    console.log("Submitting profile update with image:", !!selectedProfileImage);
    updateBasicProfileMutation.mutate(data);
  };

  // Handle profile image selection
  const handleProfileImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name, file.type, file.size);
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string);
        console.log("Profile image preview set");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfileImage = () => {
    setSelectedProfileImage(null);
    setProfileImagePreview("");
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasCreatorProfile = creatorStatus?.isCreator || false;
  const hasBusinessProfile = !!userBusinessProfile;
  


  return (
    <>
      <Helmet>
        <title>Edit Profile - Christ Collective</title>
        <meta name="description" content="Edit your profile settings and manage your creator, business, and ministry profiles." />
      </Helmet>
      <div className="min-h-screen bg-black text-white pb-20">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-[480px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/profile")}
                className="text-white hover:bg-white/10 p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Edit Profile</h1>
              <div className="w-9" /> {/* Spacer */}
            </div>
          </div>
        </div>

        <div className="max-w-[480px] mx-auto px-4 py-6">
          {/* Profile Overview */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-16 h-16 ring-2 ring-gray-700">
                <AvatarImage src={user.profileImageUrl || ''} alt={user.firstName || user.username || ''} />
                <AvatarFallback className="bg-gray-800 text-white text-lg font-bold">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">
                  {getUserDisplayName(user)}
                </h2>
                <p className="text-gray-400 text-sm">@{user.username}</p>
                <div className="flex gap-2 mt-1">
                  {hasCreatorProfile && (
                    <Badge className="bg-[#D4AF37] text-black text-xs">Creator</Badge>
                  )}
                  {hasBusinessProfile && (
                    <Badge className="bg-[#D4AF37] text-black text-xs">Business</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full overflow-x-auto bg-gray-900 gap-0 h-auto p-1 no-scrollbar">
              <TabsTrigger value="overview" className="flex-shrink-0 text-xs px-3 py-2">Overview</TabsTrigger>
              <TabsTrigger value="profile" className="flex-shrink-0 text-xs px-3 py-2">Profile</TabsTrigger>
              <TabsTrigger value="creator" className="flex-shrink-0 text-xs px-3 py-2">Creator</TabsTrigger>
              <TabsTrigger value="posts" className="flex-shrink-0 text-xs px-3 py-2">Posts</TabsTrigger>
              <TabsTrigger value="business" className="flex-shrink-0 text-xs px-3 py-2">Business</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Username</label>
                    <p className="text-white">{user.username}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300">Email</label>
                    <p className="text-white">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Bio</label>
                    <p className="text-white">{user.bio || "Not set"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Profile Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Edit className="w-5 h-5 text-[#D4AF37]" />
                        <div>
                          <h3 className="font-medium text-white">Content Creator</h3>
                          <p className="text-sm text-gray-400">Share your faith-based content</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasCreatorProfile ? (
                          <>
                            <Button 
                              onClick={() => setActiveTab("creator")}
                              variant="outline" 
                              size="sm"
                              className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Update Creator Profile
                            </Button>
                            <Button 
                              onClick={() => {
                                // TODO: Add delete creator profile functionality
                                toast({
                                  title: "Delete Creator Profile",
                                  description: "This feature will be available soon",
                                });
                              }}
                              variant="outline" 
                              size="sm"
                              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={() => setActiveTab("creator")}
                            variant="outline" 
                            size="sm"
                            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Creator Profile
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-blue-500" />
                        <div>
                          <h3 className="font-medium text-white">Business Profile</h3>
                          <p className="text-sm text-gray-400">Connect with Christian professionals</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasBusinessProfile ? (
                          <>
                            <Button 
                              onClick={() => setActiveTab("business")}
                              variant="outline" 
                              size="sm"
                              className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Update Business Profile
                            </Button>
                            <Button 
                              onClick={() => {
                                if (confirm("Are you sure you want to delete your business profile? This action cannot be undone.")) {
                                  deleteBusinessMutation.mutate();
                                }
                              }}
                              variant="outline" 
                              size="sm"
                              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                              disabled={deleteBusinessMutation.isPending}
                            >
                              {deleteBusinessMutation.isPending ? (
                                <div className="animate-spin w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <X className="w-4 h-4 mr-1" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={() => setActiveTab("business")}
                            variant="outline" 
                            size="sm"
                            className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Business Profile
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Basic Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Edit className="w-5 h-5" />
                    Edit Basic Profile
                  </CardTitle>
                  <p className="text-gray-400 text-sm">
                    Update your display name, bio, and profile picture that everyone can see.
                  </p>
                </CardHeader>
                <CardContent>
                  <Form {...basicProfileForm}>
                    <form onSubmit={basicProfileForm.handleSubmit(onBasicProfileSubmit)} className="space-y-4">
                      <FormField
                        control={basicProfileForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Your display name"
                              />
                            </FormControl>
                            <p className="text-xs text-gray-500">This is the name shown on your profile and posts.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={basicProfileForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Username</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Enter your username"
                              />
                            </FormControl>
                            <p className="text-xs text-gray-500">Your @tag that others use to mention you.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={basicProfileForm.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Bio</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Tell others about yourself..."
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Profile Picture Upload */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Profile Picture</label>
                        
                        {/* Current/Preview Image */}
                        <div className="flex items-center gap-4">
                          <Avatar className="w-16 h-16 ring-2 ring-gray-700">
                            <AvatarImage 
                              src={profileImagePreview || user?.profileImageUrl || ''} 
                              alt="Profile preview" 
                            />
                            <AvatarFallback className="bg-gray-800 text-white text-lg font-bold">
                              {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1">
                            {selectedProfileImage ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-300">{selectedProfileImage.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={removeProfileImage}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">
                                {user?.profileImageUrl ? "Current profile picture" : "No profile picture set"}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Upload Button */}
                        <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                          <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-400 mb-2">
                            Click to upload a new profile picture
                          </p>
                          <p className="text-xs text-gray-500 mb-3">
                            PNG, JPG up to 5MB
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfileImageSelect}
                            className="hidden"
                            id="profile-image-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-800"
                            onClick={() => document.getElementById('profile-image-upload')?.click()}
                          >
                            Choose File
                          </Button>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-[#D4AF37] text-black hover:bg-[#B8941F]"
                        disabled={updateBasicProfileMutation.isPending}
                      >
                        {updateBasicProfileMutation.isPending ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Profile
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Creator Profile Tab */}
            <TabsContent value="creator" className="space-y-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Edit className="w-5 h-5" />
                    {hasCreatorProfile ? "Edit Creator Profile" : "Create Creator Profile"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...creatorForm}>
                    <form onSubmit={creatorForm.handleSubmit(onCreatorSubmit)} className="space-y-4">
                      <FormField
                        control={creatorForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Creator Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Your creator name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={creatorForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Content Type</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-600 text-white"
                                  placeholder="e.g., Biblical Education"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={creatorForm.control}
                          name="audience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Target Audience</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-600 text-white"
                                  placeholder="e.g., Young Adults"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={creatorForm.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Bio</FormLabel>
                            <FormControl>
                              <textarea 
                                {...field} 
                                className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                placeholder="Tell us about yourself and your mission"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Social Media URLs */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-white">Social Media Links</h4>
                        <div className="grid gap-3">
                          <FormField
                            control={creatorForm.control}
                            name="youtubeUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">YouTube</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className="bg-gray-800 border-gray-600 text-white"
                                    placeholder="https://youtube.com/@username"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={creatorForm.control}
                            name="instagramUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">Instagram</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className="bg-gray-800 border-gray-600 text-white"
                                    placeholder="https://instagram.com/username"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={creatorForm.control}
                            name="tiktokUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">TikTok</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className="bg-gray-800 border-gray-600 text-white"
                                    placeholder="https://tiktok.com/@username"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-[#D4AF37] text-black hover:bg-[#B8941F]"
                        disabled={updateCreatorMutation.isPending}
                      >
                        {updateCreatorMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                            Saving...
                          </div>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            {hasCreatorProfile ? "Update Creator Profile" : "Create Creator Profile"}
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Post Management Tab */}
            <TabsContent value="posts" className="space-y-4">
              {hasCreatorProfile && creatorStatus?.creatorProfile ? (
                <PostManagementSection 
                  creatorProfile={creatorStatus.creatorProfile} 
                  queryClient={queryClient}
                  toast={toast}
                />
              ) : (
                <Card className="bg-gray-900 border-gray-700">
                  <CardContent className="text-center py-8">
                    <Edit className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No Creator Profile</h3>
                    <p className="text-gray-400 mb-4">
                      Create a creator profile first to manage your posts.
                    </p>
                    <Button 
                      onClick={() => setActiveTab("creator")}
                      className="bg-[#D4AF37] text-black hover:bg-[#B8941F]"
                    >
                      Create Creator Profile
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Business Profile Tab */}
            <TabsContent value="business" className="space-y-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    {hasBusinessProfile ? "Edit Business Profile" : "Create Business Profile"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...businessForm}>
                    <form onSubmit={businessForm.handleSubmit(onBusinessSubmit)} className="space-y-4">

                      {/* Business Logo Upload */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-700">
                          {userBusinessProfile?.logo ? (
                            <img src={getImageUrl(userBusinessProfile.logo)} alt="Business logo" className="w-full h-full object-cover" />
                          ) : (
                            <Briefcase className="w-7 h-7 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white mb-1">Business Logo</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBusinessLogoUpload}
                            className="hidden"
                            id="business-logo-upload"
                            disabled={businessLogoUploading}
                          />
                          <label htmlFor="business-logo-upload" className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#B8941F] cursor-pointer font-medium transition-colors">
                            <Upload className="h-3.5 w-3.5" />
                            {businessLogoUploading ? "Uploading..." : "Upload logo"}
                          </label>
                        </div>
                      </div>

                      <FormField
                        control={businessForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Company Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Your company name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={businessForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Industry</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-gray-800 border-gray-600">
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="consulting">Consulting</SelectItem>
                                <SelectItem value="ministry">Ministry</SelectItem>
                                <SelectItem value="nonprofit">Non-Profit</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={businessForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Company Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="bg-gray-800 border-gray-600 text-white"
                                placeholder="Describe your company and mission..."
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={businessForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Website</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-600 text-white"
                                  placeholder="https://yourcompany.com"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={businessForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Location</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-600 text-white"
                                  placeholder="City, State"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={businessForm.control}
                          name="employeeCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Employee Count</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                                    <SelectValue placeholder="Select size" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-gray-800 border-gray-600">
                                  <SelectItem value="1">Just me</SelectItem>
                                  <SelectItem value="2-10">2-10 employees</SelectItem>
                                  <SelectItem value="11-50">11-50 employees</SelectItem>
                                  <SelectItem value="51-200">51-200 employees</SelectItem>
                                  <SelectItem value="201-500">201-500 employees</SelectItem>
                                  <SelectItem value="500+">500+ employees</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={businessForm.control}
                          name="foundedYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Founded Year</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-600 text-white"
                                  placeholder="2020"
                                  type="number"
                                  min="1900"
                                  max={new Date().getFullYear()}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          type="submit" 
                          className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                          disabled={updateBusinessMutation.isPending}
                        >
                          {updateBusinessMutation.isPending ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                              Saving...
                            </div>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              {hasBusinessProfile ? "Update Business Profile" : "Create Business Profile"}
                            </>
                          )}
                        </Button>
                        
                        {hasBusinessProfile && (
                          <Button 
                            type="button"
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            disabled={deleteBusinessMutation.isPending}
                            onClick={() => {
                              if (confirm("Are you sure you want to delete your business profile? This action cannot be undone.")) {
                                deleteBusinessMutation.mutate();
                              }
                            }}
                          >
                            {deleteBusinessMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full" />
                                Deleting...
                              </div>
                            ) : (
                              <>
                                <X className="w-4 h-4 mr-2" />
                                Delete Profile
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}