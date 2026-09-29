import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HomePage from "@/pages/HomePage";
import DonationsPage from "@/pages/DonationsPage";
import CampaignDetailsPage from "@/pages/CampaignDetailsPage";
import CreateCampaignPage from "@/pages/CreateCampaignPage";
import EditCampaignPage from "@/pages/EditCampaignPage";
import BusinessNetworkPage from "@/pages/BusinessNetworkPage";
import BusinessProfilePage from "@/pages/BusinessProfilePage";
import MembershipCheckoutPage from "@/pages/MembershipCheckoutPage";
import MembershipSuccessPage from "@/pages/MembershipSuccessPage";
import MembershipsPage from "@/pages/MembershipsPage";
import DonationCheckoutPage from "@/pages/DonationCheckoutPage";
import DonationSuccessPage from "@/pages/DonationSuccessPage";
import ProfilePage from "@/pages/ProfilePage";
import OnboardingPage from "@/pages/OnboardingPage";
import MatchupsPage from "@/pages/MatchupsPage";
import ClubProfilePage from "@/pages/ClubProfilePage";
import JoinFoundingPage from "@/pages/JoinFoundingPage";
import DirectoryJoinPage from "@/pages/DirectoryJoinPage";
import SponsoredCreatorsPage from "@/pages/SponsoredCreatorsPage";
import SponsorshipApplicationPage from "@/pages/SponsorshipApplicationPageNew";
import CreatorsPage from "@/pages/CreatorsPage";
import CreatorProfilePage from "@/pages/CreatorProfilePage";

import AdminDashboard from "@/pages/AdminDashboard";
import AdminModerationPage from "@/pages/AdminModerationPage";
import AuthPage from "@/pages/AuthPage";
import AuthTestPage from "@/pages/AuthTestPage";
import AboutPage from "@/pages/AboutPage";
import ResetPassword from "@/pages/ResetPassword";
import FeedPage from "@/pages/FeedPage";
import ExplorePage from "@/pages/ExplorePage";
import CreatePage from "@/pages/CreatePage";
import ConnectPage from "@/pages/ConnectPage";
import ChatRoom from "@/pages/ChatRoom";
import NotificationsPage from "@/pages/NotificationsPage";
import MinistryProfilePage from "@/pages/MinistryProfilePage";
import MinistryCreatePage from "@/pages/MinistryCreatePage";
import EditProfilePage from "@/pages/EditProfilePage";
import CreatorSharePage from "@/pages/CreatorSharePage";
import CreatorSocialSharePage from "@/pages/CreatorSocialSharePage";
import MinistriesPage from "@/pages/MinistriesPage";
import MinistryProfileViewPage from "@/pages/MinistryProfileViewPage";
import EditMinistryProfilePage from "@/pages/EditMinistryProfilePage";
import EventCreatePage from "@/pages/EventCreatePage";
import EventPublicPage from "@/pages/EventPublicPage";
import PostPage from "@/pages/PostPage";
import DirectChatPage from "@/pages/DirectChatPage";
import DebugAuthPage from "@/pages/DebugAuthPage";
import ShopPage from "@/pages/ShopPage";
import ShopProductPage from "@/pages/ShopProductPage";
import AdminProductsPage from "@/pages/AdminProductsPage";
import AdminOrdersPage from "@/pages/AdminOrdersPage";
import AdminVenuesPage from "@/pages/AdminVenuesPage";
import AdminMatchingPage from "@/pages/AdminMatchingPage";
import ShopCheckoutPage from "@/pages/ShopCheckoutPage";
import ShopSuccessPage from "@/pages/ShopSuccessPage";

import VerifyEmailPage from "@/pages/VerifyEmailPage";
import SettingsPage from "@/pages/SettingsPage";
import BillingHistoryPage from "@/pages/BillingHistoryPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import BottomNavigation from "@/components/layout/BottomNavigation";
import AppInstallBanner from "@/components/AppInstallBanner";
import MobileAuthPage from "@/pages/MobileAuthPage";
import MobileLandingPage from "@/pages/MobileLandingPage";
import { isNativeApp } from "@/lib/platform";

