import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Trash2, Clock, DollarSign, Users, Building, Receipt, UserCheck, Search, Eye, Calendar, Mail, X, Phone, MapPin, ExternalLink, ShoppingBag, Package, Crown, Shield, LayoutDashboard, FileText, Handshake, CreditCard, Coffee, Instagram, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Campaign, User, Donation, SponsorshipApplication, MembershipSubscription } from "@shared/schema";
import { getUserDisplayName, getUserInitials } from "@/lib/user-display";

type AdminSection = "overview" | "matchups" | "ministries" | "campaigns" | "all-campaigns" | "sponsorships" | "transactions" | "members" | "users";

const sidebarItems: { id: AdminSection; label: string; icon: any; badge?: boolean }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "matchups", label: "Matchup Requests", icon: Sparkles, badge: true },
  { id: "ministries", label: "Ministries", icon: Building, badge: true },
  { id: "campaigns", label: "Pending Campaigns", icon: Clock, badge: true },
  { id: "all-campaigns", label: "All Campaigns", icon: FileText },
  { id: "sponsorships", label: "Sponsorships", icon: Handshake, badge: true },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "members", label: "Members", icon: Crown },
  { id: "users", label: "Users", icon: Users },
];

// Shape of the current-cycle Matchup request stored on each user.
type MatchupRequest = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  disciplines: string[] | null;
  interests: string[] | null;
  matchPreference: string | null;
  instagram: string | null;
  matchupRequest: { slot?: string; activity?: string; requestedAt?: string } | null;
};

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !user.isAdmin) {
      toast({ title: "Access Denied", description: "You don't have permission to access this page.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/"; }, 500);
    }
  }, [user, authLoading, toast]);

  const { data: pendingCampaigns, isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/campaigns/pending"],
    enabled: user?.isAdmin === true,
  });

  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/admin/campaigns"],
    enabled: user?.isAdmin === true,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: user?.isAdmin === true,
  });

  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/admin/transactions"],
    enabled: user?.isAdmin === true,
  });

  const { data: sponsorshipApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/admin/sponsorship-applications"],
    enabled: user?.isAdmin === true,
  });

  const { data: pendingMinistries = [], isLoading: ministriesLoading } = useQuery({
    queryKey: ["/api/ministries/pending"],
    enabled: user?.isAdmin === true,
  });

  const { data: membershipSubs = [], isLoading: membershipsLoading } = useQuery<MembershipSubscription[]>({
    queryKey: ["/api/admin/membership-subscriptions"],
    enabled: user?.isAdmin === true,
  });

  const { data: matchupRequests = [], isLoading: matchupsLoading } = useQuery<MatchupRequest[]>({
    queryKey: ["/api/admin/matchup-requests"],
    enabled: user?.isAdmin === true,
  });

  const handleMutationError = (error: Error) => {
    if (isUnauthorizedError(error)) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
    toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const approveMutation = useMutation({
    mutationFn: async (campaignId: string) => { await apiRequest(`/api/admin/campaigns/${campaignId}/approve`, { method: "POST" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campaign Approved", description: "The campaign has been approved and is now live." });
    },
    onError: handleMutationError,
  });

  const rejectMutation = useMutation({
    mutationFn: async (campaignId: string) => { await apiRequest(`/api/admin/campaigns/${campaignId}/reject`, { method: "POST" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campaign Rejected", description: "The campaign has been rejected." });
    },
    onError: handleMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => { await apiRequest(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campaign Deleted", description: "The campaign has been permanently removed." });
    },
    onError: handleMutationError,
  });

  const approveApplicationMutation = useMutation({
    mutationFn: async (applicationId: number) => { await apiRequest(`/api/admin/sponsorship-applications/${applicationId}/approve`, { method: "POST" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorship-applications"] });
      toast({ title: "Application Approved", description: "The sponsorship application has been approved." });
    },
    onError: handleMutationError,
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async (applicationId: number) => { await apiRequest(`/api/admin/sponsorship-applications/${applicationId}/reject`, { method: "POST" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorship-applications"] });
      toast({ title: "Application Rejected", description: "The sponsorship application has been rejected." });
    },
    onError: handleMutationError,
  });

  const approveMinistryMutation = useMutation({
    mutationFn: async (ministryId: number) => { await apiRequest(`/api/ministries/${ministryId}/approve`, { method: "PATCH" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ministries/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ministries"] });
      toast({ title: "Ministry Approved", description: "The ministry profile has been approved and is now live." });
    },
    onError: handleMutationError,
  });

  const rejectMinistryMutation = useMutation({
    mutationFn: async (ministryId: number) => { await apiRequest(`/api/ministries/${ministryId}/reject`, { method: "PATCH" }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ministries/pending"] });
      toast({ title: "Ministry Rejected", description: "The ministry profile has been rejected and removed." });
    },
    onError: handleMutationError,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await apiRequest(`/api/admin/users/${userId}/status`, { method: "PATCH", data: { status } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed to update status"); }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser((u) => (u ? ({ ...u, accountStatus: vars.status } as any) : u));
      const label = vars.status === "banned" ? "banned" : vars.status === "frozen" ? "frozen" : "reactivated";
      toast({ title: `Member ${label}` });
    },
    onError: handleMutationError,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-[#D4AF37] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const filteredUsers = Array.isArray(allUsers) ? allUsers.filter((user: User) =>
    !searchQuery ||
    user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const pendingMinistriesCount = Array.isArray(pendingMinistries) ? pendingMinistries.length : 0;
  const pendingCampaignsCount = Array.isArray(pendingCampaigns) ? pendingCampaigns.length : 0;
  const pendingSponsorshipsCount = Array.isArray(sponsorshipApplications) ? sponsorshipApplications.filter((a: SponsorshipApplication) => a.status === "pending").length : 0;
  const totalRaised = Array.isArray(allTransactions) ? allTransactions.reduce((sum: number, t: Donation) => sum + (Number(t.amount) || 0), 0) : 0;

  const matchupRequestsCount = Array.isArray(matchupRequests) ? matchupRequests.length : 0;

  const getBadgeCount = (id: AdminSection): number => {
    if (id === "matchups") return matchupRequestsCount;
    if (id === "ministries") return pendingMinistriesCount;
    if (id === "campaigns") return pendingCampaignsCount;
    if (id === "sponsorships") return pendingSponsorshipsCount;
    return 0;
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 bg-[#0A0A0A] border-r border-gray-800/60 flex flex-col transition-transform duration-200 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Admin Panel</h2>
              <p className="text-xs text-gray-500">Christ Collective</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const badgeCount = item.badge ? getBadgeCount(item.id) : 0;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20" : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[#D4AF37] text-black text-xs font-bold px-1.5">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-gray-800/60 space-y-1">
            <Link href="/admin/products">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Products</span>
              </button>
            </Link>
            <Link href="/admin/orders">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
                <Package className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Orders</span>
              </button>
            </Link>
            <Link href="/admin/moderation">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
                <Eye className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Moderation</span>
              </button>
            </Link>
            <Link href="/admin/matching">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Matching CRM</span>
              </button>
            </Link>
            <Link href="/admin/venues">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Venue Directory</span>
              </button>
            </Link>
          </div>
        </nav>
      </aside>

      <main className="flex-1 min-h-screen pb-24">
        <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-gray-800/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400">
                <LayoutDashboard className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold text-white">
                {sidebarItems.find(s => s.id === activeSection)?.label || "Dashboard"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Admin Active
              </div>
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeSection === "overview" && <OverviewSection
            pendingMinistriesCount={pendingMinistriesCount}
            pendingCampaignsCount={pendingCampaignsCount}
            matchupRequestsCount={matchupRequestsCount}
            matchupsLoading={matchupsLoading}
            totalUsers={Array.isArray(allUsers) ? allUsers.length : 0}
            totalRaised={totalRaised}
            membershipSubs={membershipSubs}
            formatCurrency={formatCurrency}
            ministriesLoading={ministriesLoading}
            pendingLoading={pendingLoading}
            usersLoading={usersLoading}
            transactionsLoading={transactionsLoading}
            membershipsLoading={membershipsLoading}
            setActiveSection={setActiveSection}
          />}

          {activeSection === "matchups" && <MatchupsSection
            matchupRequests={matchupRequests}
            matchupsLoading={matchupsLoading}
          />}

          {activeSection === "ministries" && <MinistriesSection
            pendingMinistries={pendingMinistries}
            ministriesLoading={ministriesLoading}
            approveMinistryMutation={approveMinistryMutation}
            rejectMinistryMutation={rejectMinistryMutation}
            formatDate={formatDate}
          />}

          {activeSection === "campaigns" && <PendingCampaignsSection
            pendingCampaigns={pendingCampaigns}
            pendingLoading={pendingLoading}
            approveMutation={approveMutation}
            rejectMutation={rejectMutation}
            deleteMutation={deleteMutation}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />}

          {activeSection === "all-campaigns" && <AllCampaignsSection
            allCampaigns={allCampaigns}
            campaignsLoading={campaignsLoading}
            deleteMutation={deleteMutation}
            formatCurrency={formatCurrency}
          />}

          {activeSection === "sponsorships" && <SponsorshipsSection
            sponsorshipApplications={sponsorshipApplications}
            applicationsLoading={applicationsLoading}
            approveApplicationMutation={approveApplicationMutation}
            rejectApplicationMutation={rejectApplicationMutation}
          />}

          {activeSection === "transactions" && <TransactionsSection
            allTransactions={allTransactions}
            transactionsLoading={transactionsLoading}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />}

          {activeSection === "members" && <MembersSection
            membershipSubs={membershipSubs}
            membershipsLoading={membershipsLoading}
          />}

          {activeSection === "users" && <UsersSection
            filteredUsers={filteredUsers}
            usersLoading={usersLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setSelectedUser={setSelectedUser}
            formatDate={formatDate}
          />}
        </div>
      </main>

      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0A] border-gray-800 text-white">
            <DialogHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-14 w-14 border-2 border-[#D4AF37]/30">
                  <AvatarImage src={selectedUser.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gray-800 text-[#D4AF37] text-lg font-bold">{getUserInitials(selectedUser)}</AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">{getUserDisplayName(selectedUser)}</DialogTitle>
                  <DialogDescription className="text-gray-400">@{selectedUser.username} · {selectedUser.isAdmin ? "Administrator" : "User"}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Contact</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail className="h-4 w-4 text-[#D4AF37]" />
                      <span className="text-gray-300">{selectedUser.email || "No email"}</span>
                    </div>
                    {selectedUser.phone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="h-4 w-4 text-[#D4AF37]" />
                        <span className="text-gray-300">{selectedUser.phone}</span>
                      </div>
                    )}
                    {selectedUser.location && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <MapPin className="h-4 w-4 text-[#D4AF37]" />
                        <span className="text-gray-300">{selectedUser.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Account</h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID</span>
                      <span className="text-gray-300 font-mono text-xs">{selectedUser.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Role</span>
                      <Badge className={selectedUser.isAdmin ? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30" : "bg-gray-800 text-gray-300 border border-gray-700"}>
                        {selectedUser.isAdmin ? "Admin" : "User"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status</span>
                      <Badge className={
                        (selectedUser as any).accountStatus === "banned" ? "bg-red-500/10 text-red-400 border border-red-500/30" :
                        (selectedUser as any).accountStatus === "frozen" ? "bg-orange-500/10 text-orange-400 border border-orange-500/30" :
                        "bg-green-500/10 text-green-400 border border-green-500/30"
                      }>
                        {(selectedUser as any).accountStatus || "active"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Joined</span>
                      <span className="text-gray-300">{formatDate(selectedUser.createdAt || new Date())}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedUser.bio && (
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Bio</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedUser.bio}</p>
                </div>
              )}

              {(selectedUser.onboardingCompleted || (selectedUser.disciplines?.length ?? 0) > 0 || selectedUser.city || (selectedUser as any).instagram) && (
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Community Profile{selectedUser.onboardingCompleted ? "" : " (incomplete)"}</h4>
                  <div className="space-y-3 text-sm">
                    {(selectedUser.disciplines?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Disciplines</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.disciplines!.map((d, i) => <Badge key={i} variant="outline" className="text-xs border-gray-700 text-gray-300">{d}</Badge>)}
                        </div>
                      </div>
                    )}
                    {((selectedUser as any).interests?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Interests</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedUser as any).interests.map((it: string, i: number) => <Badge key={i} variant="outline" className="text-xs border-gray-700 text-gray-400">{it}</Badge>)}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {selectedUser.city && <div><span className="text-gray-500">City: </span><span className="text-gray-300">{selectedUser.city}</span></div>}
                      {(selectedUser as any).instagram && (
                        <div className="col-span-2 flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500">IG: </span>
                          <a href={`https://instagram.com/${String((selectedUser as any).instagram).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">@{String((selectedUser as any).instagram).replace(/^@/, "")}</a>
                          {(selectedUser as any).instagramVerified
                            ? <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 text-[10px]">✓ Verified</Badge>
                            : <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-500">Unverified</Badge>}
                          <button
                            className="text-[11px] text-gray-400 hover:text-white underline"
                            onClick={async () => {
                              const verified = !(selectedUser as any).instagramVerified;
                              try {
                                await apiRequest(`/api/admin/users/${selectedUser.id}/instagram-verified`, { method: "PATCH", data: { verified } });
                                setSelectedUser({ ...(selectedUser as any), instagramVerified: verified });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                              } catch (e: any) {
                                const raw = String(e?.message || "").replace(/^\d{3}:\s*/, "");
                                let msg = raw; try { msg = JSON.parse(raw).message || raw; } catch { /* plain text */ }
                                toast({ title: msg || "Couldn't update", variant: "destructive" });
                              }
                            }}
                          >
                            {(selectedUser as any).instagramVerified ? "Remove verification" : "Mark verified"}
                          </button>
                        </div>
                      )}
                      {(selectedUser as any).gender && <div><span className="text-gray-500">Gender: </span><span className="text-gray-300">{(selectedUser as any).gender}</span></div>}
                      {(selectedUser as any).birthdate && <div><span className="text-gray-500">Birthday: </span><span className="text-gray-300">{String((selectedUser as any).birthdate)}</span></div>}
                      {(selectedUser as any).matchPreference && <div><span className="text-gray-500">Wants to meet: </span><span className="text-gray-300">{prettifyToken((selectedUser as any).matchPreference)}</span></div>}
                    </div>
                    {(selectedUser as any).creativeGoals && <div><p className="text-gray-500 text-xs mb-1">Creative goals</p><p className="text-gray-300">{(selectedUser as any).creativeGoals}</p></div>}
                    {(selectedUser as any).faithNote && <div><p className="text-gray-500 text-xs mb-1">Faith</p><p className="text-gray-300">{(selectedUser as any).faithNote}</p></div>}
                  </div>
                </div>
              )}

              {selectedUser.stripeCustomerId && (
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Payment</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-gray-400">Stripe:</span>
                    <span className="text-gray-300 font-mono text-xs">{selectedUser.stripeCustomerId}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800/60 mt-2">
                {selectedUser.email && (
                  <a href={`mailto:${selectedUser.email}`}>
                    <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Email
                    </Button>
                  </a>
                )}
                {selectedUser.isAdmin || selectedUser.id === user?.id ? (
                  <span className="text-xs text-gray-600 self-center">Admins &amp; your own account can't be moderated.</span>
                ) : (
                  <>
                    {(selectedUser as any).accountStatus !== "active" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: selectedUser.id, status: "active" })}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Reactivate
                      </Button>
                    )}
                    {(selectedUser as any).accountStatus !== "frozen" && (selectedUser as any).accountStatus !== "banned" && (
                      <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-900/20" disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: selectedUser.id, status: "frozen" })}>
                        <Clock className="h-3.5 w-3.5 mr-1.5" /> Freeze
                      </Button>
                    )}
                    {(selectedUser as any).accountStatus !== "banned" && (
                      <Button size="sm" variant="destructive" disabled={statusMutation.isPending}
                        onClick={() => { if (confirm(`Ban ${getUserDisplayName(selectedUser)}? They will be locked out of the platform.`)) statusMutation.mutate({ userId: selectedUser.id, status: "banned" }); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Ban
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, loading, onClick }: { icon: any; label: string; value: string | number; color: string; loading?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={`text-left w-full ${onClick ? "cursor-pointer" : ""}`}>
      <div className="bg-[#0A0A0A] border border-gray-800/60 rounded-xl p-4 hover:border-gray-700/60 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <p className="text-2xl font-bold text-white">{loading ? "..." : value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </button>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-900/50 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-gray-600" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0A0A0A] border border-gray-800/60 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${75 - i * 15}%` }} />
      ))}
    </div>
  );
}

function OverviewSection({ pendingMinistriesCount, pendingCampaignsCount, matchupRequestsCount, matchupsLoading, totalUsers, totalRaised, membershipSubs, formatCurrency, ministriesLoading, pendingLoading, usersLoading, transactionsLoading, membershipsLoading, setActiveSection }: any) {
  const activeMemberships = Array.isArray(membershipSubs) ? membershipSubs.filter((s: MembershipSubscription) => s.status === "active").length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Sparkles} label="Matchup Requests" value={matchupRequestsCount} color="bg-[#D4AF37]/10 text-[#D4AF37]" loading={matchupsLoading} onClick={() => setActiveSection("matchups")} />
        <StatCard icon={Building} label="Pending Ministries" value={pendingMinistriesCount} color="bg-green-500/10 text-green-400" loading={ministriesLoading} onClick={() => setActiveSection("ministries")} />
        <StatCard icon={Clock} label="Pending Campaigns" value={pendingCampaignsCount} color="bg-[#D4AF37]/10 text-[#D4AF37]" loading={pendingLoading} onClick={() => setActiveSection("campaigns")} />
        <StatCard icon={Users} label="Total Users" value={totalUsers} color="bg-blue-500/10 text-blue-400" loading={usersLoading} onClick={() => setActiveSection("users")} />
        <StatCard icon={DollarSign} label="Total Raised" value={formatCurrency(totalRaised)} color="bg-[#D4AF37]/10 text-[#D4AF37]" loading={transactionsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard>
          <div className="p-5 border-b border-gray-800/60">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Crown className="h-4 w-4 text-[#D4AF37]" /> Membership Overview
            </h3>
          </div>
          {membershipsLoading ? <LoadingSkeleton /> : (
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#D4AF37]">{Array.isArray(membershipSubs) ? membershipSubs.length : 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{activeMemberships}</p>
                  <p className="text-xs text-gray-500 mt-1">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">
                    {Array.isArray(membershipSubs) ? membershipSubs.filter((s: MembershipSubscription) => s.tier === "guild").length : 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Guild</p>
                </div>
              </div>
              <Button variant="ghost" className="w-full mt-4 text-[#D4AF37] hover:bg-[#D4AF37]/10" onClick={() => setActiveSection("members")}>
                View All Members
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <div className="p-5 border-b border-gray-800/60">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#D4AF37]" /> Quick Links
            </h3>
          </div>
          <div className="p-5 space-y-2">
            <Link href="/admin/products">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/60 transition-colors text-left">
                <ShoppingBag className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm text-gray-300">Manage Products</span>
              </button>
            </Link>
            <Link href="/admin/orders">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/60 transition-colors text-left">
                <Package className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm text-gray-300">Manage Orders</span>
              </button>
            </Link>
            <Link href="/admin/moderation">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/60 transition-colors text-left">
                <Eye className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm text-gray-300">Content Moderation</span>
              </button>
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MinistriesSection({ pendingMinistries, ministriesLoading, approveMinistryMutation, rejectMinistryMutation, formatDate }: any) {
  if (ministriesLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(pendingMinistries) || pendingMinistries.length === 0) return <EmptyState icon={Building} message="No pending ministry profiles to review." />;

  return (
    <div className="space-y-4">
      {pendingMinistries.map((ministry: any) => (
        <SectionCard key={ministry.id}>
          <div className="p-5">
            <div className="flex flex-col sm:flex-row gap-5">
              <Avatar className="h-16 w-16 mx-auto sm:mx-0 border-2 border-[#D4AF37]/20">
                <AvatarImage src={ministry.logo} alt={ministry.name} />
                <AvatarFallback className="bg-[#D4AF37]/10 text-[#D4AF37] text-xl font-bold">{ministry.name?.charAt(0) || "M"}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-white">{ministry.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {ministry.denomination && (
                      <Badge variant="outline" className="text-xs border-blue-800/50 text-blue-300 bg-blue-900/20">{ministry.denomination}</Badge>
                    )}
                    <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs">
                      <Clock className="h-3 w-3 mr-1" /> Pending
                    </Badge>
                  </div>
                </div>

                <p className="text-gray-400 text-sm leading-relaxed mb-4">{ministry.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span className="break-all">{ministry.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>{ministry.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span className="break-words">{ministry.address}</span>
                  </div>
                  {ministry.website && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <ExternalLink className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <a href={ministry.website} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline break-all">{ministry.website}</a>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMinistryMutation.mutate(ministry.id)} disabled={approveMinistryMutation.isPending}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> {approveMinistryMutation.isPending ? "..." : "Approve"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectMinistryMutation.mutate(ministry.id)} disabled={rejectMinistryMutation.isPending}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> {rejectMinistryMutation.isPending ? "..." : "Reject"}
                    </Button>
                  </div>
                  <span className="text-xs text-gray-600 sm:ml-auto">Submitted {ministry.createdAt ? formatDate(ministry.createdAt) : "Unknown"}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function PendingCampaignsSection({ pendingCampaigns, pendingLoading, approveMutation, rejectMutation, deleteMutation, formatCurrency, formatDate }: any) {
  if (pendingLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(pendingCampaigns) || pendingCampaigns.length === 0) return <EmptyState icon={Clock} message="No pending campaigns to review." />;

  return (
    <div className="space-y-4">
      {pendingCampaigns.map((campaign: Campaign) => (
        <SectionCard key={campaign.id}>
          <div className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">{campaign.title}</h3>
                <p className="text-sm text-[#D4AF37]">Goal: {formatCurrency(Number(campaign.goal))}</p>
              </div>
              <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs shrink-0 ml-3">
                <Clock className="h-3 w-3 mr-1" /> Pending
              </Badge>
            </div>
            <p className="text-gray-400 text-sm line-clamp-2 mb-4">{campaign.description}</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-gray-600 space-y-1">
                <p>Created: {formatDate(campaign.createdAt || new Date())}</p>
                {campaign.image && <p className="text-green-500">Image attached</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMutation.mutate(campaign.id)} disabled={approveMutation.isPending}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="border-red-800/50 text-red-400 hover:bg-red-900/30" onClick={() => rejectMutation.mutate(campaign.id)} disabled={rejectMutation.isPending}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                </Button>
                <Button size="sm" variant="outline" className="border-gray-700 text-gray-400 hover:bg-gray-800" onClick={() => deleteMutation.mutate(campaign.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function AllCampaignsSection({ allCampaigns, campaignsLoading, deleteMutation, formatCurrency }: any) {
  if (campaignsLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(allCampaigns) || allCampaigns.length === 0) return <EmptyState icon={FileText} message="No campaigns found." />;

  return (
    <div className="space-y-4">
      {allCampaigns.map((campaign: Campaign) => (
        <SectionCard key={campaign.id}>
          <div className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{campaign.title}</h3>
                <p className="text-sm text-gray-400">
                  {formatCurrency(Number(campaign.currentAmount))} of {formatCurrency(Number(campaign.goal))} raised
                </p>
              </div>
              <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> {campaign.status}
              </Badge>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4">
              <div className="bg-[#D4AF37] h-1.5 rounded-full" style={{ width: `${Math.min((Number(campaign.currentAmount) / Number(campaign.goal)) * 100, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{Math.round((Number(campaign.currentAmount) / Number(campaign.goal)) * 100)}% funded</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-400 hover:bg-gray-800 text-xs">
                  <Receipt className="h-3 w-3 mr-1" /> Transactions
                </Button>
                <Button variant="outline" size="sm" className="border-red-800/50 text-red-400 hover:bg-red-900/30 text-xs" onClick={() => deleteMutation.mutate(campaign.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function SponsorshipsSection({ sponsorshipApplications, applicationsLoading, approveApplicationMutation, rejectApplicationMutation }: any) {
  if (applicationsLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(sponsorshipApplications) || sponsorshipApplications.length === 0) return <EmptyState icon={Handshake} message="No sponsorship applications yet." />;

  return (
    <div className="space-y-4">
      {sponsorshipApplications.map((application: SponsorshipApplication) => (
        <SectionCard key={application.id}>
          <div className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{application.name}</h3>
                <p className="text-sm text-gray-400">{application.email}</p>
              </div>
              <Badge className={
                application.status === "approved" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                application.status === "rejected" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              }>
                {application.status}
              </Badge>
            </div>

            {Array.isArray(application.platforms) && application.platforms.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {application.platforms.map((platform: any, index: number) => (
                    <a key={index} href={platform.profileUrl} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="text-xs border-gray-700 text-gray-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors cursor-pointer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {platform.platform} ({platform.subscriberCount ? platform.subscriberCount.toLocaleString() : "N/A"})
                      </Badge>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {application.message && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Message</p>
                <p className="text-sm text-gray-400">{application.message}</p>
              </div>
            )}

            {application.status === "pending" && (
              <div className="flex gap-2 pt-2 border-t border-gray-800/60">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveApplicationMutation.mutate(application.id)} disabled={approveApplicationMutation.isPending}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> {approveApplicationMutation.isPending ? "..." : "Approve"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => rejectApplicationMutation.mutate(application.id)} disabled={rejectApplicationMutation.isPending}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> {rejectApplicationMutation.isPending ? "..." : "Reject"}
                </Button>
              </div>
            )}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function TransactionsSection({ allTransactions, transactionsLoading, formatCurrency, formatDate }: any) {
  if (transactionsLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(allTransactions) || allTransactions.length === 0) return <EmptyState icon={Receipt} message="No transactions found." />;

  return (
    <SectionCard>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800/60 hover:bg-transparent">
              <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Amount</TableHead>
              <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Campaign</TableHead>
              <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Transaction ID</TableHead>
              <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTransactions.map((transaction: Donation) => (
              <TableRow key={transaction.id} className="border-gray-800/60 hover:bg-gray-900/30">
                <TableCell className="text-gray-300 text-sm">{formatDate(transaction.createdAt || new Date())}</TableCell>
                <TableCell className="text-[#D4AF37] font-semibold">{formatCurrency(Number(transaction.amount))}</TableCell>
                <TableCell className="text-gray-300 text-sm">{transaction.campaignId}</TableCell>
                <TableCell className="text-gray-500 font-mono text-xs">{transaction.stripePaymentId}</TableCell>
                <TableCell>
                  <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Completed
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function MembersSection({ membershipSubs, membershipsLoading }: any) {
  if (membershipsLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(membershipSubs) || membershipSubs.length === 0) return <EmptyState icon={Crown} message="No membership subscriptions yet." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Crown} label="Total Members" value={membershipSubs.length} color="bg-[#D4AF37]/10 text-[#D4AF37]" />
        <StatCard icon={CheckCircle} label="Active" value={membershipSubs.filter((s: MembershipSubscription) => s.status === "active").length} color="bg-green-500/10 text-green-400" />
        <StatCard icon={Crown} label="Collective" value={membershipSubs.filter((s: MembershipSubscription) => s.tier === "collective").length} color="bg-[#D4AF37]/10 text-[#D4AF37]" />
        <StatCard icon={Crown} label="Guild" value={membershipSubs.filter((s: MembershipSubscription) => s.tier === "guild").length} color="bg-[#D4AF37]/10 text-[#D4AF37]" />
      </div>

      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800/60 hover:bg-transparent">
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Member</TableHead>
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Email</TableHead>
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Phone</TableHead>
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Tier</TableHead>
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membershipSubs.map((sub: MembershipSubscription) => (
                <TableRow key={sub.id} className="border-gray-800/60 hover:bg-gray-900/30">
                  <TableCell className="text-white font-medium text-sm">{sub.fullName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Mail className="h-3 w-3 text-gray-600" />
                      {sub.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.phone ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Phone className="h-3 w-3 text-gray-600" />
                        {sub.phone}
                      </div>
                    ) : <span className="text-gray-700">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      sub.tier === "guild" ? "bg-gradient-to-r from-[#D4AF37] to-[#F5E6A3] text-black text-xs" :
                      sub.tier === "collective" ? "bg-[#D4AF37] text-black text-xs" :
                      "bg-gray-800 text-gray-400 text-xs"
                    }>
                      {sub.tier === "collective" ? "The Collective" : sub.tier === "guild" ? "The Guild" : sub.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      sub.status === "active" ? "bg-green-500/10 text-green-400 border border-green-500/20 text-xs" :
                      sub.status === "cancelled" ? "bg-red-500/10 text-red-400 border border-red-500/20 text-xs" :
                      "bg-gray-800/50 text-gray-500 border border-gray-700 text-xs"
                    }>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(sub.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}

function prettifyToken(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function MatchupsSection({ matchupRequests, matchupsLoading }: { matchupRequests: MatchupRequest[]; matchupsLoading: boolean }) {
  if (matchupsLoading) return <SectionCard><LoadingSkeleton rows={5} /></SectionCard>;
  if (!Array.isArray(matchupRequests) || matchupRequests.length === 0) {
    return <EmptyState icon={Sparkles} message="No Matchup requests yet. When members request a matchup, they'll appear here for manual matching." />;
  }

  const displayName = (m: MatchupRequest) =>
    [m.firstName, m.lastName].filter(Boolean).join(" ") || m.username || "Member";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Sparkles className="h-4 w-4 text-[#D4AF37]" />
        <span>{matchupRequests.length} member{matchupRequests.length === 1 ? "" : "s"} waiting to be matched</span>
      </div>

      {matchupRequests.map((m) => {
        const req = m.matchupRequest || {};
        return (
          <SectionCard key={m.id}>
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white">{displayName(m)}</h3>
                  {m.username && <p className="text-gray-600 text-xs">@{m.username}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {req.slot && (
                    <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 text-xs">
                      <Calendar className="h-3 w-3 mr-1" /> {prettifyToken(req.slot)}
                    </Badge>
                  )}
                  {req.activity && (
                    <Badge className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs">
                      <Coffee className="h-3 w-3 mr-1" /> {prettifyToken(req.activity)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                {m.email && (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-2 text-gray-300 hover:text-[#D4AF37] transition-colors">
                    <Mail className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                    <span className="break-all">{m.email}</span>
                  </a>
                )}
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="flex items-center gap-2 text-gray-300 hover:text-[#D4AF37] transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                    <span>{m.phone}</span>
                  </a>
                )}
                {m.instagram && (
                  <a
                    href={`https://instagram.com/${m.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-300 hover:text-[#D4AF37] transition-colors"
                  >
                    <Instagram className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                    <span>@{m.instagram.replace(/^@/, "")}</span>
                  </a>
                )}
                {m.city && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                    <span>{m.city}</span>
                  </div>
                )}
              </div>

              {Array.isArray(m.disciplines) && m.disciplines.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Disciplines</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.disciplines.map((d, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-gray-700 text-gray-300">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(m.interests) && m.interests.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.interests.map((it, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-gray-700 text-gray-400">{it}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-gray-800/60 text-xs text-gray-600">
                {m.matchPreference && <span>Prefers: {prettifyToken(m.matchPreference)}</span>}
                {req.requestedAt && (
                  <span className="sm:ml-auto">
                    Requested {new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

function UsersSection({ filteredUsers, usersLoading, searchQuery, setSearchQuery, setSelectedUser, formatDate }: any) {
  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <Input
          type="text"
          placeholder="Search by name, email, or username..."
          value={searchQuery}
          onChange={(e: any) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0A0A0A] border-gray-800/60 text-white placeholder:text-gray-600 focus:border-[#D4AF37]/50"
        />
      </div>

      {usersLoading ? <SectionCard><LoadingSkeleton rows={5} /></SectionCard> :
       filteredUsers.length === 0 ? <EmptyState icon={Users} message="No users found." /> : (
        <SectionCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800/60 hover:bg-transparent">
                  <TableHead className="text-gray-500 text-xs uppercase tracking-wider">User</TableHead>
                  <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Joined</TableHead>
                  <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-gray-500 text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: User) => (
                  <TableRow key={user.id} className="border-gray-800/60 hover:bg-gray-900/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-gray-700">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-gray-800 text-gray-400 text-xs">{getUserInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white text-sm font-medium">{getUserDisplayName(user)}</p>
                          <p className="text-gray-600 text-xs">@{user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{user.email}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{formatDate(user.createdAt || new Date())}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={user.isAdmin ? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-xs" : "bg-gray-800 text-gray-400 border border-gray-700 text-xs"}>
                          {user.isAdmin ? "Admin" : "User"}
                        </Badge>
                        {(user as any).accountStatus === "banned" && <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 text-xs">Banned</Badge>}
                        {(user as any).accountStatus === "frozen" && <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs">Frozen</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" onClick={() => setSelectedUser(user)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
