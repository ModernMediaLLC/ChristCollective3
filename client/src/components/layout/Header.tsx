import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Menu, X } from "lucide-react";
import { Bell } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorStatus } from "@/hooks/useCreatorStatus";
import { useQuery } from "@tanstack/react-query";
import { getProfileImageUrl } from "@/lib/api-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@shared/schema";
import { isNativeApp } from "@/lib/platform";

export default function Header() {
  const isMobile = isNativeApp();
  const [isOpen, setIsOpen] = useState(false);
  const [showNotificationAnimation, setShowNotificationAnimation] = useState(false);
  const [path] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();
  const { data: creatorStatus } = useCreatorStatus();
  const prevNotificationCount = useRef<number>(0);
  
  // Check if user has a ministry profile
  const { data: ministryProfile } = useQuery({
    queryKey: ["/api/user/ministry-profile"],
    enabled: !!user,
  });

  // Get notification count
  const { data: unreadCount } = useQuery<{ count: number } | null>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const notificationCount = unreadCount?.count || 0;

  // Trigger animation when notification count increases
  useEffect(() => {
    if (notificationCount > prevNotificationCount.current && prevNotificationCount.current > 0) {
      setShowNotificationAnimation(true);
      const timer = setTimeout(() => setShowNotificationAnimation(false), 600);
      return () => clearTimeout(timer);
    }
    prevNotificationCount.current = notificationCount;
  }, [notificationCount]);
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [path]);

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Donate", path: "/donate" },
    { name: "Shop", path: "/shop" },
    { name: "Creators", path: "/creators" },
    { name: "Business", path: "/business" },
    { name: "Ministries", path: "/ministries" },
    { name: "About", path: "/about" },
  ];

  return (
    <header className="glass-dark sticky top-0 z-50 pt-safe">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/">
          <div className="cursor-pointer">
            <Logo />
          </div>
        </Link>
        
        {/* Desktop Navigation — hidden on native mobile app */}
        <nav className={`${isMobile ? 'hidden' : 'hidden lg:flex'} items-center space-x-6`}>
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <div className={`transition-colors font-semibold cursor-pointer text-sm ${
                path === item.path 
                  ? 'text-[#D4AF37]' 
                  : 'text-foreground hover:text-[#D4AF37]'
              }`}>
                {item.name}
              </div>
            </Link>
          ))}
        </nav>
        
        <div className="flex items-center space-x-4">
          {isLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <>
              {/* Notifications Bell */}
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative group bg-transparent hover:bg-transparent rounded-full transition-all duration-300 ${
                    notificationCount > 0 && !showNotificationAnimation ? 'notification-glow' : ''
                  }`}
                >
                  <Bell
                    size={20}
                    weight={notificationCount > 0 ? "fill" : "regular"}
                    className={`transition-all duration-300 ${
                      notificationCount > 0
                        ? `text-[#D4AF37] ${showNotificationAnimation ? 'bell-animate' : ''}`
                        : 'text-gray-400 group-hover:text-[#D4AF37] group-hover:scale-110'
                    }`}
                  />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg font-semibold">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Button>
              </Link>
              
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getProfileImageUrl(user?.profileImageUrl, 64) || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <div className="cursor-pointer w-full">Profile</div>
                  </Link>
                </DropdownMenuItem>
                {creatorStatus?.isCreator && (
                  <DropdownMenuItem asChild>
                    <Link href="/edit-profile">
                      <div className="cursor-pointer w-full">Creator Profile</div>
                    </Link>
                  </DropdownMenuItem>
                )}
                {ministryProfile && (
                  <DropdownMenuItem asChild>
                    <Link href="/edit-ministry-profile">
                      <div className="cursor-pointer w-full">Ministry Profile</div>
                    </Link>
                  </DropdownMenuItem>
                )}
                {user?.isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <div className="cursor-pointer w-full">Admin Dashboard</div>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()}
                  className="cursor-pointer"
                >
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            !isMobile && (
              <>
                <Link href="/auth">
                  <div className="hidden md:block text-foreground hover:text-primary transition-colors font-medium cursor-pointer">
                    Log In
                  </div>
                </Link>
                <Link href="/auth">
                  <div className="hidden md:block bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md transition-colors cursor-pointer">
                    Sign Up
                  </div>
                </Link>
              </>
            )
          )}

          {/* Mobile hamburger — hidden on native app */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsOpen(!isOpen)}
              data-testid="button-mobile-menu"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Mobile Navigation — not shown on native app */}
      {!isMobile && isOpen && (
        <div className="lg:hidden bg-background border-t border-border">
          <div className="container mx-auto px-4 py-3 flex flex-col space-y-4">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div className="text-foreground hover:text-primary transition-colors font-medium py-2 cursor-pointer">
                  {item.name}
                </div>
              </Link>
            ))}
            {user ? (
              <>
                <hr className="border-gray-800" />
                <button 
                  onClick={() => logoutMutation.mutate()}
                  className="text-foreground hover:text-primary transition-colors font-medium py-2 text-left w-full"
                >
                  Log Out
                </button>
              </>
            ) : (
              <div className="flex space-x-4">
                <Link href="/auth">
                  <div className="text-foreground hover:text-primary transition-colors font-medium py-2 cursor-pointer">
                    Log In
                  </div>
                </Link>
                <Link href="/auth">
                  <div className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md transition-colors cursor-pointer">
                    Sign Up
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
