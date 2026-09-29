import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildApiUrl, getMobileAuthHeaders } from "@/lib/api-config";
import { ArrowLeft, Upload, Save, Building, MapPin, Mail, Phone, Globe, FileText } from "lucide-react";
import { insertMinistryProfileSchema, type InsertMinistryProfile, type MinistryProfile } from "@shared/schema";

type EditMinistryFormData = InsertMinistryProfile;

const denominations = [
  "Anglican",
  "Baptist", 
  "Catholic",
  "Episcopal",
  "Lutheran",
  "Methodist",
  "Non-denominational",
  "Orthodox",
  "Pentecostal",
  "Presbyterian",
  "Reformed",
  "Other"
];

export default function EditMinistryProfilePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  // Get user's ministry profile
  const { data: ministryProfile, isLoading } = useQuery<MinistryProfile>({
    queryKey: ["/api/user/ministry-profile"],
  });

  const form = useForm<EditMinistryFormData>({
    resolver: zodResolver(insertMinistryProfileSchema),
    defaultValues: {
      name: "",
      description: "",
      denomination: "",
      website: "",
      logo: "",
      location: "",
      address: "",
      phone: "",
      email: "",
      socialLinks: {},
    },
  });

  // Update form when ministry profile loads
  useEffect(() => {
    if (ministryProfile) {
      console.log("Loading ministry profile data:", ministryProfile);
      const formData = {
        name: ministryProfile.name || "",
        description: ministryProfile.description || "",
        denomination: ministryProfile.denomination || "",
        website: ministryProfile.website || "",
        logo: ministryProfile.logo || "",
        location: ministryProfile.location || "",
        address: ministryProfile.address || "",
        phone: ministryProfile.phone || "",
        email: ministryProfile.email || "",
        socialLinks: ministryProfile.socialLinks || {},
      } as EditMinistryFormData;
      console.log("Form data being set:", formData);
      form.reset(formData);
    }
  }, [ministryProfile, form]);

  const updateMinistryMutation = useMutation({
    mutationFn: async (data: EditMinistryFormData) => {
      if (!ministryProfile?.id) throw new Error("No ministry profile found");
      return apiRequest(`/api/ministries/${ministryProfile.id}`, {
        method: "PUT",
        data: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Ministry Profile Updated",
        description: "Your ministry profile has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ministry-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ministries"] });
      navigate("/profile");
    },
    onError: (error: any) => {
      console.error("Ministry update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update ministry profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(buildApiUrl("/api/upload"), {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: getMobileAuthHeaders(),
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      form.setValue("logo", data.url as string);
      
      toast({
        title: "Logo Uploaded",
        description: "Ministry logo uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (data: EditMinistryFormData) => {
    console.log("Form submission data:", data);
    console.log("Ministry profile ID:", ministryProfile?.id);
    console.log("Form errors:", form.formState.errors);
    updateMinistryMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full border-b-2 border-primary h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading ministry profile...</p>
        </div>
      </div>
    );
  }

  if (!ministryProfile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Building className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">No Ministry Profile Found</h2>
          <p className="text-gray-500 mb-6">You don't have a ministry profile yet.</p>
          <Button onClick={() => navigate("/join/ministry")} className="bg-primary hover:bg-primary/90">
            Create Ministry Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Edit Ministry Profile - Christ Collective</title>
        <meta name="description" content="Edit your ministry profile on Christ Collective." />
      </Helmet>
      
      <div className="min-h-screen bg-black text-white">
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
              <h1 className="text-lg font-semibold">Edit Ministry Profile</h1>
              <div className="w-9 h-9"></div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[480px] mx-auto px-4 py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Logo Upload */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-700">
                      {form.watch("logo") ? (
                        <img src={form.watch("logo") || ""} alt="Ministry logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building className="w-7 h-7 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white mb-1">Ministry Logo</p>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" disabled={isUploading} />
                      <label htmlFor="logo-upload" className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#B8941F] cursor-pointer font-medium transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        {isUploading ? "Uploading..." : "Upload logo"}
                      </label>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Ministry Name *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white" placeholder="Enter ministry name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="denomination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Denomination</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                              <SelectValue placeholder="Select denomination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {denominations.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Location</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white" placeholder="City, State" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Website</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white" placeholder="https://yourministry.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Contact Email *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" className="bg-gray-900 border-gray-700 text-white" placeholder="contact@ministry.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Phone Number *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white" placeholder="(555) 123-4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Address *</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white min-h-[80px]" placeholder="Street, city, state, ZIP" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Ministry Description *</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="bg-gray-900 border-gray-700 text-white min-h-[120px]" placeholder="Describe your ministry, mission, and activities..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={updateMinistryMutation.isPending}
                      className="flex-1 bg-[#D4AF37] hover:bg-[#B8941F] text-black font-semibold"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateMinistryMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate("/profile")}
                      className="text-gray-400 hover:text-white hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                  </div>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}