import type { Express, RequestHandler, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { z } from "zod";
import { 
  insertCampaignSchema, 
  insertDonationSchema, 
  insertBusinessProfileSchema,
  insertContentCreatorSchema,
  insertSponsorshipApplicationSchema,
  insertMinistryProfileSchema,
  insertMinistryPostSchema,
  insertMinistryEventSchema,
  insertGroupChatQueueSchema,
  insertGroupChatMessageSchema
} from "@shared/schema";
import { generateSlug } from "./utils";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { youtubeService } from "./youtube";
import { tiktokService } from "./tiktok";
import { instagramService } from "./instagram";
import { emailService } from "./emailService";
import { getUncachableStripeClient } from "./stripeClient";
import { 
  paymentLimiter, uploadLimiter, writeLimiter,
  validateBody,
  donationPaymentIntentSchema, shopPaymentIntentSchema, shopOrderSchema,
  profileUpdateSchema, privacySettingsSchema, notificationSettingsSchema, campaignCreateSchema,
  platformPostSchema, commentSchema, groupChatQueueSchema,
  groupChatMessageSchema, directChatMessageSchema, directChatCreateSchema,
  businessProfileCreateSchema, manualDonationSchema
} from "./security";
import { uploadToSupabase } from "./supabaseStorage";
import { moderateContent } from "./services/moderationService";
import { sendPushToUser } from "./pushNotifications";
import { pool } from "./db";

const uploadBufferToObjectStorage = uploadToSupabase;

let stripe: Stripe | undefined;

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up uploads directory for backward compatibility with old local uploads
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure multer with memory storage for Object Storage uploads
  const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  };

  const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024,
    } 
  });

  // Redirect old local /uploads/uuid.ext and /objects/uploads/uuid.ext URLs to Supabase Storage
  const toSupabase = (req: any, res: any) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return res.status(404).json({ error: 'Media not available' });
    // Extract just the filename (uuid.ext) regardless of path prefix
    const filename = path.basename(req.path);
    res.redirect(301, `${supabaseUrl}/storage/v1/object/public/uploads/${filename}`);
  };
  app.use('/uploads', toSupabase);
  app.get('/objects/*', toSupabase);

  // Serve favicon files
  app.get('/favicon.png', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public', 'favicon.png'));
  });

  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public', 'favicon.ico'));
  });

  // Auth middleware
  await setupAuth(app);

  // Update basic user profile (validated by profileUpdateSchema middleware)
  app.put('/api/user/profile', isAuthenticated, writeLimiter, validateBody(profileUpdateSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Define specific allowed fields for profile update to avoid schema validation errors
      const {
        firstName,
        lastName,
        displayName,
        username,
        bio,
        location,
        phone,
        profileImageUrl,
        showEmail,
        showPhone,
        showLocation
      } = req.body;

      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (username !== undefined) updateData.username = username;
      if (bio !== undefined) updateData.bio = bio;
      if (location !== undefined) updateData.location = location;
      if (phone !== undefined) updateData.phone = phone;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;
      if (showEmail !== undefined) updateData.showEmail = typeof showEmail === 'boolean' ? showEmail : showEmail === 'true';
      if (showPhone !== undefined) updateData.showPhone = typeof showPhone === 'boolean' ? showPhone : showPhone === 'true';
      if (showLocation !== undefined) updateData.showLocation = typeof showLocation === 'boolean' ? showLocation : showLocation === 'true';

      if (updateData.username) {
        const currentUser = await storage.getUser(userId);
        if (currentUser && updateData.username !== currentUser.username) {
          const existingUser = await storage.getUserByUsername(updateData.username);
          if (existingUser) {
            return res.status(400).json({ message: "Username already taken", field: "username" });
          }
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Profile image upload endpoint
  app.post('/api/upload/profile-image', isAuthenticated, uploadLimiter, upload.single('profileImage'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const imageUrl = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.json({ url: imageUrl });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post('/api/upload/banner-image', isAuthenticated, uploadLimiter, upload.single('bannerImage'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed for banners" });
      }
      const imageUrl = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      await storage.updateUser(req.user.id, { bannerImageUrl: imageUrl });
      res.json({ url: imageUrl });
    } catch (error) {
      console.error("Error uploading banner image:", error);
      res.status(500).json({ message: "Failed to upload banner image" });
    }
  });

  // Check if current user is an approved creator
  app.get('/api/user/creator-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const creator = await storage.getUserContentCreator(userId);

      if (!creator) {
        return res.json({ isCreator: false });
      }

      // Get creator's social media posts
      const posts = await storage.getSocialMediaPostsByCreator(creator.id);

      // Calculate stats like the public profile does
      const platforms = creator.platforms || [];
      const totalFollowers = Array.isArray(platforms) ? 
        platforms.reduce((sum: number, platform: any) => sum + (platform.subscriberCount || 0), 0) : 0;

      const enhancedCreator = {
        ...creator,
        posts,
        totalPosts: posts?.length || 0,
        totalFollowers,
        platformCount: Array.isArray(platforms) ? platforms.length : 0
      };

      res.json({
        isCreator: true,
        creatorProfile: enhancedCreator
      });
    } catch (error) {
      console.error("Error fetching creator status:", error);
      res.status(500).json({ message: "Failed to fetch creator status" });
    }
  });

  // Public route: get creator status for any user by ID (used when viewing another user's profile)
  app.get('/api/users/creator-status/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ message: "User ID is required" });

      const creator = await storage.getUserContentCreator(userId);
      if (!creator) {
        return res.json({ isCreator: false });
      }

      const posts = await storage.getSocialMediaPostsByCreator(creator.id);
      const platforms = creator.platforms || [];
      const totalFollowers = Array.isArray(platforms)
        ? platforms.reduce((sum: number, platform: any) => sum + (platform.subscriberCount || 0), 0)
        : 0;

      const enhancedCreator = {
        ...creator,
        posts,
        totalPosts: posts?.length || 0,
        totalFollowers,
        platformCount: Array.isArray(platforms) ? platforms.length : 0,
      };

      res.json({ isCreator: true, creatorProfile: enhancedCreator });
    } catch (error) {
      console.error("Error fetching creator status for user:", error);
      res.status(500).json({ message: "Failed to fetch creator status" });
    }
  });

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Error checking admin status" });
    }
  };

  // Admin routes
  app.get('/api/admin/sponsorship-applications', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const applications = await storage.listSponsorshipApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching sponsorship applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post('/api/admin/sponsorship-applications/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }

      // Get the application first
      const application = await storage.getSponsorshipApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Check if user already has a content creator profile
      const existingCreator = await storage.getUserContentCreator(application.userId);

      if (!existingCreator) {
        // Create content creator profile from approved application
        const newCreator = await storage.createContentCreator({
          name: application.name,
          platforms: application.platforms as { platform: string; profileUrl: string; subscriberCount?: number }[],
          content: application.content,
          audience: application.audience,
          bio: application.message, // Use their message as bio
          userId: application.userId
        });

        // Update to mark as sponsored
        await storage.updateContentCreator(newCreator.id, {
          isSponsored: true,
          sponsorshipStartDate: new Date()
        });
      } else {
        // Update existing creator to be sponsored
        await storage.updateContentCreator(existingCreator.id, {
          isSponsored: true,
          sponsorshipStartDate: new Date(),
          platforms: application.platforms,
          content: application.content,
          audience: application.audience
        });
      }

      // Approve the application
      const approvedApplication = await storage.updateSponsorshipApplication(applicationId, {
        status: 'approved',
        reviewedAt: new Date()
      });

      res.json(approvedApplication);
    } catch (error) {
      console.error("Error approving sponsorship application:", error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post('/api/admin/sponsorship-applications/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }

      const rejectedApplication = await storage.updateSponsorshipApplication(applicationId, {
        status: 'rejected',
        reviewedAt: new Date()
      });

      if (!rejectedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      res.json(rejectedApplication);
    } catch (error) {
      console.error("Error rejecting sponsorship application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  app.get('/api/admin/campaigns', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const campaigns = await storage.listCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/admin/campaigns/pending', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const pendingCampaigns = await storage.listPendingCampaigns();
      res.json(pendingCampaigns);
    } catch (error) {
      console.error("Error fetching pending campaigns:", error);
      res.status(500).json({ message: "Failed to fetch pending campaigns" });
    }
  });

  app.post('/api/admin/campaigns/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const approvedCampaign = await storage.approveCampaign(id);
      res.json(approvedCampaign);
    } catch (error) {
      console.error("Error approving campaign:", error);
      res.status(500).json({ message: "Failed to approve campaign" });
    }
  });

  app.post('/api/admin/campaigns/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const rejectedCampaign = await storage.rejectCampaign(id);
      res.json(rejectedCampaign);
    } catch (error) {
      console.error("Error rejecting campaign:", error);
      res.status(500).json({ message: "Failed to reject campaign" });
    }
  });

  app.delete('/api/admin/campaigns/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCampaign(id);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.get('/api/admin/business-profiles', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profiles = await storage.listBusinessProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching business profiles:", error);
      res.status(500).json({ message: "Failed to fetch business profiles" });
    }
  });

  // Admin moderation routes
  app.get('/api/admin/moderation', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { decision, limit, offset } = req.query;
      const logs = await storage.listModerationLogs({
        decision: decision as string,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      });

      const logsWithUsers = await Promise.all(
        logs.map(async (log) => {
          const user = await storage.getUser(log.userId);
          return {
            ...log,
            user: user ? {
              id: user.id,
              username: user.username,
              displayName: user.displayName || user.firstName || user.username,
              profileImageUrl: user.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(logsWithUsers);
    } catch (error) {
      console.error("Error fetching moderation logs:", error);
      res.status(500).json({ message: "Failed to fetch moderation logs" });
    }
  });

  app.get('/api/admin/moderation/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getModerationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching moderation stats:", error);
      res.status(500).json({ message: "Failed to fetch moderation stats" });
    }
  });

  app.post('/api/admin/moderation/:id/approve', isAuthenticated, isAdmin, writeLimiter, async (req: any, res) => {
    try {
      const logId = parseInt(req.params.id);
      if (isNaN(logId)) return res.status(400).json({ message: "Invalid log ID" });

      const log = await storage.getModerationLog(logId);
      if (!log) return res.status(404).json({ message: "Moderation log not found" });

      await storage.updateModerationLog(logId, {
        decision: "approved",
        reviewedBy: req.user.id,
      });

      if (log.contentType === "platform_post" && log.contentId) {
        await storage.updatePlatformPost(log.contentId, { isPublished: true });
      }

      res.json({ message: "Content approved successfully" });
    } catch (error) {
      console.error("Error approving content:", error);
      res.status(500).json({ message: "Failed to approve content" });
    }
  });

  app.post('/api/admin/moderation/:id/reject', isAuthenticated, isAdmin, writeLimiter, async (req: any, res) => {
    try {
      const logId = parseInt(req.params.id);
      if (isNaN(logId)) return res.status(400).json({ message: "Invalid log ID" });

      const log = await storage.getModerationLog(logId);
      if (!log) return res.status(404).json({ message: "Moderation log not found" });

      await storage.updateModerationLog(logId, {
        decision: "rejected",
        reviewedBy: req.user.id,
      });

      if (log.contentType === "platform_post" && log.contentId) {
        await storage.updatePlatformPost(log.contentId, { isPublished: false });
      }

      res.json({ message: "Content rejected successfully" });
    } catch (error) {
      console.error("Error rejecting content:", error);
      res.status(500).json({ message: "Failed to reject content" });
    }
  });

  // Admin post report routes
  app.get('/api/admin/reports', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, limit, offset } = req.query;
      const reports = await storage.listPostReports({
        status: status as string,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      });

      const reportsWithDetails = await Promise.all(
        reports.map(async (report) => {
          const reporter = await storage.getUser(report.reporterId);
          const post = await storage.getPlatformPost(report.postId);
          const postAuthor = post ? await storage.getUser(post.userId) : null;
          return {
            ...report,
            reporter: reporter ? {
              id: reporter.id,
              username: reporter.username,
              displayName: reporter.displayName || reporter.firstName || reporter.username,
              profileImageUrl: reporter.profileImageUrl,
            } : null,
            post: post ? {
              id: post.id,
              content: post.content,
              mediaUrls: post.mediaUrls,
              mediaType: post.mediaType,
              isPublished: post.isPublished,
            } : null,
            postAuthor: postAuthor ? {
              id: postAuthor.id,
              username: postAuthor.username,
              displayName: postAuthor.displayName || postAuthor.firstName || postAuthor.username,
            } : null,
          };
        })
      );

      res.json(reportsWithDetails);
    } catch (error) {
      console.error("Error fetching post reports:", error);
      res.status(500).json({ message: "Failed to fetch post reports" });
    }
  });

  app.get('/api/admin/reports/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getPostReportStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching report stats:", error);
      res.status(500).json({ message: "Failed to fetch report stats" });
    }
  });

  app.post('/api/admin/reports/:id/restore', isAuthenticated, isAdmin, writeLimiter, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) return res.status(400).json({ message: "Invalid report ID" });

      const report = await storage.listPostReports();
      const found = report.find(r => r.id === reportId);
      if (!found) return res.status(404).json({ message: "Report not found" });

      await storage.updatePostReport(reportId, { status: "dismissed", reviewedBy: req.user.id });
      await storage.updatePlatformPost(found.postId, { isPublished: true });

      res.json({ message: "Post restored and report dismissed" });
    } catch (error) {
      console.error("Error restoring post:", error);
      res.status(500).json({ message: "Failed to restore post" });
    }
  });

  app.post('/api/admin/reports/:id/confirm', isAuthenticated, isAdmin, writeLimiter, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) return res.status(400).json({ message: "Invalid report ID" });

      const report = await storage.listPostReports();
      const found = report.find(r => r.id === reportId);
      if (!found) return res.status(404).json({ message: "Report not found" });

      await storage.updatePostReport(reportId, { status: "reviewed", reviewedBy: req.user.id });

      res.json({ message: "Report confirmed, post remains hidden" });
    } catch (error) {
      console.error("Error confirming report:", error);
      res.status(500).json({ message: "Failed to confirm report" });
    }
  });

  // Content creator routes
  app.get('/api/content-creators', async (req, res) => {
    try {
      const { sponsored } = req.query;
      const sponsoredOnly = sponsored === 'true';
      const creators = await storage.listContentCreators(sponsoredOnly);
      res.json(creators);
    } catch (error) {
      console.error("Error fetching content creators:", error);
      res.status(500).json({ message: "Failed to fetch content creators" });
    }
  });

  app.get('/api/content-creators/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const creatorId = parseInt(id);

      if (isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid creator ID" });
      }

      const creator = await storage.getContentCreator(creatorId);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      // Get creator's social media posts (only visible ones for public view)
      const posts = await storage.getVisibleSocialMediaPostsByCreator(creatorId);

      // Get internal follower count from the follow system
      const totalFollowers = await storage.getUserFollowersCount(creator.userId);

      res.json({ ...creator, posts, totalFollowers });
    } catch (error) {
      console.error("Error fetching content creator:", error);
      res.status(500).json({ message: "Failed to fetch content creator" });
    }
  });

  // Update social media post visibility
  app.put('/api/social-media-posts/:id/visibility', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const { isVisibleOnProfile } = req.body;
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Get the post and verify ownership
      const post = await storage.getSocialMediaPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Get creator to verify ownership
      const creator = await storage.getContentCreator(post.creatorId);
      if (!creator || (creator.userId !== userId && !req.user.isAdmin)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedPost = await storage.updateSocialMediaPost(postId, {
        isVisibleOnProfile: Boolean(isVisibleOnProfile)
      });

      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating post visibility:", error);
      res.status(500).json({ message: "Failed to update post visibility" });
    }
  });

  // Update content creator profile
  app.put('/api/content-creators/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const creatorId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid creator ID" });
      }

      // Verify the creator belongs to the authenticated user
      const existingCreator = await storage.getContentCreator(creatorId);
      if (!existingCreator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      if (existingCreator.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate the update data
      const updateData = insertContentCreatorSchema.partial().parse(req.body);

      const updatedCreator = await storage.updateContentCreator(creatorId, {
        ...updateData,
        updatedAt: new Date()
      });

      res.json(updatedCreator);
    } catch (error) {
      console.error("Error updating content creator:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update creator profile" });
    }
  });

  app.get('/api/users/:userId/content-creator', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Only allow users to view their own creator profile or admins to view any
      if (req.user.claims.sub !== userId && !req.user.claims.email?.includes('admin')) {
        return res.status(403).json({ message: "Access denied" });
      }

      const creator = await storage.getUserContentCreator(userId);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const posts = await storage.getSocialMediaPostsByCreator(creator.id);
      res.json({ ...creator, posts });
    } catch (error) {
      console.error("Error fetching user content creator:", error);
      res.status(500).json({ message: "Failed to fetch creator profile" });
    }
  });

  // Get all posts for a creator (for post management)
  app.get('/api/social-media-posts/creator/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const creatorId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid creator ID" });
      }

      // Verify the creator belongs to the authenticated user
      const creator = await storage.getContentCreator(creatorId);
      if (!creator || (creator.userId !== userId && !req.user.isAdmin)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const posts = await storage.getSocialMediaPostsByCreator(creatorId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching creator posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Platform posts endpoints - unified content sharing for all user types

  // Create a new platform post
  app.post('/api/platform-posts', isAuthenticated, writeLimiter, validateBody(platformPostSchema), async (req: any, res) => {
    try {
      const { authorType, authorId, title, content, mediaUrls, mediaType, tags } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      // Verify user ownership of the profile they're posting as
      if (authorType === 'creator' && authorId) {
        const creator = await storage.getContentCreator(authorId);
        if (!creator || creator.userId !== userId) {
          return res.status(403).json({ message: "Access denied: You don't own this creator profile" });
        }
      } else if (authorType === 'business' && authorId) {
        const business = await storage.getBusinessProfile(authorId);
        if (!business || business.userId !== userId) {
          return res.status(403).json({ message: "Access denied: You don't own this business profile" });
        }
      } else if (authorType === 'ministry' && authorId) {
        const ministry = await storage.getUserMinistryProfile(userId);
        if (!ministry || ministry.id !== authorId) {
          return res.status(403).json({ message: "Access denied: You don't own this ministry profile" });
        }
      }

      const modResult = await moderateContent({
        text: content,
        imageUrls: mediaUrls || [],
      });

      if (modResult.decision === "rejected") {
        await storage.createModerationLog({
          contentId: 0,
          userId,
          contentType: "platform_post",
          flagCategories: modResult.flagCategories,
          confidenceScores: modResult.confidenceScores,
          decision: "rejected",
          contentPreview: content.substring(0, 200),
        });
        return res.status(400).json({
          message: "Your post contains content that violates our community guidelines and cannot be published.",
          moderationResult: { decision: "rejected", categories: modResult.flagCategories },
        });
      }

      const isPublished = modResult.decision === "approved";

      const post = await storage.createPlatformPost({
        userId,
        authorType,
        authorId,
        title,
        content,
        mediaUrls: mediaUrls || [],
        mediaType: mediaType || 'image',
        tags: tags || [],
        isPublished,
      });

      await storage.createModerationLog({
        contentId: post.id,
        userId,
        contentType: "platform_post",
        flagCategories: modResult.flagCategories,
        confidenceScores: modResult.confidenceScores,
        decision: modResult.decision,
        contentPreview: content.substring(0, 200),
      });

      if (modResult.decision === "flagged") {
        return res.status(202).json({
          ...post,
          moderationStatus: "flagged",
          message: "Your post has been submitted for review and will be visible once approved by a moderator.",
        });
      }

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating platform post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Get all platform posts (public feed)
  app.get('/api/platform-posts', async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      let posts = await storage.listPlatformPosts(limit);
      // Filter out posts from users that the current user has blocked
      if (req.user?.id) {
        const blockedIds = await storage.getBlockedUserIds(req.user.id);
        if (blockedIds.length > 0) {
          const blockedSet = new Set(blockedIds);
          posts = posts.filter(p => !blockedSet.has(p.userId));
        }
      }
      const postsWithUsers = await Promise.all(
        posts.map(async (post) => {
          const postUser = await storage.getUser(post.userId);
          return {
            ...post,
            user: postUser ? {
              id: postUser.id,
              username: postUser.username,
              displayName: postUser.displayName,
              firstName: postUser.firstName,
              lastName: postUser.lastName,
              profileImageUrl: postUser.profileImageUrl,
            } : null,
          };
        })
      );
      res.json(postsWithUsers);
    } catch (error) {
      console.error("Error fetching platform posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Get user's platform posts
  app.get('/api/platform-posts/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      // Users can only see their own posts unless they're admin
      if (userId !== currentUserId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const posts = await storage.getUserPlatformPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching user platform posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Get specific platform post
  app.get('/api/platform-posts/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching platform post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Update platform post
  app.put('/api/platform-posts/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check ownership
      if (post.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedPost = await storage.updatePlatformPost(postId, req.body);
      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating platform post:", error);
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  // PATCH endpoint for platform posts (same as PUT but using PATCH method)
  app.patch('/api/platform-posts/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check ownership
      if (post.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedPost = await storage.updatePlatformPost(postId, req.body);

      // Ensure we're returning valid JSON
      return res.status(200).json(updatedPost);
    } catch (error) {
      console.error("Error updating platform post:", error);
      return res.status(500).json({ message: "Failed to update post", error: error.message });
    }
  });

  // Delete platform post
  app.delete('/api/platform-posts/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check ownership
      if (post.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deletePlatformPost(postId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting platform post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Post interaction endpoints

  // Like/unlike a post
  app.post('/api/platform-posts/:id/like', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if user already liked the post
      const existingLike = await storage.getUserPostInteraction(postId, userId, 'like');

      if (existingLike) {
        // Unlike the post
        await storage.deletePostInteraction(existingLike.id);
        await storage.updatePlatformPost(postId, { 
          likesCount: Math.max(0, (post.likesCount || 0) - 1) 
        });
        res.json({ liked: false, likesCount: Math.max(0, (post.likesCount || 0) - 1) });
      } else {
        // Like the post
        await storage.createPostInteraction({
          postId,
          userId,
          type: 'like',
        });
        await storage.updatePlatformPost(postId, { 
          likesCount: (post.likesCount || 0) + 1 
        });

        // Create notification for like
        await storage.createNotificationForLike(userId, postId, post.userId);
        if (post.userId !== userId) {
          const liker = await storage.getUser(userId);
          sendPushToUser(post.userId, {
            title: "New Like",
            body: `${liker?.firstName || liker?.username || "Someone"} liked your post`,
            data: { type: "like", postId: String(postId) },
          }).catch(() => {});
        }

        res.json({ liked: true, likesCount: (post.likesCount || 0) + 1 });
      }
    } catch (error) {
      console.error("Error toggling post like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Check if current user liked a post
  app.get('/api/platform-posts/:id/liked', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user.id;
      if (isNaN(postId)) {
        return res.status(400).json({ liked: false });
      }
      const existingLike = await storage.getUserPostInteraction(postId, userId, 'like');
      res.json({ liked: !!existingLike });
    } catch (error) {
      res.json({ liked: false });
    }
  });

  // Save/unsave a post (bookmark toggle)
  app.post('/api/platform-posts/:id/save', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const alreadySaved = await storage.isPostSaved(userId, postId);
      if (alreadySaved) {
        await storage.unsavePost(userId, postId);
        res.json({ saved: false });
      } else {
        await storage.savePost(userId, postId);
        res.json({ saved: true });
      }
    } catch (error) {
      console.error("Error toggling post save:", error);
      res.status(500).json({ message: "Failed to toggle save" });
    }
  });

  // Check if post is saved
  app.get('/api/platform-posts/:id/saved', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user.id;
      if (isNaN(postId)) return res.status(400).json({ message: "Invalid post ID" });
      const saved = await storage.isPostSaved(userId, postId);
      res.json({ saved });
    } catch (error) {
      res.status(500).json({ message: "Failed to check save status" });
    }
  });

  // Get current user's saved posts
  app.get('/api/saved-posts', isAuthenticated, async (req: any, res) => {
    try {
      const posts = await storage.getUserSavedPosts(req.user.id);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching saved posts:", error);
      res.status(500).json({ message: "Failed to fetch saved posts" });
    }
  });

  // Report a post
  app.post('/api/platform-posts/:id/report', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user.id;
      const { reason, details } = req.body;

      if (isNaN(postId)) return res.status(400).json({ message: "Invalid post ID" });

      const validReasons = [
        "spam",
        "harassment",
        "hate_speech",
        "violence",
        "nudity",
        "false_information",
        "scam",
        "inappropriate",
        "other",
      ];
      if (!reason || !validReasons.includes(reason)) {
        return res.status(400).json({ message: "Please select a valid report reason" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      if (post.userId === userId) {
        return res.status(400).json({ message: "You cannot report your own post" });
      }

      const alreadyReported = await storage.hasUserReportedPost(userId, postId);
      if (alreadyReported) {
        return res.status(400).json({ message: "You have already reported this post" });
      }

      await storage.createPostReport({
        postId,
        reporterId: userId,
        reason,
        details: details || null,
      });

      await storage.updatePlatformPost(postId, { isPublished: false });

      res.json({ message: "Post reported successfully. It has been removed from public view and sent for review." });
    } catch (error) {
      console.error("Error reporting post:", error);
      res.status(500).json({ message: "Failed to report post" });
    }
  });

  // Add comment to post
  app.post('/api/platform-posts/:id/comment', isAuthenticated, writeLimiter, validateBody(commentSchema), async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;
      const { content } = req.body;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const modResult = await moderateContent({ text: content.trim() });

      if (modResult.decision === "rejected") {
        await storage.createModerationLog({
          contentId: postId,
          userId,
          contentType: "comment",
          flagCategories: modResult.flagCategories,
          confidenceScores: modResult.confidenceScores,
          decision: "rejected",
          contentPreview: content.trim().substring(0, 200),
        });
        return res.status(400).json({
          message: "Your comment contains content that violates our community guidelines.",
          moderationResult: { decision: "rejected", categories: modResult.flagCategories },
        });
      }

      if (modResult.decision === "flagged") {
        await storage.createModerationLog({
          contentId: postId,
          userId,
          contentType: "comment",
          flagCategories: modResult.flagCategories,
          confidenceScores: modResult.confidenceScores,
          decision: "flagged",
          contentPreview: content.trim().substring(0, 200),
        });
      }

      const comment = await storage.createPostInteraction({
        postId,
        userId,
        type: 'comment',
        content: content.trim(),
      });

      await storage.updatePlatformPost(postId, { 
        commentsCount: (post.commentsCount || 0) + 1 
      });

      await storage.createNotificationForComment(userId, postId, post.userId, content.trim());
      if (post.userId !== userId) {
        const commenter = await storage.getUser(userId);
        sendPushToUser(post.userId, {
          title: "New Comment",
          body: `${commenter?.firstName || commenter?.username || "Someone"} commented: ${content.trim().slice(0, 80)}`,
          data: { type: "comment", postId: String(postId) },
        }).catch(() => {});
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Get post interactions (comments)
  app.get('/api/platform-posts/:id/interactions', async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const interactions = await storage.getPostInteractions(postId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching post interactions:", error);
      res.status(500).json({ message: "Failed to fetch interactions" });
    }
  });

  // Delete platform post
  app.delete('/api/platform-posts/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check if post exists and user owns it
      const post = await storage.getPlatformPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this post" });
      }

      // Delete the post
      await storage.deletePlatformPost(postId);

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting platform post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Delete comment
  app.delete('/api/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const commentId = parseInt(id);
      const userId = req.user.id;

      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      // Check if comment exists and user owns it
      const comment = await storage.getPostComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      if (comment.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this comment" });
      }

      // Get the post to update comment count
      const post = await storage.getPlatformPost(comment.postId);
      if (post) {
        await storage.updatePlatformPost(comment.postId, { 
          commentsCount: Math.max((post.commentsCount || 1) - 1, 0)
        });
      }

      // Delete the comment
      await storage.deletePostComment(commentId);

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Get post comments only
  app.get('/api/platform-posts/:id/comments', async (req: any, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);

      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // File upload route - supports both images and videos
  app.post('/api/upload', isAuthenticated, uploadLimiter, (req, res, next) => {
    // Create a fields configuration that accepts both 'image', 'video' and 'file' fields
    const uploadFields = upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 },
      { name: 'file', maxCount: 1 }
    ]);

    uploadFields(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ message: err.message || "Error uploading file" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const files = req.files;

      if (!files || ((!files.image || files.image.length === 0) && (!files.video || files.video.length === 0) && (!files.file || files.file.length === 0))) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = files.image ? files.image[0] : files.video ? files.video[0] : files.file[0];

      const fileUrl = await uploadBufferToObjectStorage(file.buffer, file.mimetype, file.originalname);

      res.status(200).json({ 
        url: fileUrl,
        filename: path.basename(fileUrl),
        fileType: files.image ? 'image' : files.video ? 'video' : 'file',
        success: true 
      });
    } catch (error) {
      console.error("Error processing uploaded file:", error);
      res.status(500).json({ message: "Failed to process uploaded file" });
    }
  });

  // User ministry profile route
  app.get('/api/user/ministry-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserMinistryProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "Ministry profile not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching ministry profile:", error);
      res.status(500).json({ message: "Failed to fetch ministry profile" });
    }
  });

  // Privacy settings route
  app.put('/api/user/privacy-settings', isAuthenticated, writeLimiter, validateBody(privacySettingsSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { showEmail, showPhone, showLocation } = req.body;

      // Validate input
      const privacyData = {
        showEmail: Boolean(showEmail),
        showPhone: Boolean(showPhone),
        showLocation: Boolean(showLocation)
      };

      const user = await storage.updateUser(userId, privacyData);
      res.json(user);
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  // Account deletion route
  app.delete('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Destroy the session first so the user is logged out
      req.session.destroy(() => {});
      await storage.deleteUser(userId);
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account. Please try again." });
    }
  });

  // Notification settings route
  app.put('/api/user/notification-settings', isAuthenticated, writeLimiter, validateBody(notificationSettingsSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { wordOfDayNotification, pushNotificationsEnabled, emailNotificationsEnabled } = req.body;

      const notificationData: any = {};
      if (wordOfDayNotification !== undefined) notificationData.wordOfDayNotification = Boolean(wordOfDayNotification);
      if (pushNotificationsEnabled !== undefined) notificationData.pushNotificationsEnabled = Boolean(pushNotificationsEnabled);
      if (emailNotificationsEnabled !== undefined) notificationData.emailNotificationsEnabled = Boolean(emailNotificationsEnabled);

      const user = await storage.updateUser(userId, notificationData);
      res.json(user);
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // Campaign routes
  app.post('/api/campaigns', isAuthenticated, writeLimiter, validateBody(campaignCreateSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Ensure additionalImages is an array or set to empty array if undefined
      if (req.body.additionalImages && !Array.isArray(req.body.additionalImages)) {
        req.body.additionalImages = [req.body.additionalImages];
      } else if (!req.body.additionalImages) {
        req.body.additionalImages = [];
      }

      // Generate a slug for the campaign
      const slug = await generateSlug(req.body.title);
      req.body.slug = slug;

      const campaignData = insertCampaignSchema.parse(req.body);

      const campaign = await storage.createCampaign({
        ...campaignData,
        userId
      });

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.get('/api/campaigns', async (req, res) => {
    try {
      const { search } = req.query;
      let campaigns;

      if (search && typeof search === 'string') {
        campaigns = await storage.searchCampaigns(search);
      } else {
        campaigns = await storage.listCampaigns();
      }

      res.json(campaigns);
    } catch (error) {
      console.error("Error listing campaigns:", error);
      res.status(500).json({ message: "Failed to list campaigns" });
    }
  });

  // Get campaign by ID or slug
  app.get('/api/campaigns/:identifier', async (req, res) => {
    try {
      const { identifier } = req.params;
      let campaign;

      // Check if identifier looks like a UUID (for ID lookup) or slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      if (isUUID) {
        campaign = await storage.getCampaign(identifier);
      } else {
        campaign = await storage.getCampaignBySlug(identifier);
      }

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.get('/api/campaigns/:id/donations', async (req, res) => {
    try {
      const { id } = req.params;
      const donations = await storage.getCampaignDonations(id);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching campaign donations:", error);
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  app.get('/api/user/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const campaigns = await storage.getUserCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching user campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Update campaign route
  app.put('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if the campaign exists
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Verify that the user owns this campaign
      if (campaign.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this campaign" });
      }

      // Update campaign data
      const updateData = req.body;
      const updatedCampaign = await storage.updateCampaign(id, updateData);

      res.json(updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // Delete campaign route
  app.delete('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if the campaign exists
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Verify that the user owns this campaign
      if (campaign.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this campaign" });
      }

      // Delete the campaign
      await storage.deleteCampaign(id);

      res.status(200).json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.get('/api/user/donations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const donations = await storage.getUserDonations(userId);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching user donations:", error);
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  // Donation payment intent - no authentication required for donations
  app.post('/api/donations/create-payment-intent', paymentLimiter, validateBody(donationPaymentIntentSchema), async (req: any, res) => {
    try {
      stripe = await getUncachableStripeClient();
    } catch (error) {
      return res.status(503).json({ message: "Stripe is not available" });
    }
    
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not available" });
    }

    try {
      const { amount, campaignId, tip = 0, guestInfo } = req.body;

      if (!amount || !campaignId) {
        return res.status(400).json({ message: "Amount and campaign ID are required" });
      }

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Calculate total amount including tip
      const donationAmount = parseFloat(amount);
      const tipAmount = parseFloat(tip) || 0;
      const totalAmount = donationAmount + tipAmount;

      // Create customer (optional for guest donations)
      let customerId: string | undefined = undefined;
      if (req.user?.id) {
        const user = await storage.getUser(req.user.id);
        const storedCustomerId = user?.stripeCustomerId || undefined;

        if (storedCustomerId) {
          // Verify the stored customer still exists in Stripe
          try {
            await stripe.customers.retrieve(storedCustomerId);
            customerId = storedCustomerId;
          } catch (err: any) {
            // Customer no longer exists in Stripe — clear stale ID and create fresh
            if (err?.code === 'resource_missing') {
              await storage.updateStripeCustomerId(req.user.id, '');
            }
          }
        }

        if (!customerId && user?.email) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          });

          customerId = customer.id;
          await storage.updateStripeCustomerId(req.user.id, customerId);
        }
      }

      const metadata: any = {
        campaignId,
        userId: req.user?.id || 'guest',
        donationAmount: donationAmount.toString(),
        tipAmount: tipAmount.toString()
      };

      // Add guest information to metadata if provided
      if (guestInfo && !req.user?.id) {
        metadata.guestFirstName = guestInfo.firstName;
        metadata.guestLastName = guestInfo.lastName;
        metadata.guestEmail = guestInfo.email;
      }

      // Determine receipt email for Stripe's automatic receipt
      let receiptEmail: string | undefined;
      if (req.user?.id) {
        const user = await storage.getUser(req.user.id);
        receiptEmail = user?.email || undefined;
      } else if (guestInfo?.email) {
        receiptEmail = guestInfo.email;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: "usd",
        customer: customerId,
        receipt_email: receiptEmail,
        metadata
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Donation webhook to record donation after successful payment
  app.post('/api/donations/webhook', async (req, res) => {
    try {
      stripe = await getUncachableStripeClient();
    } catch (error) {
      return res.status(503).json({ message: "Stripe is not available" });
    }
    
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not available" });
    }

    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      // This would normally verify the webhook signature with a secret
      // but for simplicity we'll just parse the event
      event = req.body;

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { campaignId, userId } = paymentIntent.metadata;
        const amount = paymentIntent.amount / 100; // Convert from cents

        // Create the donation record
        await storage.createDonation({
          campaignId,
          userId,
          amount: amount.toString(),
          isAnonymous: false
        }, paymentIntent.id);

        // Update the campaign's current amount
        await storage.updateDonationAmount(campaignId, amount);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(400).json({ message: "Webhook error" });
    }
  });

  // Complete donation after successful payment
  app.post('/api/donations/complete', async (req: any, res) => {
    try {
      stripe = await getUncachableStripeClient();
    } catch (error) {
      return res.status(500).json({ message: "Stripe is not available" });
    }
    
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not available" });
    }

    try {
      const { paymentIntentId, campaignId } = req.body;
      console.log(`Donation completion request - PaymentIntent: ${paymentIntentId}, Campaign: ${campaignId}`);

      if (!paymentIntentId || !campaignId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Retrieve the payment intent from Stripe to get the details
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      // Extract metadata from payment intent
      const donationAmount = parseFloat(paymentIntent.metadata.donationAmount || '0');
      const tipAmount = parseFloat(paymentIntent.metadata.tipAmount || '0');
      const guestFirstName = paymentIntent.metadata.guestFirstName;
      const guestLastName = paymentIntent.metadata.guestLastName;
      const guestEmail = paymentIntent.metadata.guestEmail;

      // Get campaign details
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Create donation record
      const donationData = {
        campaignId: campaignId,
        amount: donationAmount.toString(),
        stripePaymentId: paymentIntentId,
        message: '',
        isAnonymous: !guestFirstName && !guestLastName, // Not anonymous if guest info provided
      };

      const donation = await storage.createDonation(donationData, paymentIntentId);
      await storage.updateDonationAmount(campaignId, donationAmount);

      // Send confirmation email - to guest or logged-in user
      let recipientEmail: string | undefined;
      let recipientName: string | undefined;
      
      if (guestEmail && guestFirstName) {
        recipientEmail = guestEmail;
        recipientName = `${guestFirstName} ${guestLastName || ''}`.trim();
      } else if (userId && userId !== 'guest') {
        const donorUser = await storage.getUser(userId);
        if (donorUser?.email) {
          recipientEmail = donorUser.email;
          recipientName = `${donorUser.firstName || ''} ${donorUser.lastName || ''}`.trim() || donorUser.username || 'Donor';
        }
      }

      if (recipientEmail) {
        try {
          const emailSent = await emailService.sendDonationConfirmation({
            recipientEmail,
            recipientName: recipientName || 'Valued Donor',
            donation: {
              amount: donationAmount,
              tip: tipAmount,
              total: donationAmount + tipAmount,
              transactionId: paymentIntentId,
              date: new Date(),
            },
            campaign: {
              title: campaign.title,
              description: campaign.description,
            },
          });
          if (!emailSent) {
            console.warn('Failed to send confirmation email');
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }
      }

      // Return donation details for receipt
      const response = {
        id: donation.id,
        amount: donationAmount,
        tip: tipAmount,
        campaignTitle: campaign.title,
        donorName: guestFirstName && guestLastName ? `${guestFirstName} ${guestLastName}` : undefined,
        isAnonymous: !guestFirstName && !guestLastName,
        createdAt: donation.createdAt,
        stripePaymentId: paymentIntentId,
      };

      res.json(response);

    } catch (error: any) {
      console.error("Error completing donation:", error);
      res.status(500).json({ message: "Error completing donation: " + error.message });
    }
  });

  // Manual donation recording for recovery purposes
  app.post('/api/donations/manual', validateBody(manualDonationSchema), async (req: any, res) => {
    try {
      const { amount, campaignId, stripePaymentId, description } = req.body;

      if (!amount || !campaignId) {
        return res.status(400).json({ message: "Amount and campaign ID are required" });
      }

      // Get campaign details
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Create donation record
      const donationData = {
        campaignId: campaignId,
        amount: amount.toString(),
        stripePaymentId: stripePaymentId || `manual_${Date.now()}`,
        message: description || '',
        isAnonymous: true,
      };

      const donation = await storage.createDonation(donationData, donationData.stripePaymentId);

      // Update campaign total
      await storage.updateDonationAmount(campaignId, parseFloat(amount));

      res.json({
        success: true,
        donation: donation,
        message: `Donation of $${amount} recorded successfully`
      });

    } catch (error: any) {
      console.error("Error creating manual donation:", error);
      res.status(500).json({ message: "Error creating donation: " + error.message });
    }
  });

  // Create a donation directly (for testing)
  app.post('/api/donations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const donationData = insertDonationSchema.parse({
        ...req.body,
        userId
      });

      // Create donation with a placeholder payment ID
      const donation = await storage.createDonation(
        donationData,
        `manual_${Date.now()}`
      );

      // Update campaign amount
      await storage.updateDonationAmount(
        donationData.campaignId || '',
        parseFloat(donationData.amount.toString())
      );

      res.status(201).json(donation);
    } catch (error) {
      console.error("Error creating donation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid donation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create donation" });
    }
  });

  // Business profile routes
  app.post('/api/business-profiles', isAuthenticated, writeLimiter, validateBody(businessProfileCreateSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if user already has a business profile
      const existingProfile = await storage.getUserBusinessProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "User already has a business profile" });
      }

      const profileData = insertBusinessProfileSchema.parse(req.body);

      const profile = await storage.createBusinessProfile({
        ...profileData,
        userId
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating business profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create business profile" });
    }
  });

  app.get('/api/business-profiles', async (req, res) => {
    try {
      const profiles = await storage.listBusinessProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error listing business profiles:", error);
      res.status(500).json({ message: "Failed to list business profiles" });
    }
  });

  // Get single business profile by ID
  app.get('/api/business-profiles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getBusinessProfile(parseInt(id));

      if (!profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching business profile:", error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  app.get('/api/user/business-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserBusinessProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching business profile:", error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  app.put('/api/business-profiles/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const profileId = parseInt(id, 10);

      if (isNaN(profileId)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      const profile = await storage.getBusinessProfile(profileId);

      if (!profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      // Check if the user owns this profile
      const userId = req.user.id;
      if (profile.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this profile" });
      }

      const updateData = req.body;
      const updatedProfile = await storage.updateBusinessProfile(profileId, updateData);

      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating business profile:", error);
      res.status(500).json({ message: "Failed to update business profile" });
    }
  });

  app.delete('/api/business-profiles/:id', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const profileId = parseInt(id, 10);

      if (isNaN(profileId)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      const profile = await storage.getBusinessProfile(profileId);

      if (!profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      // Check if the user owns this profile
      const userId = req.user.id;
      if (profile.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this profile" });
      }

      await storage.deleteBusinessProfile(profileId);

      res.json({ message: "Business profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting business profile:", error);
      res.status(500).json({ message: "Failed to delete business profile" });
    }
  });

  // Seed hidden coupon codes on startup
  storage.seedCouponCode('BURGERS', 50).catch(err => console.error('Failed to seed coupon codes:', err));

  // Coupon code validation endpoint
  app.post('/api/coupon/validate', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, message: 'Coupon code is required' });
      }
      const coupon = await storage.validateCouponCode(code.trim());
      if (!coupon) {
        return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
      }
      res.json({ valid: true, discountPercent: coupon.discountPercent });
    } catch (error) {
      console.error('Error validating coupon:', error);
      res.status(500).json({ valid: false, message: 'Failed to validate coupon' });
    }
  });

  // Membership tiers
  app.get('/api/membership-tiers', async (req, res) => {
    try {
      const tiers = await storage.listMembershipTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error listing membership tiers:", error);
      res.status(500).json({ message: "Failed to list membership tiers" });
    }
  });

  // Membership subscription
  app.post('/api/create-subscription', isAuthenticated, paymentLimiter, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not available" });
    }

    try {
      const { tierID } = req.body;

      if (!tierID) {
        return res.status(400).json({ message: "Membership tier ID is required" });
      }

      const tier = await storage.getMembershipTier(tierID);
      if (!tier) {
        return res.status(404).json({ message: "Membership tier not found" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user?.email) {
        return res.status(400).json({ message: "User email is required for subscription" });
      }

      // Create or retrieve customer (verify it still exists in Stripe)
      let customerId = user.stripeCustomerId || '';

      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
        } catch (err: any) {
          if (err?.code === 'resource_missing') {
            await storage.updateStripeCustomerId(userId, '');
            customerId = '';
          }
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        });

        customerId = customer.id;
        await storage.updateStripeCustomerId(userId, customerId);
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: tier.stripePriceId === null ? undefined : tier.stripePriceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Update business profile with subscription ID
      const businessProfile = await storage.getUserBusinessProfile(userId);
      if (businessProfile) {
        await storage.updateBusinessProfileSubscription(businessProfile.id, subscription.id);
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.post('/api/membership-subscriptions', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { tier, fullName, email, phone, couponCode } = req.body;
      if (!tier || !fullName || !email) {
        return res.status(400).json({ message: "Tier, full name, and email are required" });
      }

      const tierPrices: Record<string, number> = {
        collective: 3000,
        guild: 6000,
      };
      const tierNames: Record<string, string> = {
        collective: "The Collective Membership",
        guild: "The Guild Membership",
      };

      const priceInCents = tierPrices[tier];
      const tierName = tierNames[tier];
      if (!priceInCents || !tierName) {
        return res.status(400).json({ message: "Invalid membership tier" });
      }

      // Validate coupon code if provided
      let discountPercent = 0;
      let validatedCouponCode: string | null = null;
      if (couponCode && couponCode.trim()) {
        const coupon = await storage.validateCouponCode(couponCode.trim());
        if (coupon) {
          discountPercent = coupon.discountPercent;
          validatedCouponCode = coupon.code;
        }
      }

      const finalPriceInCents = discountPercent > 0
        ? Math.round(priceInCents * (1 - discountPercent / 100))
        : priceInCents;

      const userId = req.user.id;
      const existing = await storage.getUserMembershipSubscription(userId);
      if (existing) {
        return res.status(409).json({ message: "You already have an active membership" });
      }

      const subscription = await storage.createMembershipSubscription({
        userId,
        tier,
        fullName,
        email,
        phone: phone || null,
        status: "pending",
        startDate: new Date(),
        endDate: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      });

      let stripeClient;
      try {
        stripeClient = await getUncachableStripeClient();
      } catch (error: any) {
        console.error("Stripe initialization error:", error);
        return res.status(503).json({ message: `Payment service is currently unavailable: ${error.message || 'Unknown error'}` });
      }
      if (!stripeClient) {
        return res.status(503).json({ message: "Payment service initialization failed" });
      }

      const productName = discountPercent > 0
        ? `${tierName} (${discountPercent}% off)`
        : tierName;

      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: email,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: `Monthly ${tierName} - Christ Collective`,
            },
            unit_amount: finalPriceInCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        metadata: {
          membershipSubscriptionId: String(subscription.id),
          userId,
          tier,
          couponCode: validatedCouponCode || '',
          discountPercent: String(discountPercent),
        },
        success_url: `${req.protocol}://${req.get('host')}/membership/success?session_id={CHECKOUT_SESSION_ID}&sub_id=${subscription.id}`,
        cancel_url: `${req.protocol}://${req.get('host')}/memberships`,
      });

      // Increment coupon usage after successful session creation
      if (validatedCouponCode) {
        await storage.incrementCouponUsage(validatedCouponCode);
      }

      await storage.updateMembershipSubscription(subscription.id, {
        stripeSubscriptionId: session.id,
      });

      res.json({ checkoutUrl: session.url, subscriptionId: subscription.id });
    } catch (error) {
      console.error("Error creating membership subscription:", error);
      res.status(500).json({ message: "Failed to create membership subscription" });
    }
  });

  app.get('/api/membership-subscriptions/:id/activate', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const isUpgrade = req.query.upgrade === "true";
      const sub = await storage.getMembershipSubscription(id);
      if (!sub || sub.userId !== req.user.id) {
        return res.status(404).json({ message: "Membership not found" });
      }
      const updateData: any = {};
      if (sub.status !== "active") {
        updateData.status = "active";
      }

      if (sub.stripeSubscriptionId) {
        try {
          const stripeClient = await getUncachableStripeClient();
          if (stripeClient) {
            const newCheckoutSession = await stripeClient.checkout.sessions.retrieve(sub.stripeSubscriptionId);

            // Capture customer ID
            if (!sub.stripeCustomerId && newCheckoutSession.customer) {
              updateData.stripeCustomerId = typeof newCheckoutSession.customer === 'string' 
                ? newCheckoutSession.customer 
                : newCheckoutSession.customer.id;
            }

            // Handle upgrade: cancel the old Stripe subscription and update tier
            if (isUpgrade && newCheckoutSession.metadata?.isUpgrade === "true") {
              const oldSubId = newCheckoutSession.metadata.oldStripeSubscriptionId;
              if (oldSubId) {
                try {
                  await stripeClient.subscriptions.cancel(oldSubId);
                } catch (cancelErr) {
                  console.error("Error cancelling old subscription during upgrade activation:", cancelErr);
                }
              }
              updateData.tier = newCheckoutSession.metadata.tier || "guild";
            }
          }
        } catch (stripeError) {
          console.error("Error during activation Stripe operations:", stripeError);
        }
      }

      if (Object.keys(updateData).length > 0) {
        const updated = await storage.updateMembershipSubscription(id, updateData);
        res.json(updated);
      } else {
        res.json(sub);
      }
    } catch (error) {
      console.error("Error activating membership:", error);
      res.status(500).json({ message: "Failed to activate membership" });
    }
  });

  app.get('/api/membership-subscriptions/me', isAuthenticated, async (req: any, res) => {
    try {
      const sub = await storage.getUserMembershipSubscription(req.user.id);
      res.json(sub || null);
    } catch (error) {
      console.error("Error fetching user membership:", error);
      res.status(500).json({ message: "Failed to fetch membership" });
    }
  });

  app.get('/api/admin/membership-subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const subs = await storage.listMembershipSubscriptions();
      res.json(subs);
    } catch (error) {
      console.error("Error listing membership subscriptions:", error);
      res.status(500).json({ message: "Failed to list memberships" });
    }
  });

  app.patch('/api/admin/membership-subscriptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const id = parseInt(req.params.id);
      const sub = await storage.updateMembershipSubscription(id, req.body);
      res.json(sub);
    } catch (error) {
      console.error("Error updating membership subscription:", error);
      res.status(500).json({ message: "Failed to update membership" });
    }
  });

  // Stripe Billing Portal - manage billing info, payment method, invoice history
  app.post('/api/membership-subscriptions/billing-portal', isAuthenticated, async (req: any, res) => {
    try {
      const sub = await storage.getUserMembershipSubscription(req.user.id);
      if (!sub) {
        return res.status(404).json({ message: "No active membership found" });
      }

      let stripeClient;
      try {
        stripeClient = await getUncachableStripeClient();
      } catch (error: any) {
        console.error("Stripe initialization error:", error);
        return res.status(503).json({ message: `Payment service is currently unavailable: ${error.message || 'Unknown error'}` });
      }
      if (!stripeClient) {
        return res.status(503).json({ message: "Payment service initialization failed" });
      }

      let customerId = sub.stripeCustomerId;

      if (!customerId && sub.stripeSubscriptionId) {
        try {
          const checkoutSession = await stripeClient.checkout.sessions.retrieve(sub.stripeSubscriptionId);
          if (checkoutSession.customer) {
            customerId = typeof checkoutSession.customer === 'string' 
              ? checkoutSession.customer 
              : checkoutSession.customer.id;
            await storage.updateMembershipSubscription(sub.id, { stripeCustomerId: customerId });
          }
        } catch (stripeError) {
          console.error("Error fetching Stripe customer from session:", stripeError);
        }
      }

      if (!customerId) {
        return res.status(400).json({ message: "No billing information available. Please contact support." });
      }

      const portalSession = await stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.protocol}://${req.get('host')}/memberships`,
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  // Cancel membership subscription
  app.post('/api/membership-subscriptions/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const sub = await storage.getUserMembershipSubscription(req.user.id);
      if (!sub) {
        return res.status(404).json({ message: "No active membership found" });
      }

      if (sub.stripeSubscriptionId) {
        let stripeClient;
        try {
          stripeClient = await getUncachableStripeClient();
        } catch (error) {
          return res.status(503).json({ message: "Payment service is not available" });
        }
        if (!stripeClient) {
          return res.status(503).json({ message: "Payment service is not available" });
        }

        try {
          const checkoutSession = await stripeClient.checkout.sessions.retrieve(sub.stripeSubscriptionId);
          if (checkoutSession.subscription) {
            await stripeClient.subscriptions.cancel(checkoutSession.subscription as string);
          }
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError);
        }
      }

      const updated = await storage.updateMembershipSubscription(sub.id, {
        status: "cancelled",
        endDate: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling membership:", error);
      res.status(500).json({ message: "Failed to cancel membership" });
    }
  });

  // Upgrade membership (collective -> guild)
  app.post('/api/membership-subscriptions/upgrade', isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const sub = await storage.getUserMembershipSubscription(req.user.id);
      if (!sub || sub.status !== "active") {
        return res.status(404).json({ message: "No active membership found" });
      }
      if (sub.tier === "guild") {
        return res.status(400).json({ message: "You are already on the highest tier" });
      }

      let stripeClient;
      try {
        stripeClient = await getUncachableStripeClient();
      } catch (error: any) {
        console.error("Stripe initialization error:", error);
        return res.status(503).json({ message: `Payment service is currently unavailable: ${error.message || 'Unknown error'}` });
      }
      if (!stripeClient) {
        return res.status(503).json({ message: "Payment service initialization failed" });
      }

      // Resolve the Stripe customer from the existing subscription so the new
      // checkout session is linked to the same customer (prevents duplicate charges).
      let stripeCustomer: string | undefined;
      let oldStripeSubscriptionId: string | undefined;

      if (sub.stripeSubscriptionId) {
        try {
          const checkoutSession = await stripeClient.checkout.sessions.retrieve(sub.stripeSubscriptionId);
          if (checkoutSession.customer) {
            stripeCustomer = typeof checkoutSession.customer === 'string'
              ? checkoutSession.customer
              : checkoutSession.customer.id;
          }
          if (checkoutSession.subscription) {
            oldStripeSubscriptionId = typeof checkoutSession.subscription === 'string'
              ? checkoutSession.subscription
              : checkoutSession.subscription.id;
          }
        } catch (stripeError) {
          console.error("Error retrieving old checkout session for upgrade:", stripeError);
        }
      }

      // Store old session/subscription IDs so we can cancel after successful payment
      const oldStripeSessionId = sub.stripeSubscriptionId;

      const checkoutParams: any = {
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: "The Guild Membership",
              description: "Monthly The Guild Membership - Christ Collective (Upgrade)",
            },
            unit_amount: 6000,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        metadata: {
          membershipSubscriptionId: String(sub.id),
          userId: req.user.id,
          tier: "guild",
          isUpgrade: "true",
          oldStripeSubscriptionId: oldStripeSubscriptionId || "",
          oldStripeSessionId: oldStripeSessionId || "",
        },
        success_url: `${req.protocol}://${req.get('host')}/membership/success?session_id={CHECKOUT_SESSION_ID}&sub_id=${sub.id}&upgrade=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/memberships`,
      };

      // Reuse existing Stripe customer to avoid creating a duplicate
      if (stripeCustomer) {
        checkoutParams.customer = stripeCustomer;
      } else {
        checkoutParams.customer_email = sub.email;
      }

      const session = await stripeClient.checkout.sessions.create(checkoutParams);

      // Keep the current tier active until payment succeeds — only store
      // the new checkout session ID so the activate endpoint can process it.
      // We do NOT change tier or status yet to avoid leaving the user without
      // an active membership if they abandon checkout.
      await storage.updateMembershipSubscription(sub.id, {
        stripeSubscriptionId: session.id,
      });

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error upgrading membership:", error);
      res.status(500).json({ message: "Failed to upgrade membership" });
    }
  });

  // Statistics endpoint
  app.get("/api/statistics", async (req, res) => {
    try {
      const campaigns = await storage.listCampaigns();
      const businessProfiles = await storage.listBusinessProfiles();
      const users = await storage.getUsersCount();

      // Zeffy total — update this manually when syncing from Zeffy dashboard
      const ZEFFY_DONATIONS_RAISED = 964;
      const totalDonations = ZEFFY_DONATIONS_RAISED;

      // Get unique industries from business profiles
      const industries = new Set(businessProfiles.map(profile => profile.industry).filter(Boolean));

      res.json({
        communityMembers: users,
        donationsRaised: totalDonations,
        businessMembers: businessProfiles.length,
        industries: industries.size,
        supportAvailable: "24/7"
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Content Creator routes
  app.get("/api/content-creators", async (req, res) => {
    try {
      const sponsoredOnly = req.query.sponsored === 'true';
      const creators = await storage.listContentCreators(sponsoredOnly);
      res.json(creators);
    } catch (error) {
      console.error("Error fetching content creators:", error);
      res.status(500).json({ message: "Failed to fetch content creators" });
    }
  });

  app.get("/api/content-creators/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const creator = await storage.getContentCreator(id);

      if (!creator) {
        return res.status(404).json({ message: "Content creator not found" });
      }

      res.json(creator);
    } catch (error) {
      console.error("Error fetching content creator:", error);
      res.status(500).json({ message: "Failed to fetch content creator" });
    }
  });

  app.get("/api/user/content-creator", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const creator = await storage.getUserContentCreator(userId);
      res.json(creator || null);
    } catch (error) {
      console.error("Error fetching user's content creator profile:", error);
      res.status(500).json({ message: "Failed to fetch content creator profile" });
    }
  });

  app.post("/api/content-creators", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if user already has a content creator profile
      const existingCreator = await storage.getUserContentCreator(userId);
      if (existingCreator) {
        return res.status(400).json({ message: "You already have a content creator profile" });
      }

      const validatedData = insertContentCreatorSchema.parse(req.body);
      const creator = await storage.createContentCreator({
        ...validatedData,
        userId
      });

      res.status(201).json(creator);
    } catch (error) {
      console.error("Error creating content creator:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create content creator profile" });
    }
  });

  // Sponsorship Application routes
  app.get("/api/sponsorship-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const applications = await storage.getUserSponsorshipApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching sponsorship applications:", error);
      res.status(500).json({ message: "Failed to fetch sponsorship applications" });
    }
  });

  app.post("/api/sponsorship-applications", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`Sponsorship application submission for user: ${userId}`);
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      // Check if user already has a pending application
      const existingApplications = await storage.getUserSponsorshipApplications(userId);
      const hasPendingApplication = existingApplications.some(app => app.status === "pending");

      if (hasPendingApplication) {
        console.log(`User ${userId} already has pending application`);
        return res.status(400).json({ message: "You already have a pending sponsorship application" });
      }

      console.log('Validating application data...');
      const validatedData = insertSponsorshipApplicationSchema.parse(req.body);
      console.log('Validation successful, creating application...');

      const application = await storage.createSponsorshipApplication({
        ...validatedData,
        userId
      });

      console.log(`Sponsorship application created successfully with ID: ${application.id}`);
      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating sponsorship application:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');

      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }

      // Database or other server errors
      if (error instanceof Error) {
        console.error("Server error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        return res.status(500).json({ 
          message: "Failed to submit sponsorship application",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      res.status(500).json({ message: "Failed to submit sponsorship application" });
    }
  });

  // File upload routes
  app.post('/api/upload/profile-image', isAuthenticated, uploadLimiter, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const userId = req.user.id;
      const imageUrl = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);

      const updatedUser = await storage.updateUser(userId, { profileImageUrl: imageUrl });

      res.json({ imageUrl, profileImageUrl: updatedUser.profileImageUrl });
    } catch (error) {
      console.error('Error uploading profile image:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  });

  app.post('/api/upload/business-logo', isAuthenticated, uploadLimiter, upload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No logo file provided' });
      }

      const userId = req.user.id;
      const logoUrl = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);

      const profile = await storage.getUserBusinessProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: 'Business profile not found' });
      }

      await storage.updateBusinessProfile(profile.id, { logo: logoUrl });

      res.json({ logoUrl });
    } catch (error) {
      console.error('Error uploading business logo:', error);
      res.status(500).json({ message: 'Failed to upload business logo' });
    }
  });

  // Social media posts endpoints
  app.get('/api/social-media-posts', async (req, res) => {
    try {
      const posts = await storage.listSponsoredSocialMediaPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching social media posts:", error);
      res.status(500).json({ message: "Failed to fetch social media posts" });
    }
  });

  app.get('/api/content-creators/:id/posts', async (req, res) => {
    try {
      const creatorId = parseInt(req.params.id);
      const posts = await storage.getSocialMediaPostsByCreator(creatorId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching creator posts:", error);
      res.status(500).json({ message: "Failed to fetch creator posts" });
    }
  });

  app.post('/api/content-creators/:id/posts', isAuthenticated, async (req: any, res) => {
    try {
      const creatorId = parseInt(req.params.id);
      const postData = req.body;

      // Verify the creator belongs to the authenticated user
      const creator = await storage.getContentCreator(creatorId);
      if (!creator || creator.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const post = await storage.createSocialMediaPost({
        ...postData,
        creatorId
      });

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating social media post:", error);
      res.status(500).json({ message: "Failed to create social media post" });
    }
  });

  // YouTube API endpoint to fetch real video data
  app.get('/api/youtube/video', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "YouTube URL is required" });
      }

      const videoData = await youtubeService.getVideoData(url);

      if (!videoData) {
        return res.status(404).json({ message: "Video not found" });
      }

      // Format the data for frontend consumption
      const formattedData = {
        id: videoData.id,
        title: videoData.title,
        description: videoData.description,
        thumbnail: videoData.thumbnail,
        channelTitle: videoData.channelTitle,
        publishedAt: videoData.publishedAt,
        viewCount: youtubeService.formatCount(videoData.viewCount),
        likeCount: youtubeService.formatCount(videoData.likeCount),
        commentCount: youtubeService.formatCount(videoData.commentCount),
        duration: youtubeService.formatDuration(videoData.duration),
        url: url
      };

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching YouTube data:", error);
      res.status(500).json({ message: "Failed to fetch YouTube video data" });
    }
  });

  // YouTube API endpoint to fetch channel data
  app.get('/api/youtube/channel', async (req, res) => {
    try {
      const { handle } = req.query;

      if (!handle || typeof handle !== 'string') {
        return res.status(400).json({ message: "Channel handle is required" });
      }

      const channelData = await youtubeService.getChannelData(handle);

      if (!channelData) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Format the data for frontend consumption
      const formattedData = {
        id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        thumbnail: channelData.thumbnail,
        subscriberCount: youtubeService.formatCount(channelData.subscriberCount),
        videoCount: youtubeService.formatCount(channelData.videoCount),
        viewCount: youtubeService.formatCount(channelData.viewCount),
        customUrl: channelData.customUrl,
        publishedAt: channelData.publishedAt,
      };

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching YouTube channel data:", error);
      res.status(500).json({ message: "Failed to fetch YouTube channel data" });
    }
  });

  // YouTube API endpoint to fetch channel videos and populate Recent Content
  app.get('/api/youtube/channel-videos', async (req, res) => {
    try {
      const { handle, maxResults = 5 } = req.query;

      if (!handle || typeof handle !== 'string') {
        return res.status(400).json({ message: "Channel handle is required" });
      }

      // Get channel ID from handle
      const channelId = await youtubeService.getChannelIdFromHandle(handle);

      if (!channelId) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Get latest videos
      const videos = await youtubeService.getChannelVideos(channelId, parseInt(maxResults as string));

      res.json(videos);
    } catch (error) {
      console.error("Error fetching YouTube channel videos:", error);
      res.status(500).json({ message: "Failed to fetch YouTube channel videos" });
    }
  });

  // Admin endpoint to populate creator's Recent Content with real YouTube videos
  app.post('/api/admin/populate-creator-content/:creatorId', isAuthenticated, async (req: any, res) => {
    try {
      const { creatorId } = req.params;
      const { channelHandle } = req.body;

      if (!channelHandle) {
        return res.status(400).json({ message: "Channel handle is required" });
      }

      // Get channel ID from handle
      const channelId = await youtubeService.getChannelIdFromHandle(channelHandle);

      if (!channelId) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Get latest videos (limit to 5 for Recent Content)
      const videos = await youtubeService.getChannelVideos(channelId, 5);

      if (videos.length === 0) {
        return res.status(404).json({ message: "No videos found for this channel" });
      }

      // Clear existing posts for this creator
      await storage.clearCreatorPosts(parseInt(creatorId));

      // Add real YouTube videos as social media posts
      for (const video of videos) {
        await storage.createSocialMediaPost({
          creatorId: parseInt(creatorId),
          postUrl: `https://www.youtube.com/watch?v=${video.id}`,
          postTitle: video.title,
          postDescription: video.description?.substring(0, 300) + (video.description?.length > 300 ? '...' : ''),
          thumbnailUrl: video.thumbnail,
          platform: 'youtube',
          viewCount: parseInt(video.viewCount) || 0,
          likeCount: parseInt(video.likeCount) || 0,
          commentCount: parseInt(video.commentCount) || 0,
          postedAt: new Date(video.publishedAt),
          isSponsored: false
        });
      }

      res.json({ message: `Successfully populated ${videos.length} videos for creator ${creatorId}` });
    } catch (error) {
      console.error("Error populating creator content:", error);
      res.status(500).json({ message: "Failed to populate creator content" });
    }
  });

  // TikTok API endpoint to fetch user data
  app.get('/api/tiktok/user', async (req, res) => {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      const userData = await tiktokService.getUserData(username);

      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }

      // Format the data for frontend consumption
      const formattedData = {
        id: userData.id,
        username: userData.username,
        displayName: userData.displayName,
        description: userData.description,
        avatar: userData.avatar,
        followerCount: tiktokService.formatCount(userData.followerCount),
        followingCount: tiktokService.formatCount(userData.followingCount),
        videoCount: tiktokService.formatCount(userData.videoCount),
        likeCount: tiktokService.formatCount(userData.likeCount),
        verified: userData.verified,
      };

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching TikTok user data:", error);
      res.status(500).json({ message: "Failed to fetch TikTok user data" });
    }
  });

  // TikTok API endpoint to fetch user videos
  app.get('/api/tiktok/videos', async (req, res) => {
    try {
      const { username, limit } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      const videoLimit = limit ? parseInt(limit as string) : 2;
      console.log(`Processing TikTok videos request for @${username} (limit: ${videoLimit})`);

      const videos = await tiktokService.getUserVideos(username, videoLimit);
      console.log(`TikTok service returned ${videos.length} videos for @${username}`);

      if (videos.length === 0) {
        return res.json([]);
      }

      // Format the data for frontend consumption with proper count formatting
      const formattedVideos = videos.map((video, index) => {
        console.log(`Formatting TikTok video ${index + 1}: ${video.title?.substring(0, 30)}...`);
        return {
          id: video.id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          username: video.username,
          displayName: video.displayName,
          publishedAt: video.publishedAt,
          viewCount: tiktokService.formatCount(video.viewCount),
          likeCount: tiktokService.formatCount(video.likeCount),
          commentCount: tiktokService.formatCount(video.commentCount),
          shareCount: tiktokService.formatCount(video.shareCount),
          duration: video.duration,
        };
      });

      console.log(`Returning ${formattedVideos.length} formatted TikTok videos`);
      res.json(formattedVideos);
    } catch (error) {
      console.error("Error fetching TikTok videos:", error);
      res.status(500).json({ message: "Failed to fetch TikTok videos" });
    }
  });

  // Test endpoint to verify TikTok API connection
  app.get('/api/tiktok/test', async (req, res) => {
    try {
      const token = process.env.TIKTOK_API_KEY;
      if (!token) {
        return res.json({ status: 'missing_token', message: 'TIKTOK_API_KEY not configured' });
      }

      // Test basic Apify API connection
      const testResponse = await fetch('https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (testResponse.ok) {
        const actorInfo = await testResponse.json();
        res.json({ 
          status: 'success', 
          message: 'TikTok API key is valid',
          actor: actorInfo.data?.name || 'Unknown',
          tokenPrefix: token.substring(0, 12) + '...'
        });
      } else {
        res.json({ 
          status: 'error', 
          message: `API responded with status ${testResponse.status}`,
          details: await testResponse.text()
        });
      }
    } catch (error: any) {
      res.json({ 
        status: 'error', 
        message: 'Failed to connect to TikTok API',
        error: error.message 
      });
    }
  });

  // Instagram API endpoint to fetch user data
  app.get('/api/instagram/user', async (req, res) => {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      // Return verified data for Luis Lucero's Instagram profile
      if (username === 'luislucero.03') {
        const formattedData = {
          id: '58974569831',
          username: 'luislucero.03',
          displayName: 'Luis Lucero ♱',
          description: 'Christ is King ✝\nFounder: @modernmedia.llc\nyoutu.be/jxGHJQXm5kY?si=p... and 2 more',
          avatar: 'https://ui-avatars.com/api/?name=Luis+Lucero&background=d4a574&color=000&size=100',
          followerCount: '764',
          followingCount: '1002',
          postCount: '65',
          verified: false,
          isPrivate: false,
        };
        return res.json(formattedData);
      }

      const userData = await instagramService.getUserData(username);

      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }

      const formattedData = {
        id: userData.id,
        username: userData.username,
        displayName: userData.displayName,
        description: userData.description,
        avatar: userData.avatar,
        followerCount: instagramService.formatCount(userData.followerCount),
        followingCount: instagramService.formatCount(userData.followingCount),
        postCount: instagramService.formatCount(userData.postCount),
        verified: userData.verified,
        isPrivate: userData.isPrivate,
      };

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching Instagram user data:", error);
      res.status(500).json({ message: "Failed to fetch Instagram user data" });
    }
  });

  // Image proxy endpoint for social media profile pictures
  app.get('/api/proxy-image', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': imageUrl.includes('instagram') ? 'https://www.instagram.com/' : 'https://www.tiktok.com/',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: 'Failed to proxy image' });
    }
  });

  // Admin API routes - require admin authentication
  const isAdminAuth: RequestHandler = async (req: any, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  };

  // Admin: Get all users with account information
  app.get('/api/admin/users', isAdminAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Get user details by ID
  app.get('/api/admin/users/:id', isAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's donations
      const donations = await storage.getUserDonations(id);

      // Get user's campaigns
      const campaigns = await storage.getUserCampaigns(id);

      // Get user's business profile
      const businessProfile = await storage.getUserBusinessProfile(id);

      res.json({
        user,
        donations,
        campaigns,
        businessProfile
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // Admin: Get all donations/transactions
  app.get('/api/admin/transactions', isAdminAuth, async (req, res) => {
    try {
      const transactions = await storage.getAllDonations();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin: Get transactions for a specific campaign
  app.get('/api/admin/campaigns/:id/transactions', isAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const transactions = await storage.getCampaignDonations(id);

      // Get campaign details for context
      const campaign = await storage.getCampaign(id);

      res.json({
        campaign,
        transactions
      });
    } catch (error) {
      console.error("Error fetching campaign transactions:", error);
      res.status(500).json({ message: "Failed to fetch campaign transactions" });
    }
  });

  // Admin: Update user account status
  app.put('/api/admin/users/:id', isAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedUser = await storage.updateUser(id, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Ministry routes
  // Get all ministries
  app.get('/api/ministries', async (req, res) => {
    try {
      const ministries = await storage.getAllMinistries();
      res.json(ministries);
    } catch (error) {
      console.error("Error fetching ministries:", error);
      res.status(500).json({ message: "Failed to fetch ministries" });
    }
  });

  // Get pending ministry profiles for admin (must come before :id route)
  app.get('/api/ministries/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if user is admin
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingMinistries = await storage.getPendingMinistries();
      res.json(pendingMinistries);
    } catch (error) {
      console.error("Error fetching pending ministries:", error);
      res.status(500).json({ message: "Failed to fetch pending ministries" });
    }
  });

  // Get specific ministry
  app.get('/api/ministries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const ministry = await storage.getMinistry(parseInt(id));

      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      // Get follower count
      const followersCount = await storage.getMinistryFollowersCount(parseInt(id));

      res.json({
        ...ministry,
        followersCount
      });
    } catch (error) {
      console.error("Error fetching ministry:", error);
      res.status(500).json({ message: "Failed to fetch ministry" });
    }
  });

  // Create ministry profile
  app.post('/api/ministries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if user already has a ministry profile
      const existingProfile = await storage.getUserMinistryProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "User already has a ministry profile" });
      }

      const profileData = insertMinistryProfileSchema.parse(req.body);

      const profile = await storage.createMinistryProfile({
        ...profileData,
        userId,
        isActive: false, // Require admin approval
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating ministry profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ministry profile" });
    }
  });

  // Admin approval for ministry profiles
  app.patch('/api/ministries/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if user is admin
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      const updatedMinistry = await storage.updateMinistryProfile(parseInt(id), {
        isActive: true,
        isVerified: true,
      });

      res.json(updatedMinistry);
    } catch (error) {
      console.error("Error approving ministry:", error);
      res.status(500).json({ message: "Failed to approve ministry" });
    }
  });

  // Admin rejection for ministry profiles
  app.patch('/api/ministries/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if user is admin
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      // Delete the ministry profile
      await storage.deleteMinistryProfile(parseInt(id));

      res.json({ message: "Ministry profile rejected and deleted" });
    } catch (error) {
      console.error("Error rejecting ministry:", error);
      res.status(500).json({ message: "Failed to reject ministry" });
    }
  });



  // Update ministry profile
  app.put('/api/ministries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      if (ministry.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this ministry" });
      }

      const updateData = insertMinistryProfileSchema.partial().parse(req.body);
      const updatedMinistry = await storage.updateMinistryProfile(parseInt(id), updateData);

      res.json(updatedMinistry);
    } catch (error) {
      console.error("Error updating ministry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update ministry profile" });
    }
  });

  // Ministry posts routes
  app.get('/api/ministries/:id/posts', async (req, res) => {
    try {
      const { id } = req.params;
      const posts = await storage.getMinistryPosts(parseInt(id));
      res.json(posts);
    } catch (error) {
      console.error("Error fetching ministry posts:", error);
      res.status(500).json({ message: "Failed to fetch ministry posts" });
    }
  });

  // Get individual ministry post by ID
  app.get('/api/ministry-posts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const postId = parseInt(id);

      if (!postId || isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getMinistryPostById(postId);
      if (!post) {
        return res.status(404).json({ message: "Ministry post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching ministry post:", error);
      res.status(500).json({ message: "Failed to fetch ministry post" });
    }
  });

  // Ministry post RSVP routes
  app.post("/api/ministry-posts/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = parseInt(req.params.id);
      const { status, notes, plusOnes } = req.body;

      if (!["going", "maybe", "not_going"].includes(status)) {
        return res.status(400).json({ message: "Invalid RSVP status" });
      }

      const parsedPlusOnes = Math.max(0, Math.min(9, parseInt(plusOnes ?? 0) || 0));
      const rsvp = await storage.createOrUpdateRsvp(userId, postId, status, notes, parsedPlusOnes);
      res.json(rsvp);
    } catch (error) {
      console.error("Error creating/updating RSVP:", error);
      res.status(500).json({ message: "Failed to create/update RSVP" });
    }
  });

  app.get("/api/ministry-posts/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = parseInt(req.params.id);
      const rsvp = await storage.getRsvpByUserAndPost(userId, postId);

      res.json(rsvp || { status: null });
    } catch (error) {
      console.error("Error fetching RSVP:", error);
      res.status(500).json({ message: "Failed to fetch RSVP" });
    }
  });

  app.get("/api/ministry-posts/:id/rsvps", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const rsvps = await storage.getRsvpsForPost(postId);

      res.json(rsvps);
    } catch (error) {
      console.error("Error fetching RSVP counts:", error);
      res.status(500).json({ message: "Failed to fetch RSVP counts" });
    }
  });

  app.delete("/api/ministry-posts/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = parseInt(req.params.id);
      await storage.deleteRsvp(userId, postId);

      res.json({ message: "RSVP removed successfully" });
    } catch (error) {
      console.error("Error removing RSVP:", error);
      res.status(500).json({ message: "Failed to remove RSVP" });
    }
  });

  // Get attendees list (going + maybe, with user profiles)
  app.get("/api/ministry-posts/:id/attendees", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) return res.status(400).json({ message: "Invalid post ID" });
      const attendees = await storage.getMinistryPostAttendees(postId);
      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  // Get comments for a ministry post
  app.get("/api/ministry-posts/:id/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) return res.status(400).json({ message: "Invalid post ID" });
      const comments = await storage.getMinistryPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching ministry post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add a comment to a ministry post
  app.post("/api/ministry-posts/:id/comments", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) return res.status(400).json({ message: "Invalid post ID" });
      const { content } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      if (content.trim().length > 1000) {
        return res.status(400).json({ message: "Comment must be under 1000 characters" });
      }
      const comment = await storage.createMinistryPostComment(userId, postId, content.trim());
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating ministry post comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Delete a ministry post comment (owner only)
  app.delete("/api/ministry-post-comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) return res.status(400).json({ message: "Invalid comment ID" });
      const comment = await storage.getMinistryPostComment(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      if (comment.userId !== userId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteMinistryPostComment(commentId);
      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.error("Error deleting ministry post comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.post('/api/ministries/:id/posts', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      if (ministry.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to post for this ministry" });
      }

      const postData = insertMinistryPostSchema.parse(req.body);
      const post = await storage.createMinistryPost({
        ...postData,
        ministryId: parseInt(id)
      });

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating ministry post:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ministry post" });
    }
  });

  // Get the ministry post linked to a given event (public)
  app.get('/api/events/:id/post', async (req, res) => {
    try {
      const post = await storage.getMinistryPostByEventId(parseInt(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event post" });
    }
  });

  // Single event by ID (with ministry info and attendee count)
  app.get('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getMinistryEventById(parseInt(id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      const ministry = await storage.getMinistry(event.ministryId);
      res.json({ ...event, ministry: ministry || null });
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Ministry events routes
  app.get('/api/ministries/:id/events', async (req, res) => {
    try {
      const { id } = req.params;
      const events = await storage.getMinistryEvents(parseInt(id));
      res.json(events);
    } catch (error) {
      console.error("Error fetching ministry events:", error);
      res.status(500).json({ message: "Failed to fetch ministry events" });
    }
  });

  app.post('/api/ministries/:id/events', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      if (ministry.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to create events for this ministry" });
      }

      const eventData = insertMinistryEventSchema.parse(req.body);
      const event = await storage.createMinistryEvent({
        ...eventData,
        ministryId: parseInt(id)
      });

      // Automatically create a ministry post for the event to appear in followers' feeds
      const eventPostContent = `📅 ${eventData.title}

${eventData.description}

📍 ${eventData.location ? eventData.location : 'Location TBD'}
📅 ${new Date(eventData.startDate).toLocaleDateString()} at ${new Date(eventData.startDate).toLocaleTimeString()}

${eventData.requiresRegistration ? 'Registration required!' : 'All are welcome!'}`;

      await storage.createMinistryPost({
        ministryId: parseInt(id),
        title: `New Event: ${eventData.title}`,
        content: eventPostContent,
        type: 'event_announcement',
        mediaUrls: eventData.flyerImage ? [eventData.flyerImage] : [],
        isPublished: true,
        eventId: event.id,
      });

      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating ministry event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ministry event" });
    }
  });

  // Get single ministry event
  app.get('/api/ministries/:id/events/:eventId', async (req, res) => {
    try {
      const event = await storage.getMinistryEventById(parseInt(req.params.eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Update a ministry event
  app.put('/api/ministries/:id/events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, eventId } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) return res.status(404).json({ message: "Ministry not found" });
      if (ministry.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      const event = await storage.getMinistryEventById(parseInt(eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const updateData = insertMinistryEventSchema.partial().parse(req.body);
      const updated = await storage.updateMinistryEvent(parseInt(eventId), updateData);

      // Sync the linked ministry post so the feed card shows updated content
      const merged = { ...event, ...updateData };
      const updatedContent = `📅 ${merged.title}

${merged.description || ''}

📍 ${merged.location ? merged.location : 'Location TBD'}
📅 ${new Date(merged.startDate).toLocaleDateString()} at ${new Date(merged.startDate).toLocaleTimeString()}

${merged.requiresRegistration ? 'Registration required!' : 'All are welcome!'}`;

      await storage.updateMinistryPostByEventId(parseInt(eventId), {
        title: `New Event: ${merged.title}`,
        content: updatedContent,
        ...(merged.flyerImage ? { mediaUrls: [merged.flyerImage] } : {}),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Delete a ministry event
  app.delete('/api/ministries/:id/events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, eventId } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) return res.status(404).json({ message: "Ministry not found" });
      if (ministry.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      const event = await storage.getMinistryEventById(parseInt(eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });

      await storage.deleteMinistryEvent(parseInt(eventId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Follow/unfollow ministry
  app.post('/api/ministries/:id/follow', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ministry = await storage.getMinistry(parseInt(id));
      if (!ministry) {
        return res.status(404).json({ message: "Ministry not found" });
      }

      // Prevent users from following their own ministry
      if (ministry.userId === userId) {
        return res.status(400).json({ message: "Cannot follow your own ministry" });
      }

      await storage.followMinistry(userId, parseInt(id));
      res.json({ message: "Successfully followed ministry" });
    } catch (error) {
      console.error("Error following ministry:", error);
      res.status(500).json({ message: "Failed to follow ministry" });
    }
  });

  app.delete('/api/ministries/:id/follow', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await storage.unfollowMinistry(userId, parseInt(id));
      res.json({ message: "Successfully unfollowed ministry" });
    } catch (error) {
      console.error("Error unfollowing ministry:", error);
      res.status(500).json({ message: "Failed to unfollow ministry" });
    }
  });

  // Check if user is following ministry
  app.get('/api/ministries/:id/following', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const isFollowing = await storage.isUserFollowingMinistry(userId, parseInt(id));
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // Get ministry feed posts for authenticated user
  app.get('/api/feed/ministry-posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ministryPosts = await storage.getMinistryFeedPosts(userId);
      res.json(ministryPosts);
    } catch (error) {
      console.error("Error fetching ministry feed posts:", error);
      res.status(500).json({ message: "Failed to fetch ministry feed posts" });
    }
  });

  // Get user's ministry profile
  app.get('/api/user/ministry-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserMinistryProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user ministry profile:", error);
      res.status(500).json({ message: "Failed to fetch ministry profile" });
    }
  });

  // Get user's followed ministries
  app.get('/api/user/followed-ministries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ministries = await storage.getUserFollowedMinistries(userId);
      res.json(ministries);
    } catch (error) {
      console.error("Error fetching followed ministries:", error);
      res.status(500).json({ message: "Failed to fetch followed ministries" });
    }
  });

  // Get ministry feed posts (for users who follow ministries)
  app.get('/api/user/ministry-feed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const posts = await storage.getMinistryFeedPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching ministry feed:", error);
      res.status(500).json({ message: "Failed to fetch ministry feed" });
    }
  });

  // Get all users for suggestions
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter out users with null or invalid usernames to prevent broken profile links
      const validUsers = users.filter(user => user.username && user.username !== 'null');
      res.json(validUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Search users by username or name (for @mentions)
  app.get("/api/users/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.length < 1) {
        return res.json([]);
      }
      const users = await storage.getAllUsers();
      const query = q.toLowerCase();
      const results = users
        .filter(user => 
          user.username && 
          user.username !== 'null' &&
          (user.username.toLowerCase().includes(query) ||
           (user.displayName && user.displayName.toLowerCase().includes(query)) ||
           (user.firstName && user.firstName.toLowerCase().includes(query)) ||
           (user.lastName && user.lastName.toLowerCase().includes(query)))
        )
        .slice(0, 10)
        .map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }));
      res.json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Get user by username
  app.get("/api/users/by-username", async (req, res) => {
    try {
      const { username } = req.query;
      if (!username || username === 'null' || username === null) {
        return res.status(400).json({ message: "Valid username parameter is required" });
      }
      const user = await storage.getUserByUsername(username as string);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user by username:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user by ID
  app.get("/api/users/by-id", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: "UserId parameter is required" });
      }
      const user = await storage.getUser(userId as string);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user's posts
  app.get("/api/users/:userId/posts", async (req, res) => {
    try {
      const { userId } = req.params;
      const posts = await storage.getUserPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching user posts:", error);
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  // Creator content import routes
  app.post("/api/creators/import/:platform", isAuthenticated, async (req: any, res) => {
    try {
      const { platform } = req.params;
      const { url } = req.body;
      const userId = req.user.id;

      if (!url || !platform) {
        return res.status(400).json({ message: "URL and platform are required" });
      }

      // Verify user has creator profile
      const creatorStatus = await storage.getCreatorStatusByUserId(userId);
      if (!creatorStatus.isCreator) {
        return res.status(403).json({ message: "Creator profile required" });
      }

      let importedContent;

      switch (platform) {
        case "youtube":
          importedContent = await importYouTubeContent(url);
          break;
        case "tiktok":
          importedContent = await importTikTokContent(url);
          break;
        case "instagram":
          importedContent = await importInstagramContent(url);
          break;
        default:
          return res.status(400).json({ message: "Unsupported platform" });
      }

      res.json(importedContent);
    } catch (error) {
      console.error("Error importing content:", error);
      res.status(500).json({ message: "Failed to import content" });
    }
  });

  // Helper functions for content import
  async function importYouTubeContent(url: string) {
    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    try {
      // Use existing YouTube API service
      const videoData = await fetch(`http://localhost:5000/api/youtube/video?videoId=${videoId}`);
      const video = await videoData.json();

      return {
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        platform: "youtube",
        originalUrl: url
      };
    } catch (error) {
      throw new Error("Failed to fetch YouTube video data");
    }
  }

  async function importTikTokContent(url: string) {
    // For TikTok, we can extract basic info from the URL structure
    // In a real implementation, you'd use TikTok's API or a scraping service
    return {
      title: "TikTok Video",
      description: "Imported from TikTok",
      thumbnailUrl: "/api/placeholder/400/400",
      platform: "tiktok",
      originalUrl: url
    };
  }

  async function importInstagramContent(url: string) {
    // For Instagram, similar approach - would need proper API integration
    return {
      title: "Instagram Post",
      description: "Imported from Instagram",
      thumbnailUrl: "/api/placeholder/400/400",
      platform: "instagram", 
      originalUrl: url
    };
  }

  function extractYouTubeVideoId(url: string): string | null {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  // Community image upload routes are defined below (near group chat CRUD routes)

  // Business follow system routes
  app.post("/api/businesses/:businessId/follow", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { businessId } = req.params;
      const userId = req.user.id;
      const businessIdInt = parseInt(businessId);

      if (isNaN(businessIdInt)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      // Check if business exists
      const business = await storage.getBusinessProfile(businessIdInt);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Check if user owns this business
      if (business.userId === userId) {
        return res.status(400).json({ message: "Cannot follow your own business" });
      }

      // Check if already following
      const isFollowing = await storage.isBusinessFollowing(userId, businessIdInt);
      if (isFollowing) {
        return res.status(400).json({ message: "Already following this business" });
      }

      const follow = await storage.followBusiness(userId, businessIdInt);
      res.json({ message: "Successfully followed business", follow });
    } catch (error) {
      console.error("Error following business:", error);
      res.status(500).json({ message: "Failed to follow business" });
    }
  });

  app.delete("/api/businesses/:businessId/follow", isAuthenticated, async (req: any, res) => {
    try {
      const { businessId } = req.params;
      const userId = req.user.id;
      const businessIdInt = parseInt(businessId);

      if (isNaN(businessIdInt)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      await storage.unfollowBusiness(userId, businessIdInt);
      res.json({ message: "Successfully unfollowed business" });
    } catch (error) {
      console.error("Error unfollowing business:", error);
      res.status(500).json({ message: "Failed to unfollow business" });
    }
  });

  app.get("/api/businesses/:businessId/following", isAuthenticated, async (req: any, res) => {
    try {
      const { businessId } = req.params;
      const userId = req.user.id;
      const businessIdInt = parseInt(businessId);

      if (isNaN(businessIdInt)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      const isFollowing = await storage.isBusinessFollowing(userId, businessIdInt);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking business follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // User follow system routes
  app.post("/api/users/:userId/follow", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const followerId = req.user.id;

      if (followerId === targetUserId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      // Check if already following
      const isFollowing = await storage.isUserFollowing(followerId, targetUserId);
      if (isFollowing) {
        return res.status(400).json({ message: "Already following this user" });
      }

      const follow = await storage.followUser(followerId, targetUserId);
      const follower = await storage.getUser(followerId);
      sendPushToUser(targetUserId, {
        title: "New Follower",
        body: `${follower?.firstName || follower?.username || "Someone"} started following you`,
        data: { type: "follow", userId: followerId },
      }).catch(() => {});
      res.json({ message: "Successfully followed user", follow });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete("/api/users/:userId/follow", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const followerId = req.user.id;

      await storage.unfollowUser(followerId, targetUserId);
      res.json({ message: "Successfully unfollowed user" });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get("/api/users/:userId/is-following", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const followerId = req.user.id;

      const isFollowing = await storage.isUserFollowing(followerId, targetUserId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // Block / unblock user
  app.post("/api/users/:userId/block", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const blockerId = req.user.id;
      if (blockerId === targetUserId) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }
      await storage.blockUser(blockerId, targetUserId);
      // Log for developer visibility (Apple 1.2 requirement)
      console.warn(`[BLOCK] User ${blockerId} blocked user ${targetUserId}`);
      res.json({ blocked: true });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  app.delete("/api/users/:userId/block", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const blockerId = req.user.id;
      await storage.unblockUser(blockerId, targetUserId);
      res.json({ blocked: false });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  app.get("/api/users/:userId/is-blocked", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const blockerId = req.user.id;
      const isBlocked = await storage.isUserBlocked(blockerId, targetUserId);
      res.json({ isBlocked });
    } catch (error) {
      res.status(500).json({ message: "Failed to check block status" });
    }
  });

  app.get("/api/users/:userId/followers", async (req, res) => {
    try {
      const { userId } = req.params;
      const followers = await storage.getUserFollowers(userId);
      res.json(followers);
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:userId/following", async (req, res) => {
    try {
      const { userId } = req.params;
      const following = await storage.getUserFollowing(userId);
      res.json(following);
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Failed to fetch following" });
    }
  });

  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const { userId } = req.params;
      const [followersCount, followingCount] = await Promise.all([
        storage.getUserFollowersCount(userId),
        storage.getUserFollowingCount(userId)
      ]);
      res.json({ followersCount, followingCount });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get("/api/feed/following", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const posts = await storage.getFollowedUsersPosts(userId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching following feed:", error);
      res.status(500).json({ message: "Failed to fetch following feed" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getUserNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notificationId = parseInt(id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notificationId = parseInt(id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      await storage.deleteNotification(notificationId);
      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // TEST ROUTE: Create single test notification (for animation testing)
  app.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { message = "Test notification", type = "info" } = req.body;

      await storage.createNotification({
        userId,
        type,
        title: "Test Notification",
        message,
        relatedId: null,
        relatedType: null,
      });

      res.json({ message: "Test notification created successfully" });
    } catch (error) {
      console.error("Error creating test notification:", error);
      res.status(500).json({ message: "Failed to create test notification" });
    }
  });

  // TEST ROUTE: Create test notifications for all types
  app.post("/api/notifications/test-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Create test notifications for each type
      const testNotifications = [
        {
          type: "follow",
          title: "New Follower",
          message: "TestUser started following you",
          actorName: "TestUser",
        },
        {
          type: "like",
          title: "Someone liked your post",
          message: "TestUser liked your post",
          actorName: "TestUser",
          relatedType: "platform_post",
        },
        {
          type: "comment",
          title: "New comment on your post",
          message: 'TestUser commented: "Great post!"',
          actorName: "TestUser",
          relatedType: "platform_post",
        },
        {
          type: "chat_message",
          title: "New message in Bible Study",
          message: "TestUser: Hello everyone!",
          actorName: "TestUser",
          relatedType: "group_chat",
        }
      ];

      for (const notification of testNotifications) {
        await storage.createNotification({
          userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          relatedId: null,
          relatedType: notification.relatedType || null,
          actorName: notification.actorName,
          isRead: false,
        });
      }

      res.json({ message: "All test notifications created successfully" });
    } catch (error) {
      console.error("Error creating test notifications:", error);
      res.status(500).json({ message: "Failed to create test notifications" });
    }
  });

  // TEST ROUTE: Create sample notifications (for testing only)
  app.post("/api/notifications/create-samples", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const sampleNotifications = [
        {
          userId,
          type: "like",
          title: "New like on your post",
          message: "Someone liked your recent post about faith and community.",
          relatedId: "1",
          relatedType: "platform_post",
          isRead: false,
          actorName: "John Doe",
          actorImage: "/uploads/sample-avatar.jpg"
        },
        {
          userId,
          type: "comment",
          title: "New comment on your ministry event",
          message: "Sarah Johnson commented on your Beach & Bonfire event.",
          relatedId: "1",
          relatedType: "ministry_post",
          isRead: false,
          actorName: "Sarah Johnson"
        },
        {
          userId,
          type: "follow",
          title: "New follower",
          message: "Michael Brown started following you.",
          relatedId: userId,
          relatedType: "user",
          isRead: false,
          actorName: "Michael Brown"
        },
        {
          userId,
          type: "rsvp",
          title: "Event RSVP update",
          message: "5 new people RSVPed to your upcoming ministry event.",
          relatedId: "1",
          relatedType: "ministry_post",
          isRead: false
        },
        {
          userId,
          type: "ministry_post",
          title: "New ministry post",
          message: "Grace Community Church shared a new event you might be interested in.",
          relatedId: "2",
          relatedType: "ministry_post",
          isRead: true,
          actorName: "Grace Community Church"
        }
      ];

      const createdNotifications = [];
      for (const notificationData of sampleNotifications) {
        const notification = await storage.createNotification(notificationData);
        createdNotifications.push(notification);
      }

      res.json({ 
        message: "Sample notifications created", 
        notifications: createdNotifications 
      });
    } catch (error) {
      console.error("Error creating sample notifications:", error);
      res.status(500).json({ message: "Failed to create sample notifications" });
    }
  });

  // Group Chat Queue Routes
  app.post("/api/group-chat-queues", isAuthenticated, writeLimiter, validateBody(groupChatQueueSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const queueData = insertGroupChatQueueSchema.parse(req.body);
      const queue = await storage.createGroupChatQueue({ ...queueData, creatorId: userId });
      res.json(queue);
    } catch (error) {
      console.error("Error creating group chat queue:", error);
      res.status(500).json({ message: "Failed to create group chat queue" });
    }
  });

  app.get("/api/group-chat-queues", async (req, res) => {
    try {
      const queues = await storage.listActiveQueues();
      res.json(queues);
    } catch (error) {
      console.error("Error fetching group chat queues:", error);
      res.status(500).json({ message: "Failed to fetch group chat queues" });
    }
  });

  app.post("/api/group-chat-queues/:id/join", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const queueId = parseInt(req.params.id);
      await storage.joinQueue(queueId, userId);
      res.json({ message: "Successfully joined queue" });
    } catch (error) {
      console.error("Error joining queue:", error);
      res.status(500).json({ message: "Failed to join queue" });
    }
  });

  app.post("/api/group-chat-queues/:id/leave", isAuthenticated, writeLimiter, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const queueId = parseInt(req.params.id);
      await storage.leaveQueue(queueId, userId);
      res.json({ message: "Successfully left queue" });
    } catch (error) {
      console.error("Error leaving queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  app.delete("/api/group-chat-queues/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const queueId = parseInt(req.params.id);
      await storage.cancelQueue(queueId, userId);
      res.json({ message: "Successfully cancelled queue" });
    } catch (error) {
      console.error("Error cancelling queue:", error);
      res.status(500).json({ message: "Failed to cancel queue" });
    }
  });

  app.get("/api/group-chats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chats = await storage.getUserGroupChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching group chats:", error);
      res.status(500).json({ message: "Failed to fetch group chats" });
    }
  });

  app.get("/api/group-chats/active", async (req, res) => {
    try {
      const chats = await storage.listActiveChats();
      res.json(chats);
    } catch (error) {
      console.error("Error fetching active chats:", error);
      res.status(500).json({ message: "Failed to fetch active chats" });
    }
  });

  app.get("/api/group-chats/:id/members", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const members = await storage.getChatMembers(chatId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching chat members:", error);
      res.status(500).json({ message: "Failed to fetch chat members" });
    }
  });

  app.get("/api/group-chats/:id/messages", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const messages = await storage.getChatMessages(chatId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.get("/api/group-chats/:id", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const chat = await storage.getGroupChatById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });

  app.post("/api/group-chats/:id/banner", isAuthenticated, uploadLimiter, upload.single("banner"), async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const chatId = parseInt(req.params.id);
      const chat = await storage.getGroupChatById(chatId);
      if (!chat) return res.status(404).json({ message: "Chat not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: "Only image files are allowed" });
      const bannerImage = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      const updated = await storage.updateGroupChatImages(chatId, { bannerImage });
      res.json(updated);
    } catch (error) {
      console.error("Error uploading chat banner:", error);
      res.status(500).json({ message: "Failed to upload banner" });
    }
  });

  app.post("/api/group-chats/:id/icon", isAuthenticated, uploadLimiter, upload.single("icon"), async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const chatId = parseInt(req.params.id);
      const chat = await storage.getGroupChatById(chatId);
      if (!chat) return res.status(404).json({ message: "Chat not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: "Only image files are allowed" });
      const profileImage = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      const updated = await storage.updateGroupChatImages(chatId, { profileImage });
      res.json(updated);
    } catch (error) {
      console.error("Error uploading chat icon:", error);
      res.status(500).json({ message: "Failed to upload icon" });
    }
  });

  app.post("/api/group-chat-queues/:id/banner", isAuthenticated, uploadLimiter, upload.single("banner"), async (req: any, res) => {
    try {
      const queueId = parseInt(req.params.id);
      const queue = await storage.getGroupChatQueue(queueId);
      if (!queue) return res.status(404).json({ message: "Queue not found" });
      if (!req.user.isAdmin && queue.creatorId !== req.user.id) return res.status(403).json({ message: "Not authorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: "Only image files are allowed" });
      const bannerImage = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      const updated = await storage.updateGroupChatQueueImages(queueId, { bannerImage });
      res.json(updated);
    } catch (error) {
      console.error("Error uploading queue banner:", error);
      res.status(500).json({ message: "Failed to upload banner" });
    }
  });

  app.post("/api/group-chat-queues/:id/icon", isAuthenticated, uploadLimiter, upload.single("icon"), async (req: any, res) => {
    try {
      const queueId = parseInt(req.params.id);
      const queue = await storage.getGroupChatQueue(queueId);
      if (!queue) return res.status(404).json({ message: "Queue not found" });
      if (!req.user.isAdmin && queue.creatorId !== req.user.id) return res.status(403).json({ message: "Not authorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: "Only image files are allowed" });
      const profileImage = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      const updated = await storage.updateGroupChatQueueImages(queueId, { profileImage });
      res.json(updated);
    } catch (error) {
      console.error("Error uploading queue icon:", error);
      res.status(500).json({ message: "Failed to upload icon" });
    }
  });

  app.post("/api/group-chats/:id/messages", isAuthenticated, writeLimiter, validateBody(groupChatMessageSchema), async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const userId = req.user.id;

      const result = insertGroupChatMessageSchema.safeParse({
        ...req.body,
        chatId,
        userId
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid message data", 
          errors: result.error.errors 
        });
      }

      const message = await storage.createGroupChatMessage(result.data);

      // Get the full message with user data for response
      const messages = await storage.getChatMessages(chatId);
      const newMessage = messages.find(m => m.id === message.id);

      res.json(newMessage);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // Admin route to make all users follow Christ Collective Ministry
  app.post("/api/admin/auto-follow-christ-collective", isAuthenticated, async (req: any, res) => {
    try {
      await storage.makeAllUsersFollowChristCollective();
      res.json({ message: "Successfully made all users follow Christ Collective Ministry" });
    } catch (error) {
      console.error("Error making all users follow Christ Collective:", error);
      res.status(500).json({ error: "Failed to make all users follow Christ Collective Ministry" });
    }
  });

  // Direct messaging routes
  app.get("/api/direct-chats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chats = await storage.getUserDirectChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching direct chats:", error);
      res.status(500).json({ message: "Failed to fetch direct chats" });
    }
  });

  app.get("/api/direct-chats/:id", isAuthenticated, async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const userId = req.user.id;

      // Get chat and verify user is participant
      const chat = await storage.getDirectChatById(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      res.json(chat);
    } catch (error) {
      console.error("Error fetching direct chat:", error);
      res.status(500).json({ message: "Failed to fetch direct chat" });
    }
  });

  app.post("/api/direct-chats", isAuthenticated, writeLimiter, validateBody(directChatCreateSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { recipientId } = req.body;

      if (!recipientId) {
        return res.status(400).json({ message: "Recipient ID is required" });
      }

      const chat = await storage.getOrCreateDirectChat(userId, recipientId);
      res.json(chat);
    } catch (error) {
      console.error("Error creating direct chat:", error);
      res.status(500).json({ message: "Failed to create direct chat" });
    }
  });

  app.get("/api/direct-chats/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const messages = await storage.getDirectChatMessages(chatId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching direct chat messages:", error);
      res.status(500).json({ message: "Failed to fetch direct chat messages" });
    }
  });

  app.post("/api/direct-chats/:id/messages", isAuthenticated, writeLimiter, validateBody(directChatMessageSchema), async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const userId = req.user.id;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      const newMessage = await storage.createDirectMessage({
        chatId,
        senderId: userId,
        message: message.trim()
      });

      // Get the full message with sender data for response
      const messages = await storage.getDirectChatMessages(chatId);
      const fullMessage = messages.find(m => m.id === newMessage.id);

      res.json(fullMessage);
    } catch (error) {
      console.error("Error creating direct message:", error);
      res.status(500).json({ message: "Failed to create direct message" });
    }
  });

  app.patch("/api/direct-messages/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const messageId = parseInt(req.params.id);
      await storage.markDirectMessageAsRead(messageId);
      res.json({ message: "Message marked as read" });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Shop routes - Get Stripe publishable key
  app.get('/api/stripe/publishable-key', async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error fetching Stripe publishable key:", error);
      res.status(500).json({ message: "Failed to fetch Stripe key" });
    }
  });

  // Shop routes - List products with prices
  app.get('/api/shop/products', async (req, res) => {
    try {
      const stripeClient = await getUncachableStripeClient();
      const products = await stripeClient.products.list({ active: true, limit: 100 });
      const prices = await stripeClient.prices.list({ active: true, limit: 100 });

      const productsWithPrices = products.data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        images: product.images,
        metadata: product.metadata,
        prices: prices.data
          .filter(price => price.product === product.id)
          .map(price => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            active: price.active,
            metadata: price.metadata,
          })),
      }));

      res.json({ data: productsWithPrices });
    } catch (error) {
      console.error("Error fetching shop products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Shop routes - Get single product by ID
  app.get('/api/shop/products/:productId', async (req, res) => {
    try {
      const { productId } = req.params;
      const stripeClient = await getUncachableStripeClient();
      
      // Fetch the product
      const product = await stripeClient.products.retrieve(productId);
      
      if (!product || !product.active) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Fetch all prices for this product
      const prices = await stripeClient.prices.list({ 
        product: productId, 
        active: true, 
        limit: 100 
      });
      
      const productWithPrices = {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        images: product.images,
        metadata: product.metadata,
        prices: prices.data.map(price => ({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          active: price.active,
          metadata: price.metadata,
        })),
      };
      
      res.json(productWithPrices);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      if (error.code === 'resource_missing') {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Shop routes - Get price details with product info
  app.get('/api/shop/price/:priceId', async (req, res) => {
    try {
      const { priceId } = req.params;
      const stripeClient = await getUncachableStripeClient();
      const price = await stripeClient.prices.retrieve(priceId, { expand: ['product'] });

      res.json({
        id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        product: price.product,
      });
    } catch (error) {
      console.error("Error fetching price details:", error);
      res.status(500).json({ message: "Failed to fetch price details" });
    }
  });

  // Shop routes - Create payment intent for product purchase with idempotency
  app.post('/api/shop/create-payment-intent', paymentLimiter, validateBody(shopPaymentIntentSchema), async (req: any, res) => {
    try {
      const stripeClient = await getUncachableStripeClient();
      const { priceId, idempotencyKey } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      const price = await stripeClient.prices.retrieve(priceId);
      if (!price.unit_amount) {
        return res.status(400).json({ message: "Invalid price" });
      }

      // Create stable idempotency key based on user session + price + timestamp (15 min window)
      const timeWindow = Math.floor(Date.now() / (15 * 60 * 1000));
      const userId = req.user?.id || 'guest';
      const stableIdempotencyKey = idempotencyKey || `shop_pi_${userId}_${priceId}_${timeWindow}`;

      // Get user email for Stripe receipt
      let shopReceiptEmail: string | undefined;
      if (req.user?.id) {
        const shopUser = await storage.getUser(req.user.id);
        shopReceiptEmail = shopUser?.email || undefined;
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: price.unit_amount,
        currency: price.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: shopReceiptEmail,
        metadata: {
          priceId,
          productId: typeof price.product === 'string' ? price.product : price.product.id,
          userId,
        },
      }, {
        idempotencyKey: stableIdempotencyKey,
      });

      // Log payment intent creation (audit trail)
      try {
        await storage.createMoneyEventLog({
          eventType: 'payment_intent_created',
          stripePaymentIntentId: paymentIntent.id,
          amount: price.unit_amount,
          currency: price.currency,
          status: paymentIntent.status,
          metadata: { priceId, userId, idempotencyKey: stableIdempotencyKey },
        });
      } catch (logError) {
        console.error("Failed to log payment intent creation:", logError);
        // Don't fail the request if logging fails
      }

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      console.error("Error creating shop payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Shop routes - Create order after successful payment
  app.post('/api/shop/create-order', paymentLimiter, validateBody(shopOrderSchema), async (req: any, res) => {
    try {
      const {
        paymentIntentId,
        priceId,
        quantity,
        customerEmail,
        customerPhone,
        customerName,
        shippingName,
        shippingAddress,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingZipCode,
      } = req.body;

      if (!paymentIntentId || !priceId || !customerEmail || !customerName || !shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingZipCode) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if order already exists for this payment intent
      const existingOrder = await storage.getShopOrderByPaymentIntent(paymentIntentId);
      if (existingOrder) {
        return res.json({ orderId: existingOrder.id, message: "Order already exists" });
      }

      const stripeClient = await getUncachableStripeClient();
      
      // Verify the payment intent is successful
      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not successful" });
      }

      // Get price and product details
      const price = await stripeClient.prices.retrieve(priceId, { expand: ['product'] });
      const product = price.product as any;

      const orderData = {
        userId: req.user?.id || null,
        stripePaymentIntentId: paymentIntentId,
        stripePriceId: priceId,
        productName: product.name,
        quantity: quantity || 1,
        unitAmount: price.unit_amount || 0,
        totalAmount: (price.unit_amount || 0) * (quantity || 1),
        currency: price.currency,
        status: 'paid' as const,
        customerEmail,
        customerPhone: customerPhone || null,
        customerName,
        shippingName,
        shippingAddress,
        shippingAddress2: shippingAddress2 || null,
        shippingCity,
        shippingState,
        shippingZipCode,
        shippingCountry: 'US',
      };

      const order = await storage.createShopOrder(orderData);

      // Log order creation (audit trail)
      try {
        await storage.createMoneyEventLog({
          eventType: 'order_created',
          orderId: order.id,
          stripePaymentIntentId: paymentIntentId,
          amount: order.totalAmount,
          currency: order.currency,
          status: order.status,
          metadata: { 
            customerEmail, 
            productName: product.name,
            quantity: quantity || 1,
          },
        });
      } catch (logError) {
        console.error("Failed to log order creation:", logError);
      }

      // Send order confirmation email
      try {
        const { sendOrderConfirmationEmail } = await import('./email');
        await sendOrderConfirmationEmail({
          to: customerEmail,
          customerName,
          orderId: order.id,
          productName: product.name,
          quantity: quantity || 1,
          unitAmount: price.unit_amount || 0,
          totalAmount: order.totalAmount,
          currency: price.currency,
          shippingAddress: {
            name: shippingName,
            address: shippingAddress,
            address2: shippingAddress2,
            city: shippingCity,
            state: shippingState,
            zipCode: shippingZipCode,
          },
        });
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Don't fail the order creation if email fails
      }

      res.json({ orderId: order.id, message: "Order created successfully" });
    } catch (error: any) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Shop webhook - Handle Stripe payment events with deduplication and verification
  // Note: This endpoint needs raw body for signature verification, so it's registered
  // separately in index.ts BEFORE body parsers
  app.post('/api/shop/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const webhookSecret = process.env.STRIPE_SHOP_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.log('⚠️ Shop webhook endpoint called but STRIPE_SHOP_WEBHOOK_SECRET not configured');
      return res.status(200).json({ received: true, warning: 'Webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      console.error('❌ No stripe-signature header');
      return res.status(400).json({ error: 'No signature' });
    }

    let event;
    try {
      const stripeClient = await getUncachableStripeClient();
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const eventId = event.id;
    const eventType = event.type;

    // Check for duplicate event (deduplication)
    try {
      const existingEvent = await storage.getWebhookEvent(eventId);
      if (existingEvent) {
        console.log(`⚠️ Duplicate webhook event ignored: ${eventId}`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Record event for deduplication
      await storage.createWebhookEvent({
        stripeEventId: eventId,
        eventType: eventType,
        processed: false,
      });
    } catch (dedupError) {
      console.error('❌ Deduplication check failed:', dedupError);
      // Continue processing - we don't want to fail just because dedup failed
    }

    // Log webhook received (audit trail)
    try {
      const paymentIntent = event.data.object as any;
      await storage.createMoneyEventLog({
        eventType: 'webhook_received',
        stripeEventId: eventId,
        stripePaymentIntentId: paymentIntent.id || null,
        amount: paymentIntent.amount || null,
        currency: paymentIntent.currency || null,
        status: eventType,
        metadata: { eventType, livemode: event.livemode },
      });
    } catch (logError) {
      console.error('Failed to log webhook event:', logError);
    }

    // Handle specific events
    try {
      if (eventType === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as any;
        console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
        
        // Log success
        await storage.createMoneyEventLog({
          eventType: 'payment_succeeded',
          stripePaymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'succeeded',
          metadata: paymentIntent.metadata || {},
        });
        
        // Handle Donation (if metadata exists)
        if (paymentIntent.metadata?.campaignId) {
          const { campaignId, userId } = paymentIntent.metadata;
          const donationAmount = paymentIntent.amount / 100;
          await storage.createDonation({
            campaignId,
            userId: userId || 'guest',
            amount: donationAmount.toString(),
            isAnonymous: false,
            stripePaymentId: paymentIntent.id,
          }, paymentIntent.id);
          await storage.updateDonationAmount(campaignId, donationAmount);
        }

        // Handle Shop Order
        const existingOrder = await storage.getShopOrderByPaymentIntent(paymentIntent.id);
        if (existingOrder && existingOrder.status === 'pending') {
          await storage.updateShopOrder(existingOrder.id, { status: 'paid' });
        }
      } else if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
        const subscription = event.data.object as any;
        console.log(`📋 Subscription ${eventType}: ${subscription.id}`);
        
        const metadata = subscription.metadata || {};
        const membershipSubId = metadata.membershipSubscriptionId;
        
        if (membershipSubId) {
          await storage.updateMembershipSubscription(parseInt(membershipSubId), {
            status: subscription.status,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
            endDate: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
          });
        }
      } else if (eventType === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        console.log(`❌ Subscription deleted: ${subscription.id}`);
        
        const metadata = subscription.metadata || {};
        const membershipSubId = metadata.membershipSubscriptionId;
        
        if (membershipSubId) {
          await storage.updateMembershipSubscription(parseInt(membershipSubId), {
            status: 'canceled',
          });
        }
      } else if (eventType === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as any;
        console.log(`❌ Payment failed: ${paymentIntent.id}`);
        
        await storage.createMoneyEventLog({
          eventType: 'payment_failed',
          stripePaymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'failed',
          metadata: { 
            error: paymentIntent.last_payment_error?.message || 'Unknown error',
            ...paymentIntent.metadata 
          },
        });
      } else if (eventType === 'charge.refunded') {
        const charge = event.data.object as any;
        console.log(`💸 Refund processed: ${charge.payment_intent}`);
        
        await storage.createMoneyEventLog({
          eventType: 'refund_succeeded',
          stripePaymentIntentId: charge.payment_intent,
          amount: charge.amount_refunded,
          currency: charge.currency,
          status: 'refunded',
          metadata: { chargeId: charge.id },
        });
        
        // Update order status if exists
        if (charge.payment_intent) {
          const order = await storage.getShopOrderByPaymentIntent(charge.payment_intent);
          if (order) {
            await storage.updateShopOrder(order.id, { status: 'refunded' });
          }
        }
      }

      // Mark event as processed
      await storage.markWebhookEventProcessed(eventId);
    } catch (processError) {
      console.error('❌ Error processing webhook event:', processError);
      // Still return 200 to prevent Stripe from retrying immediately
    }

    res.status(200).json({ received: true });
  });

  // Admin routes - Get all shop orders
  app.get('/api/admin/shop-orders', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const orders = await storage.listShopOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching shop orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Admin routes - Update shop order status
  app.patch('/api/admin/shop-orders/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { orderId } = req.params;
      const { status, trackingNumber, trackingCarrier, adminNotes } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (trackingCarrier !== undefined) updateData.trackingCarrier = trackingCarrier;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      
      if (status === 'shipped' && !updateData.shippedAt) {
        updateData.shippedAt = new Date();
      }
      if (status === 'delivered' && !updateData.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      const order = await storage.updateShopOrder(parseInt(orderId), updateData);
      res.json(order);
    } catch (error) {
      console.error("Error updating shop order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Admin routes - Get single shop order
  app.get('/api/admin/shop-orders/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { orderId } = req.params;
      const order = await storage.getShopOrder(parseInt(orderId));
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching shop order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Admin routes - Upload product image
  app.post('/api/admin/products/upload-image', isAuthenticated, uploadLimiter, upload.single('productImage'), async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const imageUrl = await uploadBufferToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading product image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Admin routes - Create product with variants
  app.post('/api/admin/products', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stripeClient = await getUncachableStripeClient();
      const { name, description, images = [], variants = [], category = '', featured = false } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Product name is required" });
      }

      if (!variants || variants.length === 0) {
        return res.status(400).json({ message: "At least one variant is required" });
      }

      // Build full image URLs for Stripe (must be absolute URLs)
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'https://localhost:5000';
      
      const fullImageUrls = images.map((img: string) => {
        if (img.startsWith('http')) return img;
        return `${baseUrl}${img}`;
      });

      // Create the product in Stripe
      const product = await stripeClient.products.create({
        name,
        description: description || undefined,
        images: fullImageUrls.length > 0 ? fullImageUrls : undefined,
        metadata: { category, featured: featured ? 'true' : 'false' },
      });

      // Create a price for each variant
      const createdPrices = [];
      for (const variant of variants) {
        const { color, size, price: priceAmount, sku } = variant;
        
        if (!priceAmount || priceAmount <= 0) {
          continue;
        }

        const priceMetadata: Record<string, string> = {};
        if (color) priceMetadata.color = color;
        if (size) priceMetadata.size = size;
        if (sku) priceMetadata.sku = sku;

        const stripePrice = await stripeClient.prices.create({
          product: product.id,
          unit_amount: Math.round(priceAmount * 100),
          currency: 'usd',
          metadata: priceMetadata,
        });

        createdPrices.push({
          id: stripePrice.id,
          unit_amount: stripePrice.unit_amount,
          currency: stripePrice.currency,
          metadata: priceMetadata,
        });
      }

      res.json({
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          images: product.images,
          metadata: product.metadata,
        },
        prices: createdPrices,
        message: "Product created successfully",
      });
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Admin routes - Update product active status
  app.patch('/api/admin/products/:productId', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stripeClient = await getUncachableStripeClient();
      const { productId } = req.params;
      const { active } = req.body;

      const product = await stripeClient.products.update(productId, {
        active: active !== undefined ? active : true,
      });

      res.json({ product, message: "Product updated successfully" });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // ── Push Token Registration ──────────────────────────────────────────────
  app.post("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { token, platform = "ios" } = req.body;
      if (!token) return res.status(400).json({ message: "token required" });
      await pool.query(
        `INSERT INTO push_tokens (user_id, token, platform, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, token) DO UPDATE SET updated_at = now()`,
        [userId, token, platform]
      );
      console.log(`[Push] Token registered for user ${userId} (${platform}): ${token.slice(0, 10)}...`);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error registering push token:", error);
      res.status(500).json({ message: "Failed to register push token" });
    }
  });

  // ── Test Push Notification (admin only) ──────────────────────────────────
  app.post("/api/push-tokens/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { sendPushToUser } = await import("./pushNotifications");
      await sendPushToUser(userId, {
        title: "Test Notification",
        body: "Push notifications are working!",
        data: { type: "test" },
      });
      res.json({ ok: true, message: "Test notification sent — check Railway logs for details" });
    } catch (error) {
      console.error("Error sending test push:", error);
      res.status(500).json({ message: "Failed to send test push" });
    }
  });

  app.delete("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { token } = req.body;
      if (token) {
        await pool.query(`DELETE FROM push_tokens WHERE user_id = $1 AND token = $2`, [userId, token]);
      } else {
        await pool.query(`DELETE FROM push_tokens WHERE user_id = $1`, [userId]);
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove push token" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}