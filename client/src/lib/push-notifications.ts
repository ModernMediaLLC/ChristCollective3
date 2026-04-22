/**
 * Push notification setup for native iOS/Android.
 * Call registerPushNotifications() once after the user logs in.
 */
import { isNativeApp } from "./platform";
import { buildApiUrl, getMobileAuthHeaders } from "./api-config";

export async function registerPushNotifications(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Request permission first
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.warn("[Push] Permission not granted:", permission.receive);
      return;
    }

    // Set up listeners BEFORE calling register()
    await PushNotifications.addListener("registration", async (token) => {
      console.log("[Push] Device token received, sending to server...");
      try {
        const res = await fetch(buildApiUrl("/api/push-tokens"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getMobileAuthHeaders(),
          },
          body: JSON.stringify({ token: token.value, platform: "ios" }),
        });
        if (res.ok) {
          console.log("[Push] Token registered successfully");
        } else {
          console.error("[Push] Server rejected token:", res.status);
        }
      } catch (e) {
        console.error("[Push] Failed to register token with server:", e);
      }
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] Registration error:", err);
    });

    // Handle foreground notifications
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[Push] Received foreground notification:", notification.title);
    });

    // Handle notification tap (app was opened from a notification)
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data;
      if (data?.type === "like" || data?.type === "comment") {
        if (data.postId) window.location.href = `/post/${data.postId}`;
      } else if (data?.type === "follow") {
        if (data.userId) window.location.href = `/profile/${data.userId}`;
      } else if (data?.type === "word_of_the_day") {
        window.location.href = "/feed";
      }
    });

    // Register AFTER listeners are attached
    await PushNotifications.register();

  } catch (e) {
    console.error("[Push] Setup failed:", e);
  }
}
