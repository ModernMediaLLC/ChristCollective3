import {
  users,
  campaigns,
  donations,
  businessProfiles,
  membershipTiers,
  contentCreators,
  sponsorshipApplications,
  socialMediaPosts,
  ministryProfiles,
  ministryPosts,
  ministryEvents,
  ministryFollowers,
  ministryPostRsvps,
  ministryPostComments,
  eventRegistrations,
  notifications,
  couponCodes,
  type CouponCode,
  type User,
  type UpsertUser,
  type Campaign,
  type InsertCampaign,
  type Donation,
  type InsertDonation,
  type BusinessProfile,
  type InsertBusinessProfile,
  type MembershipTier,
  type ContentCreator,
  type InsertContentCreator,
  type SponsorshipApplication,
  type InsertSponsorshipApplication,
  type SocialMediaPost,
  type InsertSocialMediaPost,
  type MinistryProfile,
  type InsertMinistryProfile,
  type MinistryPost,
  type InsertMinistryPost,
  type MinistryEvent,
  type InsertMinistryEvent,
  type MinistryFollower,
  type MinistryPostRsvp,
  type InsertMinistryPostRsvp,
  type MinistryPostComment,
  type EventRegistration,
  type Notification,
  type InsertNotification,
  platformPosts,
  postInteractions,
  type PlatformPost,
  type InsertPlatformPost,
  type PostInteraction,
  type InsertPostInteraction,
  userFollows,
  type UserFollow,
  type InsertUserFollow,
  businessFollows,
  type BusinessFollow,
  savedPosts,
  type SavedPost,
  groupChatQueues,
  groupChats,
  groupChatMembers,
  groupChatMessages,
  groupChatEvents,
  groupChatEventAttendees,
  type GroupChatQueue,
  type InsertGroupChatQueue,
  type GroupChat,
  type GroupChatMember,
  type InsertGroupChatMember,
  type GroupChatMessage,
  type InsertGroupChatMessage,
  type GroupChatEvent,
  type InsertGroupChatEvent,
  venues,
  type Venue,
  type InsertVenue,
  matchCircles,
  matchCircleMembers,
  type MatchCircle,
  type InsertMatchCircle,
  directChats,
  directMessages,
  type DirectChat,
  type DirectMessage,
  type InsertDirectMessage,
  passwordResetTokens,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  shopOrders,
  type ShopOrder,
  type InsertShopOrder,
  moneyEventLogs,
  type MoneyEventLog,
  type InsertMoneyEventLog,
  webhookEvents,
  type WebhookEvent,
  type InsertWebhookEvent,
  moderationLogs,
  type ModerationLog,
  type InsertModerationLog,
  postReports,
  type PostReport,
  type InsertPostReport,
  membershipSubscriptions,
  type MembershipSubscription,
  type InsertMembershipSubscription,
  userBlocks,
  type UserBlock,
} from "@shared/schema";
import { db } from "./db";
import { eq, ne, desc, asc, and, or, ilike, like, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { generateSlug } from "./utils";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameInsensitive(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(hashedToken: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User>;
  getUsersCount(): Promise<number>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlockedUserIds(userId: string): Promise<string[]>;
  isUserBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  
  // Stripe related user updates
  updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User>;
  
  // Campaign operations
  createCampaign(campaignData: InsertCampaign & { userId: string }): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaignBySlug(slug: string): Promise<Campaign | undefined>;
  listCampaigns(limit?: number): Promise<Campaign[]>;
  listPendingCampaigns(): Promise<Campaign[]>;
  searchCampaigns(query: string): Promise<Campaign[]>;
  updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign>;
  approveCampaign(id: string): Promise<Campaign>;
  rejectCampaign(id: string): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;
  getUserCampaigns(userId: string): Promise<Campaign[]>;
  
  // Donation operations
  createDonation(donationData: InsertDonation, stripePaymentId: string): Promise<Donation>;
  updateDonationAmount(campaignId: string, amount: number): Promise<Campaign>;
  getCampaignDonations(campaignId: string): Promise<Donation[]>;
  getUserDonations(userId: string): Promise<Donation[]>;
  getAllDonations(): Promise<Donation[]>;
  
  // Business profile operations
  createBusinessProfile(profileData: InsertBusinessProfile & { userId: string }): Promise<BusinessProfile>;
  getBusinessProfile(id: number): Promise<BusinessProfile | undefined>;
  getUserBusinessProfile(userId: string): Promise<BusinessProfile | undefined>;
  updateBusinessProfile(id: number, data: Partial<BusinessProfile>): Promise<BusinessProfile>;
  listBusinessProfiles(): Promise<BusinessProfile[]>;
  
  // Membership tier operations
  getMembershipTier(id: number): Promise<MembershipTier | undefined>;
  listMembershipTiers(): Promise<MembershipTier[]>;
  updateBusinessProfileSubscription(id: number, subscriptionId: string): Promise<BusinessProfile>;
  
  // Content creator operations
  createContentCreator(creatorData: InsertContentCreator & { userId: string }): Promise<ContentCreator>;
  getContentCreator(id: number): Promise<ContentCreator | undefined>;
  getUserContentCreator(userId: string): Promise<ContentCreator | undefined>;
  updateContentCreator(id: number, data: Partial<ContentCreator>): Promise<ContentCreator>;
  listContentCreators(sponsoredOnly?: boolean): Promise<ContentCreator[]>;
  
  // Sponsorship application operations
  createSponsorshipApplication(applicationData: InsertSponsorshipApplication & { userId: string }): Promise<SponsorshipApplication>;
  getSponsorshipApplication(id: number): Promise<SponsorshipApplication | undefined>;
  getUserSponsorshipApplications(userId: string): Promise<SponsorshipApplication[]>;
  listSponsorshipApplications(status?: string): Promise<SponsorshipApplication[]>;
  updateSponsorshipApplication(id: number, data: Partial<SponsorshipApplication>): Promise<SponsorshipApplication>;
  
  // Social media post operations
  createSocialMediaPost(postData: InsertSocialMediaPost & { creatorId: number }): Promise<SocialMediaPost>;
  getSocialMediaPost(id: number): Promise<SocialMediaPost | undefined>;
  getSocialMediaPostsByCreator(creatorId: number): Promise<SocialMediaPost[]>;
  getVisibleSocialMediaPostsByCreator(creatorId: number): Promise<SocialMediaPost[]>;
  clearCreatorPosts(creatorId: number): Promise<void>;
  listSponsoredSocialMediaPosts(): Promise<SocialMediaPost[]>;
  updateSocialMediaPost(id: number, data: Partial<SocialMediaPost>): Promise<SocialMediaPost>;

  // Ministry operations
  createMinistryProfile(profileData: InsertMinistryProfile & { userId: string }): Promise<MinistryProfile>;
  getMinistry(id: number): Promise<MinistryProfile | undefined>;
  getUserMinistryProfile(userId: string): Promise<MinistryProfile | undefined>;
  updateMinistryProfile(id: number, data: Partial<MinistryProfile>): Promise<MinistryProfile>;
  getAllMinistries(): Promise<MinistryProfile[]>;
  getPendingMinistries(): Promise<MinistryProfile[]>;
  deleteMinistryProfile(id: number): Promise<void>;
  
  // Ministry posts operations
  createMinistryPost(postData: InsertMinistryPost & { ministryId: number }): Promise<MinistryPost>;
  getMinistryPosts(ministryId: number): Promise<MinistryPost[]>;
  
  // Ministry events operations
  createMinistryEvent(eventData: InsertMinistryEvent & { ministryId: number }): Promise<MinistryEvent>;
  getMinistryEvents(ministryId: number): Promise<MinistryEvent[]>;
  getMinistryEventById(id: number): Promise<MinistryEvent | undefined>;
  updateMinistryEvent(id: number, data: Partial<InsertMinistryEvent>): Promise<MinistryEvent>;
  deleteMinistryEvent(id: number): Promise<void>;
  updateMinistryPostByEventId(eventId: number, data: { title?: string; content?: string; mediaUrls?: string[] }): Promise<void>;
  getMinistryPostByEventId(eventId: number): Promise<any>;
  
  // Ministry followers operations
  followMinistry(userId: string, ministryId: number): Promise<void>;
  unfollowMinistry(userId: string, ministryId: number): Promise<void>;
  isUserFollowingMinistry(userId: string, ministryId: number): Promise<boolean>;
  getUserFollowedMinistries(userId: string): Promise<MinistryProfile[]>;
  getMinistryFeedPosts(userId: string): Promise<MinistryPost[]>;

  // Platform posts operations
  createPlatformPost(postData: InsertPlatformPost & { userId: string }): Promise<PlatformPost>;
  getPlatformPost(id: number): Promise<PlatformPost | undefined>;
  listPlatformPosts(limit?: number): Promise<PlatformPost[]>;
  getUserPlatformPosts(userId: string): Promise<PlatformPost[]>;
  getUserPosts(userId: string): Promise<PlatformPost[]>; // Alias for getUserPlatformPosts
  updatePlatformPost(id: number, data: Partial<PlatformPost>): Promise<PlatformPost>;
  deletePlatformPost(id: number): Promise<void>;

  // Post interaction operations
  createPostInteraction(interactionData: InsertPostInteraction): Promise<PostInteraction>;
  getPostInteractions(postId: number): Promise<PostInteraction[]>;
  getPostComments(postId: number): Promise<PostInteraction[]>;
  getUserPostInteraction(postId: number, userId: string, type: string): Promise<PostInteraction | undefined>;
  deletePostInteraction(id: number): Promise<void>;

  // User follow operations
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isUserFollowing(followerId: string, followingId: string): Promise<boolean>;
  getUserFollowers(userId: string): Promise<User[]>;
  getUserFollowing(userId: string): Promise<User[]>;
  getUserFollowersCount(userId: string): Promise<number>;
  getUserFollowingCount(userId: string): Promise<number>;
  getFollowedUsersPosts(userId: string, limit?: number): Promise<PlatformPost[]>;

  // Notification operations
  createNotification(notificationData: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: number): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Group chat operations
  createGroupChatQueue(queueData: InsertGroupChatQueue & { creatorId: string }): Promise<GroupChatQueue>;
  getGroupChatQueue(id: number): Promise<GroupChatQueue | undefined>;
  listActiveQueues(): Promise<(GroupChatQueue & { members?: User[] })[]>;
  joinQueue(queueId: number, userId: string): Promise<void>;
  leaveQueue(queueId: number, userId: string): Promise<void>;
  cancelQueue(queueId: number, userId: string): Promise<void>;
  createGroupChatFromQueue(queueId: number): Promise<GroupChat>;
  listActiveChats(): Promise<(GroupChat & { members?: User[] })[]>;
  getUserGroupChats(userId: string): Promise<GroupChat[]>;
  updateGroupChatImages(chatId: number, data: { bannerImage?: string; profileImage?: string }): Promise<GroupChat>;
  updateGroupChatQueueImages(queueId: number, data: { bannerImage?: string; profileImage?: string }): Promise<GroupChatQueue>;
  getGroupChatById(chatId: number): Promise<GroupChat | undefined>;
  getQueueMembers(queueId: number): Promise<User[]>;
  getChatMembers(chatId: number): Promise<User[]>;
  
  // Group chat message operations
  createGroupChatMessage(messageData: InsertGroupChatMessage): Promise<GroupChatMessage>;
  getChatMessages(chatId: number): Promise<(GroupChatMessage & { user: User })[]>;
  deleteGroupChatMessage(id: number): Promise<void>;
  
  // Direct message operations
  getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<DirectChat>;
  getUserDirectChats(userId: string): Promise<(DirectChat & { otherUser: ChatUser | null; lastMessage?: DirectMessage })[]>;
  createDirectMessage(messageData: InsertDirectMessage): Promise<DirectMessage>;
  getDirectChatMessages(chatId: number): Promise<(DirectMessage & { sender: ChatUser | null })[]>;
  markDirectMessageAsRead(messageId: number, userId: string): Promise<void>;
  getUnreadDirectMessagesCount(userId: string): Promise<number>;
  
  // Password reset token operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: number): Promise<void>;
  deleteExpiredTokens(): Promise<void>;
  
  // Shop order operations
  createShopOrder(orderData: InsertShopOrder): Promise<ShopOrder>;
  getShopOrder(id: number): Promise<ShopOrder | undefined>;
  getShopOrderByPaymentIntent(paymentIntentId: string): Promise<ShopOrder | undefined>;
  listShopOrders(): Promise<ShopOrder[]>;
  getUserShopOrders(userId: string): Promise<ShopOrder[]>;
  updateShopOrder(id: number, data: Partial<ShopOrder>): Promise<ShopOrder>;
  
  // Money event log operations (audit trail)
  createMoneyEventLog(eventData: InsertMoneyEventLog): Promise<MoneyEventLog>;
  getMoneyEventLogsByOrder(orderId: number): Promise<MoneyEventLog[]>;
  getMoneyEventLogsByPaymentIntent(paymentIntentId: string): Promise<MoneyEventLog[]>;
  
  // Webhook event operations (deduplication)
  getWebhookEvent(stripeEventId: string): Promise<WebhookEvent | undefined>;
  createWebhookEvent(eventData: InsertWebhookEvent): Promise<WebhookEvent>;
  markWebhookEventProcessed(stripeEventId: string): Promise<void>;

  // Saved post operations
  savePost(userId: string, postId: number): Promise<SavedPost>;
  unsavePost(userId: string, postId: number): Promise<void>;
  isPostSaved(userId: string, postId: number): Promise<boolean>;
  getUserSavedPosts(userId: string): Promise<PlatformPost[]>;

  // Moderation operations
  createModerationLog(logData: InsertModerationLog): Promise<ModerationLog>;
  getModerationLog(id: number): Promise<ModerationLog | undefined>;
  listModerationLogs(options?: { decision?: string; limit?: number; offset?: number }): Promise<ModerationLog[]>;
  updateModerationLog(id: number, data: Partial<ModerationLog>): Promise<ModerationLog>;
  getModerationStats(): Promise<{ total: number; approved: number; flagged: number; rejected: number }>;

  // Post report operations
  createPostReport(reportData: InsertPostReport): Promise<PostReport>;
  getPostReports(postId: number): Promise<PostReport[]>;
  listPostReports(options?: { status?: string; limit?: number; offset?: number }): Promise<PostReport[]>;
  updatePostReport(id: number, data: Partial<PostReport>): Promise<PostReport>;
  hasUserReportedPost(userId: string, postId: number): Promise<boolean>;
  getPostReportStats(): Promise<{ total: number; pending: number; reviewed: number; dismissed: number }>;

  createMembershipSubscription(data: InsertMembershipSubscription): Promise<MembershipSubscription>;
  getMembershipSubscription(id: number): Promise<MembershipSubscription | undefined>;
  getUserMembershipSubscription(userId: string): Promise<MembershipSubscription | undefined>;
  listMembershipSubscriptions(): Promise<MembershipSubscription[]>;
  updateMembershipSubscription(id: number, data: Partial<MembershipSubscription>): Promise<MembershipSubscription>;

  validateCouponCode(code: string): Promise<CouponCode | null>;
  incrementCouponUsage(code: string): Promise<void>;
  seedCouponCode(code: string, discountPercent: number): Promise<void>;
}

// The only user fields a chat partner gets — never birthdate, phone, email, credentials, etc.
const chatUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  firstName: users.firstName,
  lastName: users.lastName,
  profileImageUrl: users.profileImageUrl,
};
export type ChatUser = Pick<User, "id" | "username" | "displayName" | "firstName" | "lastName" | "profileImageUrl">;

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByUsernameInsensitive(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(ilike(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByVerificationToken(hashedToken: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, hashedToken));
    return user || undefined;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0].count);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Members who have submitted a Matchup request (for manual matching by admins).
  async getMatchupRequests(): Promise<Array<Pick<User, "id" | "firstName" | "lastName" | "username" | "email" | "phone" | "birthdate" | "city" | "disciplines" | "interests" | "matchPreference" | "instagram" | "matchupRequest">>> {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email,
        phone: users.phone,
        birthdate: users.birthdate,
        city: users.city,
        disciplines: users.disciplines,
        interests: users.interests,
        matchPreference: users.matchPreference,
        instagram: users.instagram,
        matchupRequest: users.matchupRequest,
      })
      .from(users)
      .where(isNotNull(users.matchupRequest))
      .orderBy(desc(users.updatedAt));
  }

  async deleteUser(id: string): Promise<void> {
    // Delete records from tables without ON DELETE CASCADE first
    await db.delete(postInteractions).where(eq(postInteractions.userId, id));
    await db.delete(savedPosts).where(eq(savedPosts.userId, id));
    await db.delete(userFollows).where(eq(userFollows.followerId, id));
    await db.delete(userFollows).where(eq(userFollows.followingId, id));
    await db.delete(businessFollows).where(eq(businessFollows.userId, id));
    await db.delete(ministryFollowers).where(eq(ministryFollowers.userId, id));
    await db.delete(eventRegistrations).where(eq(eventRegistrations.userId, id));
    await db.delete(ministryPostRsvps).where(eq(ministryPostRsvps.userId, id));
    await db.delete(platformPosts).where(eq(platformPosts.userId, id));
    await db.delete(contentCreators).where(eq(contentCreators.userId, id));
    await db.delete(ministryProfiles).where(eq(ministryProfiles.userId, id));
    await db.delete(sponsorshipApplications).where(eq(sponsorshipApplications.userId, id));
    // Anonymize donations (preserve financial records but remove user link)
    await db.update(donations).set({ userId: null }).where(eq(donations.userId, id));
    // Delete the user (CASCADE handles: passwordResetTokens, businessProfiles, campaigns, notifications)
    await db.delete(users).where(eq(users.id, id));
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.delete(userBlocks).where(
      and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId))
    );
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await db.select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId));
    return blocks.map(b => b.blockedId);
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [block] = await db.select().from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
    return !!block;
  }

  async updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        stripeCustomerId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Campaign operations
  async createCampaign(campaignData: InsertCampaign & { userId: string }): Promise<Campaign> {
    const slug = await generateSlug(campaignData.title);
    
    const [campaign] = await db
      .insert(campaigns)
      .values({
        ...campaignData,
        slug,
        currentAmount: "0",
        isActive: true,
        status: "pending",
      })
      .returning();
    return campaign;
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, slug));
    return campaign;
  }

  async listCampaigns(limit = 100): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.isActive, true), eq(campaigns.status, "approved")))
      .orderBy(desc(campaigns.createdAt))
      .limit(limit);
  }

  async listPendingCampaigns(): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "pending"))
      .orderBy(desc(campaigns.createdAt));
  }

  async searchCampaigns(query: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.isActive, true),
          ilike(campaigns.title, `%${query}%`)
        )
      )
      .orderBy(desc(campaigns.createdAt));
  }

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }
  
  async approveCampaign(id: string): Promise<Campaign> {
    const [approvedCampaign] = await db
      .update(campaigns)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return approvedCampaign;
  }

  async rejectCampaign(id: string): Promise<Campaign> {
    const [rejectedCampaign] = await db
      .update(campaigns)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return rejectedCampaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db
      .delete(campaigns)
      .where(eq(campaigns.id, id));
  }

  // Donation operations
  async createDonation(donationData: InsertDonation, stripePaymentId: string): Promise<Donation> {
    const [donation] = await db
      .insert(donations)
      .values({
        ...donationData,
        stripePaymentId,
      })
      .returning();
    return donation;
  }

  async updateDonationAmount(campaignId: string, amount: number): Promise<Campaign> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    
    if (!campaign) {
      throw new Error("Campaign not found");
    }
    
    const currentAmount = Number(campaign.currentAmount) || 0;
    const newAmount = currentAmount + amount;
    
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ 
        currentAmount: newAmount.toString(),
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId))
      .returning();
      
    return updatedCampaign;
  }

  async getCampaignDonations(campaignId: string): Promise<Donation[]> {
    return await db
      .select()
      .from(donations)
      .where(eq(donations.campaignId, campaignId))
      .orderBy(desc(donations.createdAt));
  }

  async getUserDonations(userId: string): Promise<Donation[]> {
    return await db
      .select()
      .from(donations)
      .where(eq(donations.userId, userId))
      .orderBy(desc(donations.createdAt));
  }

  async getAllDonations(): Promise<Donation[]> {
    return await db
      .select()
      .from(donations)
      .orderBy(desc(donations.createdAt));
  }

  // Business profile operations
  async createBusinessProfile(profileData: InsertBusinessProfile & { userId: string }): Promise<BusinessProfile> {
    const [profile] = await db
      .insert(businessProfiles)
      .values(profileData)
      .returning();
    return profile;
  }

  async getBusinessProfile(id: number): Promise<BusinessProfile | undefined> {
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .leftJoin(membershipTiers, eq(businessProfiles.membershipTierId, membershipTiers.id))
      .where(eq(businessProfiles.id, id));
    
    if (!profile) return undefined;
    
    return {
      ...profile.business_profiles,
      membershipTier: profile.membership_tiers || null,
    } as any;
  }

  async getUserBusinessProfile(userId: string): Promise<BusinessProfile | undefined> {
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));
    return profile;
  }

  async updateBusinessProfile(id: number, data: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const [updatedProfile] = await db
      .update(businessProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businessProfiles.id, id))
      .returning();
    return updatedProfile;
  }

  async deleteBusinessProfile(id: number): Promise<void> {
    await db
      .delete(businessProfiles)
      .where(eq(businessProfiles.id, id));
  }

  async listBusinessProfiles(): Promise<BusinessProfile[]> {
    return await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.isActive, true))
      .orderBy(desc(businessProfiles.createdAt));
  }

  // Membership tier operations
  async getMembershipTier(id: number): Promise<MembershipTier | undefined> {
    const [tier] = await db.select().from(membershipTiers).where(eq(membershipTiers.id, id));
    return tier;
  }

  async listMembershipTiers(): Promise<MembershipTier[]> {
    return await db.select().from(membershipTiers);
  }

  async updateBusinessProfileSubscription(id: number, subscriptionId: string): Promise<BusinessProfile> {
    const [updatedProfile] = await db
      .update(businessProfiles)
      .set({ 
        stripeSubscriptionId: subscriptionId,
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(businessProfiles.id, id))
      .returning();
    return updatedProfile;
  }
  
  // Content creator operations
  async createContentCreator(creatorData: InsertContentCreator & { userId: string }): Promise<ContentCreator> {
    const [creator] = await db
      .insert(contentCreators)
      .values(creatorData)
      .returning();
    return creator;
  }

  async getContentCreator(id: number): Promise<ContentCreator | undefined> {
    const [creator] = await db
      .select()
      .from(contentCreators)
      .where(eq(contentCreators.id, id));
    return creator;
  }

  async getUserContentCreator(userId: string): Promise<ContentCreator | undefined> {
    const [creator] = await db
      .select()
      .from(contentCreators)
      .where(eq(contentCreators.userId, userId));
    return creator;
  }

  async updateContentCreator(id: number, data: Partial<ContentCreator>): Promise<ContentCreator> {
    const [creator] = await db
      .update(contentCreators)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(contentCreators.id, id))
      .returning();
    return creator;
  }

  async listContentCreators(sponsoredOnly = false): Promise<ContentCreator[]> {
    if (sponsoredOnly) {
      return await db
        .select()
        .from(contentCreators)
        .where(eq(contentCreators.isSponsored, true))
        .orderBy(desc(contentCreators.createdAt));
    }
    
    return await db
      .select()
      .from(contentCreators)
      .orderBy(desc(contentCreators.createdAt));
  }

  // Sponsorship application operations
  async createSponsorshipApplication(applicationData: InsertSponsorshipApplication & { userId: string }): Promise<SponsorshipApplication> {
    const [application] = await db
      .insert(sponsorshipApplications)
      .values(applicationData)
      .returning();
    return application;
  }

  async getSponsorshipApplication(id: number): Promise<SponsorshipApplication | undefined> {
    const [application] = await db
      .select()
      .from(sponsorshipApplications)
      .where(eq(sponsorshipApplications.id, id));
    return application;
  }

  async getUserSponsorshipApplications(userId: string): Promise<SponsorshipApplication[]> {
    return await db
      .select()
      .from(sponsorshipApplications)
      .where(eq(sponsorshipApplications.userId, userId));
  }

  async listSponsorshipApplications(status?: string): Promise<SponsorshipApplication[]> {
    if (status) {
      return await db
        .select()
        .from(sponsorshipApplications)
        .where(eq(sponsorshipApplications.status, status))
        .orderBy(desc(sponsorshipApplications.createdAt));
    }
    
    return await db
      .select()
      .from(sponsorshipApplications)
      .orderBy(desc(sponsorshipApplications.createdAt));
  }

  async updateSponsorshipApplication(id: number, data: Partial<SponsorshipApplication>): Promise<SponsorshipApplication> {
    const [application] = await db
      .update(sponsorshipApplications)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(sponsorshipApplications.id, id))
      .returning();
    return application;
  }

  // Social media post operations
  async createSocialMediaPost(postData: InsertSocialMediaPost & { creatorId: number }): Promise<SocialMediaPost> {
    const [post] = await db
      .insert(socialMediaPosts)
      .values(postData)
      .returning();
    return post;
  }

  async getSocialMediaPost(id: number): Promise<SocialMediaPost | undefined> {
    const [post] = await db
      .select()
      .from(socialMediaPosts)
      .where(eq(socialMediaPosts.id, id));
    return post;
  }

  async getSocialMediaPostsByCreator(creatorId: number): Promise<SocialMediaPost[]> {
    return await db
      .select()
      .from(socialMediaPosts)
      .where(eq(socialMediaPosts.creatorId, creatorId))
      .orderBy(desc(socialMediaPosts.postedAt));
  }

  async getVisibleSocialMediaPostsByCreator(creatorId: number): Promise<SocialMediaPost[]> {
    return await db
      .select()
      .from(socialMediaPosts)
      .where(and(
        eq(socialMediaPosts.creatorId, creatorId),
        eq(socialMediaPosts.isVisibleOnProfile, true)
      ))
      .orderBy(desc(socialMediaPosts.postedAt));
  }

  async clearCreatorPosts(creatorId: number): Promise<void> {
    await db
      .delete(socialMediaPosts)
      .where(eq(socialMediaPosts.creatorId, creatorId));
  }

  async listSponsoredSocialMediaPosts(): Promise<SocialMediaPost[]> {
    return await db
      .select()
      .from(socialMediaPosts)
      .where(eq(socialMediaPosts.isSponsored, true))
      .orderBy(desc(socialMediaPosts.postedAt));
  }

  async updateSocialMediaPost(id: number, data: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const [post] = await db
      .update(socialMediaPosts)
      .set(data)
      .where(eq(socialMediaPosts.id, id))
      .returning();
    return post;
  }

  // Ministry operations
  async createMinistryProfile(profileData: InsertMinistryProfile & { userId: string }): Promise<MinistryProfile> {
    const [profile] = await db
      .insert(ministryProfiles)
      .values(profileData)
      .returning();
    return profile;
  }

  async getMinistry(id: number): Promise<MinistryProfile | undefined> {
    const [ministry] = await db
      .select()
      .from(ministryProfiles)
      .where(eq(ministryProfiles.id, id));
    return ministry;
  }

  async getUserMinistryProfile(userId: string): Promise<MinistryProfile | undefined> {
    const [profile] = await db
      .select()
      .from(ministryProfiles)
      .where(eq(ministryProfiles.userId, userId));
    return profile;
  }

  async updateMinistryProfile(id: number, data: Partial<MinistryProfile>): Promise<MinistryProfile> {
    const [profile] = await db
      .update(ministryProfiles)
      .set(data)
      .where(eq(ministryProfiles.id, id))
      .returning();
    return profile;
  }

  async getAllMinistries(): Promise<MinistryProfile[]> {
    return await db
      .select()
      .from(ministryProfiles)
      .where(eq(ministryProfiles.isActive, true))
      .orderBy(desc(ministryProfiles.createdAt));
  }

  async getPendingMinistries(): Promise<MinistryProfile[]> {
    return await db
      .select()
      .from(ministryProfiles)
      .where(eq(ministryProfiles.isActive, false))
      .orderBy(desc(ministryProfiles.createdAt));
  }

  async deleteMinistryProfile(id: number): Promise<void> {
    await db
      .delete(ministryProfiles)
      .where(eq(ministryProfiles.id, id));
  }

  // Ministry posts operations
  async createMinistryPost(postData: InsertMinistryPost & { ministryId: number }): Promise<MinistryPost> {
    const [post] = await db
      .insert(ministryPosts)
      .values(postData)
      .returning();
    return post;
  }

  async getMinistryPosts(ministryId: number): Promise<MinistryPost[]> {
    return await db
      .select()
      .from(ministryPosts)
      .where(and(eq(ministryPosts.ministryId, ministryId), eq(ministryPosts.isPublished, true)))
      .orderBy(desc(ministryPosts.createdAt));
  }

  async getMinistryPostById(postId: number): Promise<any> {
    const [result] = await db
      .select({
        id: ministryPosts.id,
        ministryId: ministryPosts.ministryId,
        eventId: ministryPosts.eventId,
        title: ministryPosts.title,
        content: ministryPosts.content,
        type: ministryPosts.type,
        mediaUrls: ministryPosts.mediaUrls,
        links: ministryPosts.links,
        isPublished: ministryPosts.isPublished,
        createdAt: ministryPosts.createdAt,
        updatedAt: ministryPosts.updatedAt,
        ministry: {
          id: ministryProfiles.id,
          name: ministryProfiles.name,
          logo: ministryProfiles.logo,
          denomination: ministryProfiles.denomination,
        }
      })
      .from(ministryPosts)
      .leftJoin(ministryProfiles, eq(ministryPosts.ministryId, ministryProfiles.id))
      .where(and(eq(ministryPosts.id, postId), eq(ministryPosts.isPublished, true)));
    
    return result || undefined;
  }

  // Ministry events operations
  async createMinistryEvent(eventData: InsertMinistryEvent & { ministryId: number }): Promise<MinistryEvent> {
    const [event] = await db
      .insert(ministryEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async getMinistryEvents(ministryId: number): Promise<MinistryEvent[]> {
    return await db
      .select()
      .from(ministryEvents)
      .where(and(eq(ministryEvents.ministryId, ministryId), eq(ministryEvents.isPublished, true)))
      .orderBy(ministryEvents.startDate);
  }

  async getMinistryEventById(id: number): Promise<MinistryEvent | undefined> {
    const [event] = await db
      .select()
      .from(ministryEvents)
      .where(eq(ministryEvents.id, id));
    return event;
  }

  async updateMinistryEvent(id: number, data: Partial<InsertMinistryEvent>): Promise<MinistryEvent> {
    const [updated] = await db
      .update(ministryEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ministryEvents.id, id))
      .returning();
    return updated;
  }

  async deleteMinistryEvent(id: number): Promise<void> {
    await db.delete(ministryEvents).where(eq(ministryEvents.id, id));
  }

  async updateMinistryPostByEventId(eventId: number, data: { title?: string; content?: string; mediaUrls?: string[] }): Promise<void> {
    await db
      .update(ministryPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ministryPosts.eventId, eventId));
  }

  async getMinistryPostByEventId(eventId: number): Promise<any> {
    const [result] = await db
      .select({
        id: ministryPosts.id,
        ministryId: ministryPosts.ministryId,
        eventId: ministryPosts.eventId,
        title: ministryPosts.title,
        content: ministryPosts.content,
        type: ministryPosts.type,
        mediaUrls: ministryPosts.mediaUrls,
        links: ministryPosts.links,
        isPublished: ministryPosts.isPublished,
        createdAt: ministryPosts.createdAt,
        updatedAt: ministryPosts.updatedAt,
        ministry: {
          id: ministryProfiles.id,
          name: ministryProfiles.name,
          logo: ministryProfiles.logo,
          denomination: ministryProfiles.denomination,
        }
      })
      .from(ministryPosts)
      .leftJoin(ministryProfiles, eq(ministryPosts.ministryId, ministryProfiles.id))
      .where(eq(ministryPosts.eventId, eventId));
    return result;
  }

  // Ministry followers operations
  async followMinistry(userId: string, ministryId: number): Promise<void> {
    await db
      .insert(ministryFollowers)
      .values({ userId, ministryId })
      .onConflictDoNothing();
  }

  async unfollowMinistry(userId: string, ministryId: number): Promise<void> {
    await db
      .delete(ministryFollowers)
      .where(and(eq(ministryFollowers.userId, userId), eq(ministryFollowers.ministryId, ministryId)));
  }

  async autoFollowChristCollectiveMinistry(userId: string): Promise<void> {
    const CHRIST_COLLECTIVE_MINISTRY_ID = 1; // ID of Christ Collective Ministry profile
    try {
      await db
        .insert(ministryFollowers)
        .values({ userId, ministryId: CHRIST_COLLECTIVE_MINISTRY_ID })
        .onConflictDoNothing();
    } catch (error) {
      console.error('Failed to auto-follow Christ Collective Ministry:', error);
    }
  }

  async makeAllUsersFollowChristCollective(): Promise<void> {
    const CHRIST_COLLECTIVE_MINISTRY_ID = 1;
    try {
      // Get all users who are not already following Christ Collective
      const usersNotFollowing = await db
        .select({ id: users.id })
        .from(users)
        .leftJoin(ministryFollowers, 
          and(
            eq(ministryFollowers.userId, users.id),
            eq(ministryFollowers.ministryId, CHRIST_COLLECTIVE_MINISTRY_ID)
          )
        )
        .where(isNull(ministryFollowers.id));

      // Add follows for all users who aren't already following
      if (usersNotFollowing.length > 0) {
        const followValues = usersNotFollowing.map(user => ({
          userId: user.id,
          ministryId: CHRIST_COLLECTIVE_MINISTRY_ID
        }));
        
        await db
          .insert(ministryFollowers)
          .values(followValues)
          .onConflictDoNothing();
        
        console.log(`Auto-followed Christ Collective Ministry for ${followValues.length} users`);
      }
    } catch (error) {
      console.error('Failed to make all users follow Christ Collective:', error);
      throw error;
    }
  }

  // Ministry post RSVP operations
  async createOrUpdateRsvp(userId: string, postId: number, status: string, notes?: string, plusOnes?: number): Promise<MinistryPostRsvp> {
    const [rsvp] = await db
      .insert(ministryPostRsvps)
      .values({ userId, postId, status, notes, plusOnes: plusOnes ?? 0 })
      .onConflictDoUpdate({
        target: [ministryPostRsvps.userId, ministryPostRsvps.postId],
        set: { status, notes, plusOnes: plusOnes ?? 0, updatedAt: new Date() }
      })
      .returning();
    return rsvp;
  }

  async getRsvpByUserAndPost(userId: string, postId: number): Promise<MinistryPostRsvp | undefined> {
    const [rsvp] = await db
      .select()
      .from(ministryPostRsvps)
      .where(and(eq(ministryPostRsvps.userId, userId), eq(ministryPostRsvps.postId, postId)));
    return rsvp;
  }

  async getRsvpsForPost(postId: number): Promise<{ status: string; count: number; totalGuests: number }[]> {
    const result = await db
      .select({
        status: ministryPostRsvps.status,
        count: sql<number>`count(*)::int`,
        totalGuests: sql<number>`sum(${ministryPostRsvps.plusOnes})::int`
      })
      .from(ministryPostRsvps)
      .where(eq(ministryPostRsvps.postId, postId))
      .groupBy(ministryPostRsvps.status);
    return result;
  }

  async deleteRsvp(userId: string, postId: number): Promise<void> {
    await db
      .delete(ministryPostRsvps)
      .where(and(eq(ministryPostRsvps.userId, userId), eq(ministryPostRsvps.postId, postId)));
  }

  async getMinistryPostAttendees(postId: number): Promise<Array<{
    userId: string; status: string; plusOnes: number;
    username: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null;
  }>> {
    const rows = await db
      .select({
        userId: ministryPostRsvps.userId,
        status: ministryPostRsvps.status,
        plusOnes: ministryPostRsvps.plusOnes,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(ministryPostRsvps)
      .innerJoin(users, eq(ministryPostRsvps.userId, users.id))
      .where(and(
        eq(ministryPostRsvps.postId, postId),
        sql`${ministryPostRsvps.status} IN ('going', 'maybe')`
      ))
      .orderBy(desc(ministryPostRsvps.createdAt));
    return rows;
  }

  // Ministry post comment operations
  async createMinistryPostComment(userId: string, postId: number, content: string): Promise<MinistryPostComment> {
    const [comment] = await db
      .insert(ministryPostComments)
      .values({ userId, postId, content })
      .returning();
    return comment;
  }

  async getMinistryPostComments(postId: number): Promise<Array<MinistryPostComment & {
    username: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null;
  }>> {
    const rows = await db
      .select({
        id: ministryPostComments.id,
        postId: ministryPostComments.postId,
        userId: ministryPostComments.userId,
        content: ministryPostComments.content,
        createdAt: ministryPostComments.createdAt,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(ministryPostComments)
      .innerJoin(users, eq(ministryPostComments.userId, users.id))
      .where(eq(ministryPostComments.postId, postId))
      .orderBy(asc(ministryPostComments.createdAt));
    return rows;
  }

  async deleteMinistryPostComment(commentId: number): Promise<void> {
    await db.delete(ministryPostComments).where(eq(ministryPostComments.id, commentId));
  }

  async getMinistryPostComment(commentId: number): Promise<MinistryPostComment | undefined> {
    const [comment] = await db
      .select()
      .from(ministryPostComments)
      .where(eq(ministryPostComments.id, commentId));
    return comment;
  }

  async isUserFollowingMinistry(userId: string, ministryId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(ministryFollowers)
      .where(and(eq(ministryFollowers.userId, userId), eq(ministryFollowers.ministryId, ministryId)));
    return !!result;
  }

  async getUserFollowedMinistries(userId: string): Promise<MinistryProfile[]> {
    return await db
      .select({
        id: ministryProfiles.id,
        userId: ministryProfiles.userId,
        name: ministryProfiles.name,
        description: ministryProfiles.description,
        denomination: ministryProfiles.denomination,
        website: ministryProfiles.website,
        logo: ministryProfiles.logo,
        location: ministryProfiles.location,
        address: ministryProfiles.address,
        phone: ministryProfiles.phone,
        email: ministryProfiles.email,
        socialLinks: ministryProfiles.socialLinks,
        isActive: ministryProfiles.isActive,
        isVerified: ministryProfiles.isVerified,
        createdAt: ministryProfiles.createdAt,
        updatedAt: ministryProfiles.updatedAt,
      })
      .from(ministryProfiles)
      .innerJoin(ministryFollowers, eq(ministryFollowers.ministryId, ministryProfiles.id))
      .where(eq(ministryFollowers.userId, userId))
      .orderBy(desc(ministryFollowers.createdAt));
  }

  async getMinistryFollowersCount(ministryId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(ministryFollowers)
      .where(eq(ministryFollowers.ministryId, ministryId));
    return Number(result[0].count);
  }

  async getMinistryFeedPosts(userId: string): Promise<MinistryPost[]> {
    return await db
      .select({
        id: ministryPosts.id,
        ministryId: ministryPosts.ministryId,
        eventId: ministryPosts.eventId,
        title: ministryPosts.title,
        content: ministryPosts.content,
        type: ministryPosts.type,
        mediaUrls: ministryPosts.mediaUrls,
        links: ministryPosts.links,
        isPublished: ministryPosts.isPublished,
        createdAt: ministryPosts.createdAt,
        updatedAt: ministryPosts.updatedAt,
        ministry: {
          id: ministryProfiles.id,
          name: ministryProfiles.name,
          logo: ministryProfiles.logo,
          denomination: ministryProfiles.denomination,
        }
      })
      .from(ministryPosts)
      .innerJoin(ministryFollowers, eq(ministryFollowers.ministryId, ministryPosts.ministryId))
      .innerJoin(ministryProfiles, eq(ministryProfiles.id, ministryPosts.ministryId))
      .where(and(
        eq(ministryFollowers.userId, userId),
        eq(ministryPosts.isPublished, true)
      ))
      .orderBy(desc(ministryPosts.createdAt));
  }

  // Platform posts operations
  async createPlatformPost(postData: InsertPlatformPost & { userId: string }): Promise<PlatformPost> {
    const [post] = await db
      .insert(platformPosts)
      .values(postData)
      .returning();
    return post;
  }

  async getPlatformPost(id: number): Promise<PlatformPost | undefined> {
    const [post] = await db
      .select()
      .from(platformPosts)
      .where(eq(platformPosts.id, id));
    return post;
  }

  async listPlatformPosts(limit = 50): Promise<PlatformPost[]> {
    return await db
      .select()
      .from(platformPosts)
      .where(eq(platformPosts.isPublished, true))
      .orderBy(desc(platformPosts.createdAt))
      .limit(limit);
  }

  async getUserPlatformPosts(userId: string): Promise<PlatformPost[]> {
    return await db
      .select()
      .from(platformPosts)
      .where(eq(platformPosts.userId, userId))
      .orderBy(desc(platformPosts.createdAt));
  }

  // Alias method for getUserPlatformPosts
  async getUserPosts(userId: string): Promise<PlatformPost[]> {
    return this.getUserPlatformPosts(userId);
  }

  async updatePlatformPost(id: number, data: Partial<PlatformPost>): Promise<PlatformPost> {
    const [post] = await db
      .update(platformPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(platformPosts.id, id))
      .returning();
    return post;
  }

  async deletePlatformPost(id: number): Promise<void> {
    await db.delete(postInteractions).where(eq(postInteractions.postId, id));
    await db.delete(savedPosts).where(eq(savedPosts.postId, id));
    await db.delete(postReports).where(eq(postReports.postId, id));
    await db.delete(platformPosts).where(eq(platformPosts.id, id));
  }

  // Post interaction operations
  async createPostInteraction(interactionData: InsertPostInteraction): Promise<PostInteraction> {
    const [interaction] = await db
      .insert(postInteractions)
      .values(interactionData)
      .returning();
    return interaction;
  }

  async getPostInteractions(postId: number): Promise<PostInteraction[]> {
    return await db
      .select()
      .from(postInteractions)
      .where(eq(postInteractions.postId, postId))
      .orderBy(desc(postInteractions.createdAt));
  }

  async getPostComments(postId: number): Promise<PostInteraction[]> {
    return await db
      .select({
        id: postInteractions.id,
        postId: postInteractions.postId,
        userId: postInteractions.userId,
        type: postInteractions.type,
        content: postInteractions.content,
        createdAt: postInteractions.createdAt,
        user: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(postInteractions)
      .leftJoin(users, eq(postInteractions.userId, users.id))
      .where(and(
        eq(postInteractions.postId, postId),
        eq(postInteractions.type, 'comment')
      ))
      .orderBy(desc(postInteractions.createdAt));
  }

  async getUserPostInteraction(postId: number, userId: string, type: string): Promise<PostInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(postInteractions)
      .where(and(
        eq(postInteractions.postId, postId),
        eq(postInteractions.userId, userId),
        eq(postInteractions.type, type)
      ));
    return interaction;
  }

  async deletePostInteraction(id: number): Promise<void> {
    await db
      .delete(postInteractions)
      .where(eq(postInteractions.id, id));
  }

  async getPostComment(id: number): Promise<PostInteraction | undefined> {
    const [comment] = await db
      .select()
      .from(postInteractions)
      .where(and(
        eq(postInteractions.id, id),
        eq(postInteractions.type, 'comment')
      ));
    return comment;
  }

  async deletePostComment(id: number): Promise<void> {
    await db
      .delete(postInteractions)
      .where(and(
        eq(postInteractions.id, id),
        eq(postInteractions.type, 'comment')
      ));
  }

  // User follow operations
  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const [follow] = await db
      .insert(userFollows)
      .values({ followerId, followingId })
      .onConflictDoNothing()
      .returning();
    
    // Create notification for follow
    if (follow) {
      await this.createNotificationForFollow(followerId, followingId);
    }
    
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
  }

  async isUserFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(userFollows)
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
    return !!follow;
  }

  async getUserFollowers(userId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        bio: users.bio,
        location: users.location,
        username: users.username,
        userType: users.userType,
        showEmail: users.showEmail,
        showPhone: users.showPhone,
        showLocation: users.showLocation,
      })
      .from(users)
      .innerJoin(userFollows, eq(userFollows.followerId, users.id))
      .where(eq(userFollows.followingId, userId))
      .orderBy(desc(userFollows.createdAt));
  }

  async getUserFollowing(userId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        bio: users.bio,
        location: users.location,
        username: users.username,
        userType: users.userType,
        showEmail: users.showEmail,
        showPhone: users.showPhone,
        showLocation: users.showLocation,
      })
      .from(users)
      .innerJoin(userFollows, eq(userFollows.followingId, users.id))
      .where(eq(userFollows.followerId, userId))
      .orderBy(desc(userFollows.createdAt));
  }

  async getUserFollowersCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId));
    return Number(result[0].count);
  }

  async getUserFollowingCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));
    return Number(result[0].count);
  }

  async getFollowedUsersPosts(userId: string, limit = 50): Promise<PlatformPost[]> {
    return await db
      .select({
        id: platformPosts.id,
        userId: platformPosts.userId,
        createdAt: platformPosts.createdAt,
        updatedAt: platformPosts.updatedAt,
        title: platformPosts.title,
        content: platformPosts.content,
        authorType: platformPosts.authorType,
        authorId: platformPosts.authorId,
        mediaUrls: platformPosts.mediaUrls,
        mediaType: platformPosts.mediaType,
        tags: platformPosts.tags,
        isPublished: platformPosts.isPublished,
        likesCount: platformPosts.likesCount,
        commentsCount: platformPosts.commentsCount,
        sharesCount: platformPosts.sharesCount,
      })
      .from(platformPosts)
      .innerJoin(userFollows, eq(userFollows.followingId, platformPosts.userId))
      .where(and(eq(userFollows.followerId, userId), eq(platformPosts.isPublished, true)))
      .orderBy(desc(platformPosts.createdAt))
      .limit(limit);
  }
  // Business follow operations
  async followBusiness(userId: string, businessId: number): Promise<BusinessFollow> {
    const [follow] = await db
      .insert(businessFollows)
      .values({ userId, businessId })
      .onConflictDoNothing()
      .returning();
    return follow;
  }

  async unfollowBusiness(userId: string, businessId: number): Promise<void> {
    await db
      .delete(businessFollows)
      .where(and(
        eq(businessFollows.userId, userId), 
        eq(businessFollows.businessId, businessId)
      ));
  }

  async isBusinessFollowing(userId: string, businessId: number): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(businessFollows)
      .where(and(
        eq(businessFollows.userId, userId), 
        eq(businessFollows.businessId, businessId)
      ));
    return !!follow;
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: number): Promise<void> {
    await db
      .delete(notifications)
      .where(eq(notifications.id, id));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return Number(result[0].count);
  }

  // Group chat operations
  async createGroupChatQueue(queueData: InsertGroupChatQueue & { creatorId: string }): Promise<GroupChatQueue> {
    const [queue] = await db
      .insert(groupChatQueues)
      .values({
        ...queueData,
        currentCount: 1, // Creator is first member
      })
      .returning();

    // Add creator to queue members
    await db.insert(groupChatMembers).values({
      queueId: queue.id,
      userId: queueData.creatorId,
      role: "creator",
    });

    return queue;
  }

  async getGroupChatQueue(id: number): Promise<GroupChatQueue | undefined> {
    const [queue] = await db
      .select()
      .from(groupChatQueues)
      .where(eq(groupChatQueues.id, id));
    return queue;
  }

  async listActiveQueues(): Promise<(GroupChatQueue & { members?: User[] })[]> {
    const queues = await db
      .select()
      .from(groupChatQueues)
      .where(eq(groupChatQueues.status, "waiting"))
      .orderBy(desc(groupChatQueues.createdAt));

    // For each queue, fetch member profile information
    const queuesWithMembers = await Promise.all(
      queues.map(async (queue) => {
        const members = await this.getQueueMembers(queue.id);
        return { ...queue, members };
      })
    );

    return queuesWithMembers;
  }



  async joinQueue(queueId: number, userId: string): Promise<void> {
    // Check if user already in queue
    const existing = await db
      .select()
      .from(groupChatMembers)
      .where(and(
        eq(groupChatMembers.queueId, queueId),
        eq(groupChatMembers.userId, userId)
      ));

    if (existing.length > 0) return;

    // Get queue info
    const queue = await this.getGroupChatQueue(queueId);
    if (!queue || queue.currentCount >= queue.maxPeople) return;

    // Add member
    await db.insert(groupChatMembers).values({
      queueId,
      userId,
      role: "member",
    });

    // Update current count
    const newCount = queue.currentCount + 1;
    await db
      .update(groupChatQueues)
      .set({ 
        currentCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(groupChatQueues.id, queueId));

    // If we've reached the minimum, create the chat
    if (newCount >= queue.minPeople) {
      await this.createGroupChatFromQueue(queueId);
    }
  }

  async leaveQueue(queueId: number, userId: string): Promise<void> {
    await db
      .delete(groupChatMembers)
      .where(and(
        eq(groupChatMembers.queueId, queueId),
        eq(groupChatMembers.userId, userId)
      ));

    // Update current count
    const queue = await this.getGroupChatQueue(queueId);
    if (queue) {
      await db
        .update(groupChatQueues)
        .set({ 
          currentCount: Math.max(0, queue.currentCount - 1),
          updatedAt: new Date(),
        })
        .where(eq(groupChatQueues.id, queueId));
    }
  }

  async cancelQueue(queueId: number, userId: string): Promise<void> {
    // Only creator can cancel
    const queue = await this.getGroupChatQueue(queueId);
    if (queue && queue.creatorId === userId) {
      await db
        .update(groupChatQueues)
        .set({ 
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(groupChatQueues.id, queueId));

      // Remove all members
      await db
        .delete(groupChatMembers)
        .where(eq(groupChatMembers.queueId, queueId));
    }
  }

  async createGroupChatFromQueue(queueId: number): Promise<GroupChat> {
    const queue = await this.getGroupChatQueue(queueId);
    if (!queue) throw new Error("Queue not found");

    const [chat] = await db
      .insert(groupChats)
      .values({
        queueId,
        title: queue.title,
        description: queue.description,
        intention: queue.intention,
        memberCount: queue.currentCount,
        bannerImage: queue.bannerImage,
        profileImage: queue.profileImage,
      })
      .returning();

    // Update queue members to reference the chat
    await db
      .update(groupChatMembers)
      .set({ chatId: chat.id })
      .where(eq(groupChatMembers.queueId, queueId));

    // Update queue status
    await db
      .update(groupChatQueues)
      .set({ 
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(groupChatQueues.id, queueId));

    return chat;
  }

  async listActiveChats(): Promise<(GroupChat & { members?: User[] })[]> {
    const chats = await db
      .select()
      .from(groupChats)
      .where(eq(groupChats.status, "active"))
      .orderBy(desc(groupChats.createdAt));

    // For each chat, fetch member profile information
    const chatsWithMembers = await Promise.all(
      chats.map(async (chat) => {
        const members = await this.getChatMembers(chat.id);
        return { ...chat, members };
      })
    );

    return chatsWithMembers;
  }

  async getUserGroupChats(userId: string): Promise<GroupChat[]> {
    return db
      .select({
        id: groupChats.id,
        queueId: groupChats.queueId,
        title: groupChats.title,
        description: groupChats.description,
        intention: groupChats.intention,
        memberCount: groupChats.memberCount,
        status: groupChats.status,
        bannerImage: groupChats.bannerImage,
        profileImage: groupChats.profileImage,
        location: groupChats.location,
        meetingFrequency: groupChats.meetingFrequency,
        createdAt: groupChats.createdAt,
        updatedAt: groupChats.updatedAt,
      })
      .from(groupChats)
      .innerJoin(groupChatMembers, eq(groupChats.id, groupChatMembers.chatId))
      .where(eq(groupChatMembers.userId, userId));
  }

  async getQueueMembers(queueId: number): Promise<User[]> {
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        bio: users.bio,
        location: users.location,
        username: users.username,
        userType: users.userType,
        showEmail: users.showEmail,
        showPhone: users.showPhone,
        showLocation: users.showLocation,
      })
      .from(users)
      .innerJoin(groupChatMembers, eq(users.id, groupChatMembers.userId))
      .where(eq(groupChatMembers.queueId, queueId));
  }

  async getGroupChatById(chatId: number): Promise<GroupChat | undefined> {
    const [chat] = await db
      .select()
      .from(groupChats)
      .where(eq(groupChats.id, chatId));
    return chat;
  }

  async getChatMembers(chatId: number): Promise<User[]> {
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        username: users.username,
        bio: users.bio,
        location: users.location,
        userType: users.userType,
        showEmail: users.showEmail,
        showPhone: users.showPhone,
        showLocation: users.showLocation,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .innerJoin(groupChatMembers, eq(users.id, groupChatMembers.userId))
      .where(eq(groupChatMembers.chatId, chatId));
  }

  // ---- Club profile helpers (dedicated club profile page) ----

  async getGroupChatQueueById(queueId: number): Promise<GroupChatQueue | undefined> {
    const [queue] = await db.select().from(groupChatQueues).where(eq(groupChatQueues.id, queueId));
    return queue;
  }

  // Members of a club, with role + light community profile, for the members row.
  // `by` selects whether we match on the forming queue or the active chat.
  private async getClubMembers(by: "queueId" | "chatId", id: number) {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        username: users.username,
        profileImageUrl: users.profileImageUrl,
        disciplines: users.disciplines,
        bio: users.bio,
        role: groupChatMembers.role,
        joinedAt: groupChatMembers.joinedAt,
      })
      .from(groupChatMembers)
      .innerJoin(users, eq(users.id, groupChatMembers.userId))
      .where(by === "queueId" ? eq(groupChatMembers.queueId, id) : eq(groupChatMembers.chatId, id));
    // Host (creator) first, then by join order.
    return rows.sort((a, b) => (a.role === "creator" ? -1 : b.role === "creator" ? 1 : 0));
  }

  getClubMembersByQueue(queueId: number) { return this.getClubMembers("queueId", queueId); }
  getClubMembersByChat(chatId: number) { return this.getClubMembers("chatId", chatId); }

  async getClubEvents(queueId: number) {
    const events = await db
      .select()
      .from(groupChatEvents)
      .where(and(eq(groupChatEvents.queueId, queueId), eq(groupChatEvents.status, "scheduled")))
      .orderBy(desc(groupChatEvents.eventDate));
    return Promise.all(
      events.map(async (ev) => {
        const attendees = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            displayName: users.displayName,
            username: users.username,
            profileImageUrl: users.profileImageUrl,
            status: groupChatEventAttendees.status,
          })
          .from(groupChatEventAttendees)
          .innerJoin(users, eq(users.id, groupChatEventAttendees.userId))
          .where(eq(groupChatEventAttendees.eventId, ev.id));
        return { ...ev, attendees, goingCount: attendees.filter((a) => a.status === "going").length };
      }),
    );
  }

  async getClubEventById(eventId: number): Promise<GroupChatEvent | undefined> {
    const [ev] = await db.select().from(groupChatEvents).where(eq(groupChatEvents.id, eventId));
    return ev;
  }

  async createClubEvent(data: InsertGroupChatEvent & { createdBy: string }): Promise<GroupChatEvent> {
    const [ev] = await db.insert(groupChatEvents).values(data as any).returning();
    if (ev) {
      await db.insert(groupChatEventAttendees).values({ eventId: ev.id, userId: data.createdBy, status: "going" });
    }
    return ev;
  }

  async rsvpClubEvent(eventId: number, userId: string, status: string) {
    const existing = await db
      .select()
      .from(groupChatEventAttendees)
      .where(and(eq(groupChatEventAttendees.eventId, eventId), eq(groupChatEventAttendees.userId, userId)));
    if (existing.length) {
      const [row] = await db
        .update(groupChatEventAttendees)
        .set({ status })
        .where(and(eq(groupChatEventAttendees.eventId, eventId), eq(groupChatEventAttendees.userId, userId)))
        .returning();
      return row;
    }
    const [row] = await db.insert(groupChatEventAttendees).values({ eventId, userId, status }).returning();
    return row;
  }

  // Host-editable club details (location / meeting frequency / description). Mirrors to the
  // active chat too so the profile is consistent whichever entity is being viewed.
  async updateClubDetails(queueId: number, data: { location?: string; meetingFrequency?: string; description?: string }): Promise<GroupChatQueue> {
    const set: Record<string, any> = {};
    if (data.location !== undefined) set.location = data.location;
    if (data.meetingFrequency !== undefined) set.meetingFrequency = data.meetingFrequency;
    if (data.description !== undefined) set.description = data.description;
    const [queue] = await db.update(groupChatQueues).set(set).where(eq(groupChatQueues.id, queueId)).returning();
    await db.update(groupChats).set(set).where(eq(groupChats.queueId, queueId));
    return queue;
  }

  // ---- Venue directory ----
  async getVenues(filter?: { area?: string; activityType?: string }): Promise<Venue[]> {
    const conds: any[] = [];
    if (filter?.area) conds.push(eq(venues.area, filter.area));
    if (filter?.activityType) conds.push(eq(venues.activityType, filter.activityType));
    const rows = conds.length
      ? await db.select().from(venues).where(and(...conds))
      : await db.select().from(venues);
    return rows.sort((a, b) => a.activityType.localeCompare(b.activityType) || a.sortOrder - b.sortOrder);
  }
  async createVenue(data: InsertVenue): Promise<Venue> {
    const [v] = await db.insert(venues).values(data as any).returning();
    return v;
  }
  async updateVenue(id: number, data: Partial<InsertVenue>): Promise<Venue> {
    const [v] = await db.update(venues).set({ ...data, updatedAt: new Date() } as any).where(eq(venues.id, id)).returning();
    return v;
  }
  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues).where(eq(venues.id, id));
  }

  // ---- Leads CRM + matching circles ----
  // Leads = members who onboarded or requested a matchup, with the fields we match on.
  async getLeads() {
    return db
      .select({
        id: users.id, firstName: users.firstName, lastName: users.lastName,
        displayName: users.displayName, username: users.username, email: users.email,
        phone: users.phone, profileImageUrl: users.profileImageUrl, birthdate: users.birthdate,
        city: users.city, disciplines: users.disciplines, interests: users.interests,
        matchPreference: users.matchPreference, instagram: users.instagram,
        onboardingCompleted: users.onboardingCompleted, matchupRequest: users.matchupRequest,
        waitlisted: users.waitlisted, createdAt: users.createdAt,
      })
      .from(users)
      .where(or(eq(users.onboardingCompleted, true), isNotNull(users.matchupRequest)))
      .orderBy(desc(users.createdAt));
  }

  async getMatchCircles(cycle?: string) {
    const circles = cycle
      ? await db.select().from(matchCircles).where(eq(matchCircles.cycle, cycle)).orderBy(desc(matchCircles.createdAt))
      : await db.select().from(matchCircles).orderBy(desc(matchCircles.createdAt));
    return Promise.all(circles.map(async (c) => {
      const members = await db
        .select({
          id: users.id, firstName: users.firstName, lastName: users.lastName,
          displayName: users.displayName, username: users.username, profileImageUrl: users.profileImageUrl,
          city: users.city, disciplines: users.disciplines, phone: users.phone, email: users.email,
          birthdate: users.birthdate,
        })
        .from(matchCircleMembers)
        .innerJoin(users, eq(users.id, matchCircleMembers.userId))
        .where(eq(matchCircleMembers.circleId, c.id));
      return { ...c, members };
    }));
  }
  async createMatchCircle(data: InsertMatchCircle): Promise<MatchCircle> {
    const [c] = await db.insert(matchCircles).values(data as any).returning();
    return c;
  }
  async updateMatchCircle(id: number, data: Partial<InsertMatchCircle> & { status?: string }): Promise<MatchCircle> {
    const [c] = await db.update(matchCircles).set({ ...data, updatedAt: new Date() } as any).where(eq(matchCircles.id, id)).returning();
    return c;
  }
  async deleteMatchCircle(id: number): Promise<void> {
    await db.delete(matchCircles).where(eq(matchCircles.id, id));
  }
  // Assign a lead to a circle. Buckets stay exclusive within a cycle: the lead is first
  // removed from any circle in the same cycle (which also dedupes the target circle).
  async assignLeadToCircle(circleId: number, userId: string): Promise<void> {
    const [circle] = await db.select().from(matchCircles).where(eq(matchCircles.id, circleId));
    if (!circle) return;
    if (circle.cycle) {
      const siblings = await db.select({ id: matchCircles.id }).from(matchCircles).where(eq(matchCircles.cycle, circle.cycle));
      for (const s of siblings) {
        await db.delete(matchCircleMembers).where(and(eq(matchCircleMembers.circleId, s.id), eq(matchCircleMembers.userId, userId)));
      }
    } else {
      await db.delete(matchCircleMembers).where(and(eq(matchCircleMembers.circleId, circleId), eq(matchCircleMembers.userId, userId)));
    }
    await db.insert(matchCircleMembers).values({ circleId, userId });
  }
  async removeLeadFromCircle(circleId: number, userId: string): Promise<void> {
    await db.delete(matchCircleMembers).where(and(eq(matchCircleMembers.circleId, circleId), eq(matchCircleMembers.userId, userId)));
  }

  // A member's "meetups" = the match circles they belong to, with co-members + venue.
  // Draft circles are admin-only (auto-group proposals) — members see a circle once it's confirmed.
  async getUserMeetups(userId: string) {
    const rows = await db.select({ circleId: matchCircleMembers.circleId }).from(matchCircleMembers).where(eq(matchCircleMembers.userId, userId));
    const ids = Array.from(new Set(rows.map((r) => r.circleId)));
    if (!ids.length) return [];
    const circles = await db.select().from(matchCircles)
      .where(and(inArray(matchCircles.id, ids), ne(matchCircles.status, "draft")))
      .orderBy(desc(matchCircles.createdAt));
    return Promise.all(circles.map(async (c) => {
      const members = await db
        .select({
          id: users.id, firstName: users.firstName, lastName: users.lastName,
          displayName: users.displayName, username: users.username, profileImageUrl: users.profileImageUrl,
          city: users.city, disciplines: users.disciplines,
        })
        .from(matchCircleMembers)
        .innerJoin(users, eq(users.id, matchCircleMembers.userId))
        .where(eq(matchCircleMembers.circleId, c.id));
      let venue: any = null;
      if (c.venueId) {
        const [v] = await db.select({ id: venues.id, name: venues.name, imageUrl: venues.imageUrl, neighborhood: venues.neighborhood, activityType: venues.activityType })
          .from(venues).where(eq(venues.id, c.venueId));
        venue = v || null;
      }
      return { ...c, members, venue };
    }));
  }

  async updateGroupChatImages(chatId: number, data: { bannerImage?: string; profileImage?: string }): Promise<GroupChat> {
    const updateData: Record<string, any> = {};
    if (data.bannerImage !== undefined) updateData.bannerImage = data.bannerImage;
    if (data.profileImage !== undefined) updateData.profileImage = data.profileImage;
    const [chat] = await db
      .update(groupChats)
      .set(updateData)
      .where(eq(groupChats.id, chatId))
      .returning();
    return chat;
  }

  async updateGroupChatQueueImages(queueId: number, data: { bannerImage?: string; profileImage?: string }): Promise<GroupChatQueue> {
    const updateData: Record<string, any> = {};
    if (data.bannerImage !== undefined) updateData.bannerImage = data.bannerImage;
    if (data.profileImage !== undefined) updateData.profileImage = data.profileImage;
    const [queue] = await db
      .update(groupChatQueues)
      .set(updateData)
      .where(eq(groupChatQueues.id, queueId))
      .returning();
    return queue;
  }

  // Group chat message operations
  async createGroupChatMessage(messageData: InsertGroupChatMessage): Promise<GroupChatMessage> {
    const [message] = await db
      .insert(groupChatMessages)
      .values(messageData)
      .returning();
    
    // Create notifications for chat message
    if (message) {
      await this.createNotificationForChatMessage(message.userId, message.chatId, message.message);
    }
    
    return message;
  }

  async getChatMessages(chatId: number): Promise<(GroupChatMessage & { user: User })[]> {
    return db
      .select({
        id: groupChatMessages.id,
        chatId: groupChatMessages.chatId,
        userId: groupChatMessages.userId,
        message: groupChatMessages.message,
        type: groupChatMessages.type,
        createdAt: groupChatMessages.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: users.displayName,
          profileImageUrl: users.profileImageUrl,
          username: users.username,
          bio: users.bio,
          location: users.location,
          userType: users.userType,
          showEmail: users.showEmail,
          showPhone: users.showPhone,
          showLocation: users.showLocation,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          isAdmin: users.isAdmin,
        }
      })
      .from(groupChatMessages)
      .innerJoin(users, eq(groupChatMessages.userId, users.id))
      .where(eq(groupChatMessages.chatId, chatId))
      .orderBy(groupChatMessages.createdAt);
  }

  async deleteGroupChatMessage(id: number): Promise<void> {
    await db
      .delete(groupChatMessages)
      .where(eq(groupChatMessages.id, id));
  }

  // Notification helper functions
  async createNotificationForFollow(followerId: string, followingId: string): Promise<void> {
    // Get follower details
    const follower = await this.getUser(followerId);
    if (!follower) return;

    await this.createNotification({
      userId: followingId,
      type: "follow",
      title: "New Follower",
      message: `${follower.displayName || follower.firstName || follower.username} started following you`,
      relatedId: followerId,
      relatedType: "user",
      actorId: followerId,
      actorName: follower.displayName || follower.firstName || follower.username,
      actorImage: follower.profileImageUrl,
      isRead: false,
    });
  }

  async createNotificationForLike(likerId: string, postId: number, postOwnerId: string): Promise<void> {
    // Don't notify if someone likes their own post
    if (likerId === postOwnerId) return;

    // Get liker details
    const liker = await this.getUser(likerId);
    if (!liker) return;

    await this.createNotification({
      userId: postOwnerId,
      type: "like",
      title: "Someone liked your post",
      message: `${liker.displayName || liker.firstName || liker.username} liked your post`,
      relatedId: postId.toString(),
      relatedType: "platform_post",
      actorId: likerId,
      actorName: liker.displayName || liker.firstName || liker.username,
      actorImage: liker.profileImageUrl,
      isRead: false,
    });
  }

  async createNotificationForComment(commenterId: string, postId: number, postOwnerId: string, comment: string): Promise<void> {
    // Don't notify if someone comments on their own post
    if (commenterId === postOwnerId) return;

    // Get commenter details
    const commenter = await this.getUser(commenterId);
    if (!commenter) return;

    // Truncate comment if too long
    const truncatedComment = comment.length > 50 ? comment.slice(0, 50) + "..." : comment;

    await this.createNotification({
      userId: postOwnerId,
      type: "comment",
      title: "New comment on your post",
      message: `${commenter.displayName || commenter.firstName || commenter.username} commented: "${truncatedComment}"`,
      relatedId: postId.toString(),
      relatedType: "platform_post",
      actorId: commenterId,
      actorName: commenter.displayName || commenter.firstName || commenter.username,
      actorImage: commenter.profileImageUrl,
      isRead: false,
    });
  }

  async createNotificationForChatMessage(senderId: string, chatId: number, message: string): Promise<void> {
    // Get chat details and members
    const chat = await this.getGroupChatById(chatId);
    if (!chat) return;

    const members = await this.getChatMembers(chatId);
    const sender = await this.getUser(senderId);
    if (!sender) return;

    // Notify all chat members except the sender
    for (const member of members) {
      if (member.id !== senderId) {
        // Truncate message if too long
        const truncatedMessage = message.length > 50 ? message.slice(0, 50) + "..." : message;

        await this.createNotification({
          userId: member.id,
          type: "chat_message",
          title: `New message in ${chat.title}`,
          message: `${sender.displayName || sender.firstName || sender.username}: ${truncatedMessage}`,
          relatedId: chatId.toString(),
          relatedType: "group_chat",
          actorId: senderId,
          actorName: sender.displayName || sender.firstName || sender.username,
          actorImage: sender.profileImageUrl,
          isRead: false,
        });
      }
    }
  }

  // Direct message operations
  async getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<DirectChat> {
    // Ensure consistent ordering (smaller ID first)
    const [firstUserId, secondUserId] = [user1Id, user2Id].sort();
    
    // Try to find existing chat
    const existingChat = await db
      .select()
      .from(directChats)
      .where(
        and(
          eq(directChats.user1Id, firstUserId),
          eq(directChats.user2Id, secondUserId)
        )
      )
      .limit(1);

    if (existingChat.length > 0) {
      return existingChat[0];
    }

    // Create new chat
    const [newChat] = await db
      .insert(directChats)
      .values({
        user1Id: firstUserId,
        user2Id: secondUserId,
      })
      .returning();

    return newChat;
  }

  async getUserDirectChats(userId: string): Promise<(DirectChat & { otherUser: ChatUser | null; lastMessage?: DirectMessage })[]> {
    // Fetch chats first, then resolve otherUser with a simple eq() — avoids broken CASE JOIN
    const chats = await db
      .select()
      .from(directChats)
      .where(sql`${directChats.user1Id} = ${userId} OR ${directChats.user2Id} = ${userId}`)
      .orderBy(desc(directChats.lastMessageAt));

    const chatsWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;

        const [otherUser] = await db
          .select(chatUserColumns)
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1);

        const [lastMessage] = await db
          .select()
          .from(directMessages)
          .where(eq(directMessages.chatId, chat.id))
          .orderBy(desc(directMessages.createdAt))
          .limit(1);

        return {
          ...chat,
          otherUser: otherUser ?? null,
          lastMessage: lastMessage ?? undefined,
        };
      })
    );

    return chatsWithDetails;
  }

  async getDirectChatById(chatId: number, userId: string): Promise<any | null> {
    try {
      const [chat] = await db
        .select()
        .from(directChats)
        .where(
          and(
            eq(directChats.id, chatId),
            sql`${directChats.user1Id} = ${userId} OR ${directChats.user2Id} = ${userId}`
          )
        )
        .limit(1);

      if (!chat) return null;

      const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const [otherUser] = await db
        .select(chatUserColumns)
        .from(users)
        .where(eq(users.id, otherUserId))
        .limit(1);

      return { ...chat, otherUser: otherUser ?? null };
    } catch (error) {
      console.error("Error fetching direct chat by ID:", error);
      throw error;
    }
  }

  async createDirectMessage(messageData: InsertDirectMessage): Promise<DirectMessage> {
    const [message] = await db
      .insert(directMessages)
      .values(messageData)
      .returning();

    // Update chat's lastMessageAt
    await db
      .update(directChats)
      .set({ lastMessageAt: new Date() })
      .where(eq(directChats.id, messageData.chatId));

    // Create notification for the recipient
    const chat = await db
      .select()
      .from(directChats)
      .where(eq(directChats.id, messageData.chatId))
      .limit(1);

    if (chat[0]) {
      const recipientId = chat[0].user1Id === messageData.senderId ? chat[0].user2Id : chat[0].user1Id;
      await this.createNotificationForDirectMessage(messageData.senderId, recipientId, messageData.message);
    }

    return message;
  }

  async getDirectChatMessages(chatId: number): Promise<(DirectMessage & { sender: ChatUser | null })[]> {
    const messages = await db
      .select({
        id: directMessages.id,
        chatId: directMessages.chatId,
        senderId: directMessages.senderId,
        message: directMessages.message,
        readAt: directMessages.readAt,
        createdAt: directMessages.createdAt,
        sender: chatUserColumns,
      })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(eq(directMessages.chatId, chatId))
      .orderBy(directMessages.createdAt);

    return messages;
  }

  // Only the recipient (the other person in that chat) can mark a message read
  async markDirectMessageAsRead(messageId: number, userId: string): Promise<void> {
    const myChats = db.select({ id: directChats.id }).from(directChats)
      .where(sql`${directChats.user1Id} = ${userId} OR ${directChats.user2Id} = ${userId}`);
    await db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(and(eq(directMessages.id, messageId), ne(directMessages.senderId, userId), inArray(directMessages.chatId, myChats)));
  }

  async getUnreadDirectMessagesCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(directMessages)
      .leftJoin(directChats, eq(directMessages.chatId, directChats.id))
      .where(
        and(
          sql`${directChats.user1Id} = ${userId} OR ${directChats.user2Id} = ${userId}`,
          sql`${directMessages.senderId} != ${userId}`,
          isNull(directMessages.readAt)
        )
      );

    return result[0]?.count || 0;
  }

  async createNotificationForDirectMessage(senderId: string, recipientId: string, message: string): Promise<void> {
    const sender = await this.getUser(senderId);
    if (!sender) return;

    // Truncate message if too long
    const truncatedMessage = message.length > 50 ? message.slice(0, 50) + "..." : message;

    await this.createNotification({
      userId: recipientId,
      type: "direct_message",
      title: "New direct message",
      message: `${sender.displayName || sender.firstName || sender.username}: ${truncatedMessage}`,
      relatedId: recipientId,
      relatedType: "direct_chat",
      actorId: senderId,
      actorName: sender.displayName || sender.firstName || sender.username,
      actorImage: sender.profileImageUrl,
      isRead: false,
    });
  }

  // Password reset token operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    return resetToken;
  }

  async markTokenAsUsed(tokenId: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async deleteExpiredTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Shop order operations
  async createShopOrder(orderData: InsertShopOrder): Promise<ShopOrder> {
    const [order] = await db
      .insert(shopOrders)
      .values(orderData)
      .returning();
    return order;
  }

  async getShopOrder(id: number): Promise<ShopOrder | undefined> {
    const [order] = await db
      .select()
      .from(shopOrders)
      .where(eq(shopOrders.id, id))
      .limit(1);
    return order;
  }

  async getShopOrderByPaymentIntent(paymentIntentId: string): Promise<ShopOrder | undefined> {
    const [order] = await db
      .select()
      .from(shopOrders)
      .where(eq(shopOrders.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return order;
  }

  async listShopOrders(): Promise<ShopOrder[]> {
    return await db
      .select()
      .from(shopOrders)
      .orderBy(desc(shopOrders.createdAt));
  }

  async getUserShopOrders(userId: string): Promise<ShopOrder[]> {
    return await db
      .select()
      .from(shopOrders)
      .where(eq(shopOrders.userId, userId))
      .orderBy(desc(shopOrders.createdAt));
  }

  async updateShopOrder(id: number, data: Partial<ShopOrder>): Promise<ShopOrder> {
    const [order] = await db
      .update(shopOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shopOrders.id, id))
      .returning();
    return order;
  }

  // Money event log operations (immutable audit trail)
  async createMoneyEventLog(eventData: InsertMoneyEventLog): Promise<MoneyEventLog> {
    const [log] = await db
      .insert(moneyEventLogs)
      .values(eventData)
      .returning();
    return log;
  }

  async getMoneyEventLogsByOrder(orderId: number): Promise<MoneyEventLog[]> {
    return await db
      .select()
      .from(moneyEventLogs)
      .where(eq(moneyEventLogs.orderId, orderId))
      .orderBy(desc(moneyEventLogs.createdAt));
  }

  async getMoneyEventLogsByPaymentIntent(paymentIntentId: string): Promise<MoneyEventLog[]> {
    return await db
      .select()
      .from(moneyEventLogs)
      .where(eq(moneyEventLogs.stripePaymentIntentId, paymentIntentId))
      .orderBy(desc(moneyEventLogs.createdAt));
  }

  // Webhook event operations (deduplication)
  async getWebhookEvent(stripeEventId: string): Promise<WebhookEvent | undefined> {
    const [event] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.stripeEventId, stripeEventId))
      .limit(1);
    return event;
  }

  async createWebhookEvent(eventData: InsertWebhookEvent): Promise<WebhookEvent> {
    const [event] = await db
      .insert(webhookEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async markWebhookEventProcessed(stripeEventId: string): Promise<void> {
    await db
      .update(webhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEvents.stripeEventId, stripeEventId));
  }

  // Saved post operations
  async savePost(userId: string, postId: number): Promise<SavedPost> {
    const [saved] = await db
      .insert(savedPosts)
      .values({ userId, postId })
      .onConflictDoNothing()
      .returning();
    if (!saved) {
      const [existing] = await db
        .select()
        .from(savedPosts)
        .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
        .limit(1);
      return existing;
    }
    return saved;
  }

  async unsavePost(userId: string, postId: number): Promise<void> {
    await db
      .delete(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
  }

  async isPostSaved(userId: string, postId: number): Promise<boolean> {
    const [saved] = await db
      .select()
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
      .limit(1);
    return !!saved;
  }

  async getUserSavedPosts(userId: string): Promise<PlatformPost[]> {
    const saved = await db
      .select({ post: platformPosts })
      .from(savedPosts)
      .innerJoin(platformPosts, eq(savedPosts.postId, platformPosts.id))
      .where(eq(savedPosts.userId, userId))
      .orderBy(desc(savedPosts.createdAt));
    return saved.map(s => s.post);
  }
  // Moderation operations
  async createModerationLog(logData: InsertModerationLog): Promise<ModerationLog> {
    const [log] = await db.insert(moderationLogs).values(logData).returning();
    return log;
  }

  async getModerationLog(id: number): Promise<ModerationLog | undefined> {
    const [log] = await db.select().from(moderationLogs).where(eq(moderationLogs.id, id));
    return log;
  }

  async listModerationLogs(options?: { decision?: string; limit?: number; offset?: number }): Promise<ModerationLog[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    if (options?.decision) {
      return db
        .select()
        .from(moderationLogs)
        .where(eq(moderationLogs.decision, options.decision))
        .orderBy(desc(moderationLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return db
      .select()
      .from(moderationLogs)
      .orderBy(desc(moderationLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateModerationLog(id: number, data: Partial<ModerationLog>): Promise<ModerationLog> {
    const [log] = await db
      .update(moderationLogs)
      .set(data)
      .where(eq(moderationLogs.id, id))
      .returning();
    return log;
  }

  async getModerationStats(): Promise<{ total: number; approved: number; flagged: number; rejected: number }> {
    const allLogs = await db.select().from(moderationLogs);
    const total = allLogs.length;
    const approved = allLogs.filter(l => l.decision === "approved").length;
    const flagged = allLogs.filter(l => l.decision === "flagged").length;
    const rejected = allLogs.filter(l => l.decision === "rejected").length;
    return { total, approved, flagged, rejected };
  }

  // Post report operations
  async createPostReport(reportData: InsertPostReport): Promise<PostReport> {
    const [report] = await db.insert(postReports).values(reportData).returning();
    return report;
  }

  async getPostReports(postId: number): Promise<PostReport[]> {
    return db.select().from(postReports).where(eq(postReports.postId, postId)).orderBy(desc(postReports.createdAt));
  }

  async listPostReports(options?: { status?: string; limit?: number; offset?: number }): Promise<PostReport[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    if (options?.status) {
      return db.select().from(postReports)
        .where(eq(postReports.status, options.status))
        .orderBy(desc(postReports.createdAt))
        .limit(limit).offset(offset);
    }

    return db.select().from(postReports)
      .orderBy(desc(postReports.createdAt))
      .limit(limit).offset(offset);
  }

  async updatePostReport(id: number, data: Partial<PostReport>): Promise<PostReport> {
    const [report] = await db.update(postReports).set(data).where(eq(postReports.id, id)).returning();
    return report;
  }

  async hasUserReportedPost(userId: string, postId: number): Promise<boolean> {
    const [existing] = await db.select().from(postReports)
      .where(and(eq(postReports.reporterId, userId), eq(postReports.postId, postId)))
      .limit(1);
    return !!existing;
  }

  async getPostReportStats(): Promise<{ total: number; pending: number; reviewed: number; dismissed: number }> {
    const all = await db.select().from(postReports);
    return {
      total: all.length,
      pending: all.filter(r => r.status === "pending").length,
      reviewed: all.filter(r => r.status === "reviewed").length,
      dismissed: all.filter(r => r.status === "dismissed").length,
    };
  }

  async createMembershipSubscription(data: InsertMembershipSubscription): Promise<MembershipSubscription> {
    const [sub] = await db.insert(membershipSubscriptions).values(data).returning();
    return sub;
  }

  async getMembershipSubscription(id: number): Promise<MembershipSubscription | undefined> {
    const [sub] = await db.select().from(membershipSubscriptions).where(eq(membershipSubscriptions.id, id));
    return sub;
  }

  async getUserMembershipSubscription(userId: string): Promise<MembershipSubscription | undefined> {
    const [sub] = await db.select().from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.userId, userId), eq(membershipSubscriptions.status, "active")))
      .orderBy(desc(membershipSubscriptions.createdAt))
      .limit(1);
    return sub;
  }

  async listMembershipSubscriptions(): Promise<MembershipSubscription[]> {
    return db.select().from(membershipSubscriptions).orderBy(desc(membershipSubscriptions.createdAt));
  }

  async updateMembershipSubscription(id: number, data: Partial<MembershipSubscription>): Promise<MembershipSubscription> {
    const [sub] = await db.update(membershipSubscriptions).set(data).where(eq(membershipSubscriptions.id, id)).returning();
    return sub;
  }

  async validateCouponCode(code: string): Promise<CouponCode | null> {
    const [coupon] = await db.select().from(couponCodes)
      .where(eq(couponCodes.code, code.toUpperCase()));
    if (!coupon) return null;
    if (!coupon.isActive) return null;
    if (coupon.maxUsage !== null && coupon.usageCount !== null && coupon.usageCount >= coupon.maxUsage) return null;
    return coupon;
  }

  async incrementCouponUsage(code: string): Promise<void> {
    const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, code.toUpperCase()));
    if (coupon) {
      await db.update(couponCodes)
        .set({ usageCount: (coupon.usageCount || 0) + 1 })
        .where(eq(couponCodes.code, code.toUpperCase()));
    }
  }

  async seedCouponCode(code: string, discountPercent: number): Promise<void> {
    const upper = code.toUpperCase();
    const [existing] = await db.select().from(couponCodes).where(eq(couponCodes.code, upper));
    if (!existing) {
      await db.insert(couponCodes).values({
        code: upper,
        discountPercent,
        isActive: true,
        usageCount: 0,
        maxUsage: null,
      });
    }
  }
}

export const storage = new DatabaseStorage();
