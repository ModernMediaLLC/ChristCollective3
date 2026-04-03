import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getProfileImageUrl } from "@/lib/api-config";
import { useLocation } from "wouter";
import {
  Bell,
  Heart,
  ChatCircle,
  UserPlus,
  CalendarCheck,
  Gift,
  Church,
  X,
  Checks,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  isRead: boolean;
  createdAt: string;
  actorName?: string;
  actorImage?: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  like:            { icon: Heart,         color: "text-red-400",    bg: "bg-red-500" },
  comment:         { icon: ChatCircle,    color: "text-blue-400",   bg: "bg-blue-500" },
  follow:          { icon: UserPlus,      color: "text-green-400",  bg: "bg-green-500" },
  rsvp:            { icon: CalendarCheck, color: "text-purple-400", bg: "bg-purple-500" },
  campaign_update: { icon: Gift,          color: "text-orange-400", bg: "bg-orange-500" },
  ministry_post:   { icon: Church,        color: "text-[#D4AF37]",  bg: "bg-[#D4AF37]" },
  chat_message:    { icon: ChatCircle,    color: "text-[#D4AF37]",  bg: "bg-[#D4AF37]" },
};

const getNotificationUrl = (notification: Notification): string | null => {
  const { type, relatedId, relatedType } = notification;
  if (!relatedId) return null;
  switch (type) {
    case 'like':
    case 'comment':
    case 'post':
      return `/post/${relatedId}`;
    case 'follow':
      return `/profile/${relatedId}`;
    case 'chat_message':
      return relatedType === 'direct' ? `/direct-chat/${relatedId}` : `/chat/${relatedId}`;
    case 'rsvp':
    case 'campaign_update':
      return `/campaigns/${relatedId}`;
    case 'ministry_post':
      return `/ministries/${relatedId}`;
    default:
      return null;
  }
};

export function NotificationsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  };

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: invalidateNotifications,
    onError: (err) => console.error("[Notifications] markAsRead failed:", err),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/notifications/mark-all-read", { method: "PATCH" });
      if (!res.ok) throw new Error(`mark-all-read failed: ${res.status}`);
    },
    onSuccess: () => {
      // Immediately zero out the badge without waiting for refetch
      queryClient.setQueryData(["/api/notifications/unread-count"], { count: 0 });
      invalidateNotifications();
    },
    onError: (err) => console.error("[Notifications] markAllAsRead failed:", err),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/notifications/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidateNotifications,
    onError: () => toast({ title: "Failed to delete notification", variant: "destructive" }),
  });

  // Auto-mark all as read when notifications panel opens
  useEffect(() => {
    if (notifications.some((n) => !n.isRead)) {
      markAllAsReadMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length, isLoading]);

  const createTestNotificationsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/notifications/test-all", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Test notifications created!" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-gray-800 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-gray-800 rounded w-3/4" />
              <div className="h-3 bg-gray-800 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unreadNotifications = notifications.filter((n) => !n.isRead);

  return (
    <div>
      {/* Header actions */}
      <div className="flex items-center justify-between px-4 pb-3">
        {unreadNotifications.length > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#B8941F] font-medium transition-colors"
          >
            <Checks size={14} weight="bold" />
            Mark all read
          </button>
        )}
        {user?.isAdmin && (
          <button
            onClick={() => createTestNotificationsMutation.mutate()}
            disabled={createTestNotificationsMutation.isPending}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto"
          >
            Test notifications
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-4">
            <Bell size={28} weight="thin" className="text-gray-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-300 mb-1">No notifications yet</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            You'll see likes, comments, follows, and updates here.
          </p>
        </div>
      ) : (
        <div>
          {notifications.map((notification: Notification) => {
            const cfg = typeConfig[notification.type] ?? { icon: Bell, color: "text-gray-400", bg: "bg-gray-600" };
            const TypeIcon = cfg.icon;

            return (
              <div
                key={notification.id}
                onClick={() => {
                  if (!notification.isRead) markAsReadMutation.mutate(notification.id);
                  const url = getNotificationUrl(notification);
                  if (url) navigate(url);
                }}
                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 transition-colors ${
                  getNotificationUrl(notification) ? "cursor-pointer" : "cursor-default"
                } ${!notification.isRead ? "bg-gray-900/60" : "hover:bg-gray-900/20"}`}
              >
                {/* Avatar with type badge */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center relative overflow-hidden">
                    <span className="text-base font-semibold text-gray-400 select-none">
                      {(notification.actorName || "?").charAt(0).toUpperCase()}
                    </span>
                    {notification.actorImage && (
                      <img
                        src={getProfileImageUrl(notification.actorImage, 88)}
                        alt={notification.actorName || "User"}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${cfg.bg} flex items-center justify-center border-2 border-black`}>
                    <TypeIcon size={10} weight="fill" color="white" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">
                    {notification.actorName && (
                      <span className="font-semibold text-white">{notification.actorName} </span>
                    )}
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Right: unread dot + delete */}
                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                  {!notification.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotificationMutation.mutate(notification.id);
                    }}
                    className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}