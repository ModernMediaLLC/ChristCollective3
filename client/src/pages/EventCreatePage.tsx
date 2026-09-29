import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useRoute } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Calendar, Save, Upload, X, Image } from "lucide-react";
import { insertMinistryEventSchema } from "@shared/schema";
import { z } from "zod";

const eventFormSchema = insertMinistryEventSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  type: z.string().min(1, "Event type is required"),
  flyerImage: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

function toDatetimeLocal(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect edit mode
  const [editMatch, editParams] = useRoute("/events/:id/edit");
  const isEditMode = editMatch;
  const editEventId = editParams?.id ? parseInt(editParams.id) : null;

  const { data: ministryProfile, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: ["/api/user/ministry-profile"],
  });

  // Load existing event when editing
  const { data: existingEvent, isLoading: isLoadingEvent } = useQuery<any>({
    queryKey: [`/api/events/${editEventId}`],
    enabled: isEditMode && !!editEventId,
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "",
      startDate: "",
      endDate: "",
      location: "",
      address: "",
      maxAttendees: undefined,
      isOnline: false,
      onlineLink: "",
      requiresRegistration: false,
      isPublished: true,
      flyerImage: "",
    },
  });

  // Pre-populate form when existing event loads
  useEffect(() => {
    if (existingEvent) {
      form.reset({
        title: existingEvent.title || "",
        description: existingEvent.description || "",
        type: existingEvent.type || "",
        startDate: toDatetimeLocal(existingEvent.startDate),
        endDate: toDatetimeLocal(existingEvent.endDate),
        location: existingEvent.location || "",
        address: existingEvent.address || "",
        maxAttendees: existingEvent.maxAttendees ?? undefined,
        isOnline: existingEvent.isOnline ?? false,
        onlineLink: existingEvent.onlineLink || "",
        requiresRegistration: existingEvent.requiresRegistration ?? false,
        isPublished: existingEvent.isPublished ?? true,
        flyerImage: existingEvent.flyerImage || "",
      });
      if (existingEvent.flyerImage) {
        setImagePreview(existingEvent.flyerImage);
      }
    }
  }, [existingEvent]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!ministryProfile?.id) throw new Error("No ministry profile found");
      const eventData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        maxAttendees: data.maxAttendees ? Number(data.maxAttendees) : undefined,
        flyerImage: data.flyerImage || undefined,
      };
      return apiRequest(`/api/ministries/${ministryProfile.id}/events`, {
        method: "POST",
        data: eventData,
      });
    },
    onSuccess: () => {
      toast({ title: "Event Created", description: "Your ministry event has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/ministries"] });
      navigate("/profile");
    },
    onError: (error: any) => {
      toast({ title: "Creation Failed", description: error.message || "Failed to create event.", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!ministryProfile?.id) throw new Error("No ministry profile found");
      const eventData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        maxAttendees: data.maxAttendees ? Number(data.maxAttendees) : undefined,
        flyerImage: data.flyerImage || undefined,
      };
      return apiRequest(`/api/ministries/${ministryProfile.id}/events/${editEventId}`, {
        method: "PUT",
        data: eventData,
      });
    },
    onSuccess: () => {
      toast({ title: "Event Updated", description: "Your event has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/ministries"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${editEventId}`] });
      navigate("/profile");
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update event.", variant: "destructive" });
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file type", description: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image smaller than 20MB", variant: "destructive" });
      return;
    }
    try {
      setIsUploadingImage(true);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      form.setValue('flyerImage', result.url);
      toast({ title: "Image uploaded", description: "Your event flyer has been uploaded successfully" });
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload image. Please try again.", variant: "destructive" });
      setImagePreview("");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImagePreview("");
    form.setValue('flyerImage', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = (data: EventFormData) => {
    if (isEditMode) {
      updateEventMutation.mutate(data);
    } else {
      createEventMutation.mutate(data);
    }
  };

  const isPending = createEventMutation.isPending || updateEventMutation.isPending;

  if (isLoadingProfile || (isEditMode && isLoadingEvent)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full border-b-2 border-primary h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!ministryProfile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Ministry Profile Required</h2>
          <p className="text-gray-500 mb-6">You need a ministry profile to create events.</p>
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
        <title>{isEditMode ? "Edit Event" : "Create Event"} - Christ Collective</title>
      </Helmet>

      <div className="min-h-screen bg-black text-white">
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate(isEditMode ? "/profile" : "/create")}
                className="text-white hover:bg-white/10 p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">{isEditMode ? "Edit Event" : "Create Event"}</h1>
              <div className="w-9 h-9" />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Event Details
              </CardTitle>
              <CardDescription className="text-gray-400">
                {isEditMode
                  ? "Update the details for this event."
                  : "Create a new event for your ministry community."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Event Title *</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-gray-800 border-gray-600 text-white"
                            placeholder="Sunday Morning Service, Bible Study, etc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Event Type *</FormLabel>
                        <FormControl>
                          <select {...field} className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2">
                            <option value="">Select event type</option>
                            <option value="service">Service</option>
                            <option value="bible_study">Bible Study</option>
                            <option value="prayer">Prayer Meeting</option>
                            <option value="worship">Worship</option>
                            <option value="mission">Mission</option>
                            <option value="community_event">Community Event</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Description *</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="bg-gray-800 border-gray-600 text-white min-h-[100px]"
                            placeholder="Describe your event, what to expect, and any special instructions..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Event Flyer */}
                  <FormField control={form.control} name="flyerImage" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Event Flyer (Optional)</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          {imagePreview && (
                            <div className="relative inline-block">
                              <img src={imagePreview} alt="Event flyer preview"
                                className="max-w-full h-48 object-cover rounded-lg border border-gray-600" />
                              <Button type="button" variant="destructive" size="sm"
                                className="absolute top-2 right-2" onClick={removeImage}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {!imagePreview && (
                            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-400 mb-2">Click to upload or drag and drop your event flyer</p>
                              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 20MB</p>
                              <Button type="button" variant="outline"
                                className="mt-3 border-gray-600 hover:bg-gray-800"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingImage}>
                                <Image className="h-4 w-4 mr-2" />
                                {isUploadingImage ? "Uploading..." : "Choose Image"}
                              </Button>
                            </div>
                          )}
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Start Date & Time *</FormLabel>
                        <FormControl>
                          <Input {...field} type="datetime-local" className="bg-gray-800 border-gray-600 text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">End Date & Time</FormLabel>
                        <FormControl>
                          <Input {...field} type="datetime-local" className="bg-gray-800 border-gray-600 text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Location */}
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Location</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-gray-800 border-gray-600 text-white"
                          placeholder="Event venue name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Address</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-gray-800 border-gray-600 text-white"
                          placeholder="Street address, City, State" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Max Attendees */}
                  <FormField control={form.control} name="maxAttendees" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Max Attendees</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" className="bg-gray-800 border-gray-600 text-white"
                          placeholder="Leave blank for unlimited" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Submit */}
                  <div className="flex gap-4">
                    <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      {isPending
                        ? (isEditMode ? "Saving..." : "Creating...")
                        : (isEditMode ? "Save Changes" : "Create Event")}
                    </Button>
                    <Button type="button" variant="outline"
                      onClick={() => navigate(isEditMode ? "/profile" : "/create")}
                      className="border-gray-600 hover:bg-gray-800">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
