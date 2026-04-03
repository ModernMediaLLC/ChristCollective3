import React, { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "../lib/queryClient";
import { useToast } from "./use-toast";
import { isNativeApp } from "@/lib/platform";
import { secureSet, secureGet, secureRemove } from "@/lib/secure-storage";
import { registerPushNotifications } from "@/lib/push-notifications";

import { User } from "@shared/schema";

type RegisterResponse = {
  message: string;
  requiresVerification: boolean;
  email: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<RegisterResponse, Error, RegisterData>;
};

type LoginData = {
  usernameOrEmail: string;
  password: string;
};

type RegisterData = {
  username: string;
  email?: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // On native: when app resumes from background, re-sync sessionId from
  // persistent Preferences storage into localStorage (in case iOS cleared it)
  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          const stored = await secureGet("sessionId");
          if (stored && localStorage.getItem("sessionId") !== stored) {
            localStorage.setItem("sessionId", stored);
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          }
        }
      }).then((handle) => {
        cleanup = () => handle.remove();
      });
    });
    return () => cleanup?.();
  }, []);

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Register push token whenever the user is confirmed logged in
  // (covers app-open with existing session, not just explicit login)
  useEffect(() => {
    if (user && isNativeApp()) {
      registerPushNotifications().catch(() => {});
    }
  }, [user?.id]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("/api/login", {
        method: "POST",
        data: credentials,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Login failed" }));
        if (errorData.requiresVerification) {
          const err = new Error(errorData.message || "Please verify your email");
          (err as any).requiresVerification = true;
          (err as any).email = errorData.email;
          throw err;
        }
        throw new Error(errorData.message || "Incorrect password");
      }
      
      return await res.json();
    },
    onSuccess: (user: any) => {
      // Store session ID in persistent storage (survives iOS app kills)
      if (user.sessionId) {
        secureSet('sessionId', user.sessionId);
        localStorage.setItem('sessionId', user.sessionId); // keep in sync for sync reads
      }
      
      queryClient.setQueryData(["/api/user"], user);
      registerPushNotifications().catch(() => {});
      console.log('✅ Login successful, user data cached:', user.username);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const response = await apiRequest("/api/register", {
        method: "POST",
        data: credentials,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Registration failed" }));
        throw new Error(errorData.message || `Registration failed: ${response.status}`);
      }
      
      return await response.json() as RegisterResponse;
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again with different details.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/logout", { method: "POST" });
    },
    onSuccess: () => {
      secureRemove('sessionId');
      localStorage.removeItem('sessionId');
      
      // Clear all cached data
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      // Redirect to home page after logout
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: Error) => {
      secureRemove('sessionId');
      localStorage.removeItem('sessionId');
      
      // Even if logout fails on server, clear local data
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Signed out",
        description: "You have been signed out.",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}