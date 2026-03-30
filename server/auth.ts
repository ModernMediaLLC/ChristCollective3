import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash, createHmac } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { pool } from "./db";
import { emailService } from "./emailService";
import { authLimiter } from "./security";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const parts = stored.split(".");
    if (parts.length !== 2) {
      console.error("Invalid password format in database");
      return false;
    }
    
    const [hashed, salt] = parts;
    if (!hashed || !salt) {
      console.error("Missing hash or salt in stored password");
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    // Check buffer lengths match before comparing
    if (hashedBuf.length !== suppliedBuf.length) {
      console.error("Password hash length mismatch");
      return false;
    }
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Hash reset token using SHA256 for secure storage
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function setupAuth(app: Express) {
  // OWASP: Fail fast if session secret is missing — never use a hardcoded fallback
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required. Generate a strong random value (32+ characters).');
  }

  // Ensure session table exists using the working Neon pool
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
    `);
    // Push notification tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "push_tokens" (
        "id" serial PRIMARY KEY,
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" text NOT NULL,
        "platform" varchar(10) NOT NULL DEFAULT 'ios',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        UNIQUE ("user_id", "token")
      )
    `);
  } catch (err) {
    console.error('Session table setup error:', err);
  }

  const PgSession = connectPgSimple(session);
  const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const sessionStore = new PgSession({
    pool: sessionPool,
    ttl: 365 * 24 * 60 * 60, // 1 year in seconds
  });
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    rolling: true, // Reset expiration on each request
    store: sessionStore,
    cookie: {
      httpOnly: true, // Secure cookie - prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // Only enforce secure in production
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year - persistent until explicit logout
      sameSite: 'lax', // Lax for same-site requests (frontend/backend on same domain)
      path: '/', // Ensure cookie is available for all paths
      domain: undefined, // Let browser determine correct domain
    },
  };

  app.set("trust proxy", 1);
  
  // Sign a value the same way cookie-signature does, so express-session recognizes it
  function signCookie(val: string, secret: string): string {
    const sig = createHmac('sha256', secret)
      .update(val)
      .digest('base64')
      .replace(/=+$/, '');
    return val + '.' + sig;
  }
  
  // PRE-session middleware: inject mobile X-Session-ID as a signed cookie
  // so express-session loads the correct session automatically
  app.use((req, res, next) => {
    const mobileSessionId = req.headers['x-session-id'] as string;
    if (!mobileSessionId) return next();
    
    
    const secret = sessionSettings.secret as string;
    const signed = 's:' + signCookie(mobileSessionId, secret);
    const encodedCookie = `connect.sid=${encodeURIComponent(signed)}`;
    
    // Preserve any existing cookies and add/replace the session cookie
    const existingCookies = req.headers.cookie || '';
    const cookieParts = existingCookies
      .split(';')
      .map(c => c.trim())
      .filter(c => !c.startsWith('connect.sid='));
    cookieParts.push(encodedCookie);
    req.headers.cookie = cookieParts.filter(Boolean).join('; ');
    
    next();
  });
  
  const sessionMiddleware = session(sessionSettings);
  app.use(sessionMiddleware);
  
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      if (!username) {
        return done(null, false);
      }
      
      // Try to find user by username first (exact match), then case-insensitive, then by email
      let user = await storage.getUserByUsername(username);
      if (!user) {
        // Try case-insensitive username search
        user = await storage.getUserByUsernameInsensitive(username);
      }
      if (!user) {
        user = await storage.getUserByEmail(username);
      }
      
      if (!user || !user.password || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      const { username, email, password, firstName, lastName, phone, userType } = req.body;
      
      if (!username || !password || !phone) {
        return res.status(400).json({ message: "Username, password, and phone number are required" });
      }

      if (!email) {
        return res.status(400).json({ message: "Email is required for account verification" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const verificationToken = randomBytes(32).toString('hex');
      const hashedVerificationToken = createHash('sha256').update(verificationToken).digest('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await storage.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username,
        email,
        password: await hashPassword(password),
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone,
        userType: userType || null,
        emailVerified: false,
        emailVerificationToken: hashedVerificationToken,
        emailVerificationExpires: verificationExpires,
      });

      await storage.autoFollowChristCollectiveMinistry(user.id);

      await emailService.sendEmailVerification(
        email,
        verificationToken,
        firstName || username
      );

      res.status(201).json({ 
        message: "Account created. Please check your email to verify your account.",
        requiresVerification: true,
        email: user.email,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.get("/api/login", (req, res) => {
    // Redirect to the auth page for login
    res.redirect("/auth");
  });

  app.post("/api/login", authLimiter, (req, res, next) => {
    // Transform usernameOrEmail to username for passport compatibility
    if (req.body.usernameOrEmail) {
      req.body.username = req.body.usernameOrEmail;
    }
    next();
  }, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Passport authentication error:", err);
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: "Incorrect password" });
      }
      // Admin accounts bypass email verification (created before verification system)
      if (!user.emailVerified && !user.isAdmin) {
        return res.status(403).json({
          message: "Please verify your email before signing in. Check your inbox for a verification link.",
          requiresVerification: true,
          email: user.email
        });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        // Force session to save to the store before responding
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Session creation failed" });
          }
          
          const userData = user as SelectUser;
          
          res.status(200).json({ 
            id: userData.id, 
            username: userData.username, 
            email: userData.email,
            displayName: userData.displayName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            profileImageUrl: userData.profileImageUrl,
            bannerImageUrl: userData.bannerImageUrl,
            isAdmin: userData.isAdmin,
            sessionId: req.sessionID // Return session ID for mobile apps
          });
        });
      });
    })(req, res, next);
  });

  // Handle both GET and POST logout requests
  app.get("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.redirect("/");
      });
    });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  // Forgot password - sends reset link via email
  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      // Generate secure random token (plaintext for email)
      const resetToken = randomBytes(32).toString('hex');
      
      // Hash token for secure storage
      const hashedToken = hashResetToken(resetToken);
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      // Store HASHED token in database
      await storage.createPasswordResetToken(user.id, hashedToken, expiresAt);
      
      // Send reset email with plaintext token
      await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.firstName ?? user.username ?? undefined
      );

      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "An error occurred. Please try again later." });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      
      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Hash the incoming token to compare with stored hash
      const hashedToken = hashResetToken(token);

      // Get token from database using hashed version
      const resetToken = await storage.getPasswordResetToken(hashedToken);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      // Check if token is expired
      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ message: "Reset link has expired" });
      }

      // Check if token was already used
      if (resetToken.used) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      // Get user
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      // Automatically log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Auto-login after password reset failed:", err);
          return res.json({ 
            message: "Password reset successfully. Please log in with your new password.",
            autoLoginFailed: true
          });
        }
        
        // Force session to save to the store before responding
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error after password reset:", saveErr);
            return res.json({ 
              message: "Password reset successfully. Please log in with your new password.",
              autoLoginFailed: true
            });
          }
          
          res.json({ 
            message: "Password reset successfully",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
              profileImageUrl: user.profileImageUrl,
              bannerImageUrl: user.bannerImageUrl,
              isAdmin: user.isAdmin
            }
          });
        });
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Password reset failed. Please try again." });
    }
  });

  app.get("/api/auth/verify-email", authLimiter, async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const hashedToken = createHash('sha256').update(token).digest('hex');

      const user = await storage.getUserByVerificationToken(hashedToken);

      if (!user) {
        return res.status(400).json({ message: "Invalid verification link" });
      }

      if (user.emailVerified) {
        return res.json({ message: "Email already verified. You can sign in.", alreadyVerified: true });
      }

      if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
        return res.status(400).json({ message: "Verification link has expired. Please request a new one.", expired: true });
      }

      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      res.json({ message: "Email verified successfully! You can now sign in.", verified: true });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });

  app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.json({ message: "If an account with that email exists, a verification link has been sent." });
      }

      if (user.emailVerified) {
        return res.json({ message: "Email is already verified. You can sign in." });
      }

      const verificationToken = randomBytes(32).toString('hex');
      const hashedVerificationToken = createHash('sha256').update(verificationToken).digest('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.updateUser(user.id, {
        emailVerificationToken: hashedVerificationToken,
        emailVerificationExpires: verificationExpires,
      });

      await emailService.sendEmailVerification(
        email,
        verificationToken,
        user.firstName || user.username || undefined
      );

      res.json({ message: "If an account with that email exists, a verification link has been sent." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email. Please try again." });
    }
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    const sessionUser = req.user as SelectUser;
    
    // Fetch fresh user data from database to ensure we have the latest updates
    try {
      const freshUser = await storage.getUser(sessionUser.id);
      if (!freshUser) {
        return res.sendStatus(404);
      }
      
      res.json({
        id: freshUser.id,
        username: freshUser.username,
        email: freshUser.email,
        displayName: freshUser.displayName,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        phone: freshUser.phone,
        location: freshUser.location,
        bio: freshUser.bio,
        profileImageUrl: freshUser.profileImageUrl,
        bannerImageUrl: freshUser.bannerImageUrl,
        isAdmin: freshUser.isAdmin,
        stripeCustomerId: freshUser.stripeCustomerId,
        createdAt: freshUser.createdAt,
        updatedAt: freshUser.updatedAt
      });
    } catch (error) {
      console.error('Error fetching fresh user data:', error);
      // Fallback to session data if database fetch fails
      const user = req.user as SelectUser;
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        location: user.location,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        bannerImageUrl: user.bannerImageUrl,
        isAdmin: user.isAdmin 
      });
    }
  });
}

// Authentication middleware
export const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};