function Router() {
  const isMobileApp = isNativeApp();

  return (
    <Switch>
      <Route path="/" component={isMobileApp ? MobileLandingPage : HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/mobile" component={MobileAuthPage} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/join" component={JoinFoundingPage} />
      <Route path="/join/business">{() => <DirectoryJoinPage kind="business" />}</Route>
      <Route path="/join/ministry">{() => <DirectoryJoinPage kind="ministry" />}</Route>
      <Route path="/matchups" component={MatchupsPage} />
      <Route path="/donate" component={DonationsPage} />
      <Route path="/donate/create" component={CreateCampaignPage} />
      <Route path="/donate/edit/:id" component={EditCampaignPage} />
      <Route path="/donate/checkout/:campaignId" component={DonationCheckoutPage} />
      <Route path="/donate/success" component={DonationSuccessPage} />
      <Route path="/donate/:slug" component={CampaignDetailsPage} />
      <Route path="/business" component={BusinessNetworkPage} />
      <Route path="/business/profile/:id" component={BusinessProfilePage} />
      <Route path="/business-profile" component={BusinessNetworkPage} />
      <Route path="/ministry-profile" component={MinistryProfilePage} />
      <Route path="/ministry/create" component={MinistryCreatePage} />
      <Route path="/edit-ministry-profile" component={EditMinistryProfilePage} />
      <Route path="/membership/checkout/:tierId" component={MembershipCheckoutPage} />
      <Route path="/membership/success" component={MembershipSuccessPage} />
      <Route path="/memberships" component={MembershipsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/:username" component={ProfilePage} />
      <Route path="/edit-profile" component={EditProfilePage} />
      <Route path="/sponsored-creators" component={SponsoredCreatorsPage} />
      <Route path="/creators" component={CreatorsPage} />
      <Route path="/creators/:id" component={CreatorProfilePage} />

      <Route path="/ministries" component={MinistriesPage} />
      <Route path="/ministry/:id" component={MinistryProfileViewPage} />
      <Route path="/sponsorship-application" component={SponsorshipApplicationPage} />
      <Route path="/apply-sponsorship" component={SponsorshipApplicationPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/auth-test" component={AuthTestPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/feed" component={FeedPage} />
      <Route path="/post/:id" component={PostPage} />
      <Route path="/ministry-post/:id" component={PostPage} />
      <Route path="/explore" component={ExplorePage} />
      <Route path="/create" component={CreatePage} />
      <Route path="/events/create" component={EventCreatePage} />
      <Route path="/events/:id/edit" component={EventCreatePage} />
      <Route path="/events/:id" component={EventPublicPage} />
      <Route path="/creators/share" component={CreatorSocialSharePage} />
      <Route path="/creators/share/:platform" component={CreatorSharePage} />
      <Route path="/connect" component={ConnectPage} />
      <Route path="/club/queue/:id" component={ClubProfilePage} />
      <Route path="/club/:id" component={ClubProfilePage} />
      <Route path="/chat/:id" component={ChatRoom} />
      <Route path="/direct-chat/:chatId" component={DirectChatPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/debug-auth" component={DebugAuthPage} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/shop/product/:productId" component={ShopProductPage} />
      <Route path="/shop/checkout/:priceId" component={ShopCheckoutPage} />
      <Route path="/shop/success" component={ShopSuccessPage} />
      <Route path="/admin/products" component={AdminProductsPage} />
      <Route path="/admin/orders" component={AdminOrdersPage} />
      <Route path="/admin/moderation" component={AdminModerationPage} />
      <Route path="/admin/venues" component={AdminVenuesPage} />
      <Route path="/admin/matching" component={AdminMatchingPage} />

      <Route path="/settings" component={SettingsPage} />
      <Route path="/billing-history" component={BillingHistoryPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useAuth();
  const isMobileApp = isNativeApp();
  const [location] = useLocation();

  // Focused funnels + immersive detail pages hide the app chrome (bottom nav + web footer).
  const isFunnel = location === "/onboarding" || location === "/matchups" || location === "/join" || location.startsWith("/join/") || location.startsWith("/club/");

  // Show bottom navigation if (mobile app OR logged-in web) AND not inside a funnel.
  const showBottomNav = (isMobileApp || !!user) && !isFunnel;

  return (
    <>
      <Header />
      <main className={`min-h-screen ${showBottomNav ? "pb-nav-safe" : ""}`}>
        <Router />
      </main>
      {!showBottomNav && !isFunnel && <Footer />}
      {showBottomNav && <BottomNavigation />}
      <AppInstallBanner />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
