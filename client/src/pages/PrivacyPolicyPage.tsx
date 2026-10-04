import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>
          <div className="w-16 h-1 bg-primary mb-4"></div>
          <p className="text-gray-400">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: October 4, 2026</p>
        </div>

        <div className="space-y-10 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>
              Christ Collective ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform, including our website and mobile application, our
              community features (Clubs and Matchups), and any related communications (collectively, the "Platform"). Please read this
              policy carefully. If you do not agree with it, please do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-semibold text-primary mb-2">Account &amp; Profile Information</h3>
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2">
              <li>Name, username, email address, and password when you create an account</li>
              <li>Profile details such as bio, profile photo, and cover photo</li>
              <li>Business or ministry profile details, if you create one</li>
            </ul>
            <h3 className="text-lg font-semibold text-primary mb-2">Business &amp; Ministry Directory Listings</h3>
            <p className="mb-4">
              If you list a business or ministry, we collect the details you enter for the listing — such as its name, category, description, logo,
              location or street address, and contact email, phone, website, and Instagram. <span className="text-white font-medium">Listing details are public:</span> they
              are shown to anyone who views the directory, so only enter contact details you want people to use.
            </p>
            <h3 className="text-lg font-semibold text-primary mb-2">Community Profile &amp; Matchups Information</h3>
            <p className="mb-2">When you complete onboarding or use Clubs and Matchups, we collect the information you choose to provide, which may include:</p>
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2">
              <li>Phone number and your SMS/text messaging opt-in preference (see Section 4)</li>
              <li>Birthdate (required for Matchups, which are 18+), gender, and city</li>
              <li>Whether you're inside our current launch area — members outside it are placed on a waitlist</li>
              <li>Instagram handle or portfolio link, and — if you choose to verify your Instagram — the verification code and result</li>
              <li>Creative disciplines, interests, goals, and an optional note about your faith</li>
              <li>Your matching preferences, the days and times that generally work for you, and up to three activities you'd like to do</li>
            </ul>
            <h3 className="text-lg font-semibold text-primary mb-2">Payment Information</h3>
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2">
              <li>Payment and billing details are processed securely by Stripe. We do not store raw card numbers.</li>
            </ul>
            <h3 className="text-lg font-semibold text-primary mb-2">Content &amp; Communications</h3>
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2">
              <li>Posts, images, videos, and comments you share</li>
              <li>Messages you send through group chats, club chats, and direct messages</li>
            </ul>
            <h3 className="text-lg font-semibold text-primary mb-2">Photos &amp; Video at Meetups and Events</h3>
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2">
              <li>We may photograph or film Christ Collective meetups and events, and that footage may include you if you attend (see Sections 3 and 7).</li>
            </ul>
            <h3 className="text-lg font-semibold text-primary mb-2">Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Device type, operating system, and browser type</li>
              <li>IP address and general (city-level) location derived from it</li>
              <li>Pages viewed, features used, and time spent on the Platform</li>
              <li>Session tokens for authentication, and mobile push-notification device tokens if you enable notifications</li>
              <li>On our website (not the mobile app): Meta Pixel cookies and related browser identifiers used to measure our ads (see Sections 5 and 10)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>To create and manage your account and profile</li>
              <li>To operate Clubs and Matchups — including grouping members into circles and coordinating in-person meetups based on your city, availability, chosen activities, and preferences</li>
              <li>To confirm you're 18 or older for Matchups, and to group you with members of a similar age</li>
              <li>To verify, if you ask us to, that an Instagram account you link is really yours</li>
              <li>To notify our team when you sign up, so we can welcome you and plan circles</li>
              <li>To show your profile in the member directory and to other members of clubs and circles you join</li>
              <li>To process payments and memberships securely via Stripe</li>
              <li>To send you transactional emails (verification, password resets) and, where you have opted in, SMS messages about your Matchups</li>
              <li>To moderate content using automated tools and human review, and to keep the community safe</li>
              <li>To improve the Platform, measure how well our ads and outreach work, and develop new features</li>
              <li>To use photos and video from meetups and events in the app, on our social media, and in our advertising</li>
              <li>To comply with legal obligations and to detect and prevent fraud, abuse, and security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Text Messages (SMS) &amp; Communication Consent</h2>
            <p className="mb-3">
              If you provide your phone number and opt in, you consent to receive text messages (SMS) from Christ Collective related to
              Matchups and community coordination — for example, when your circle or a meetup is ready. This is a core part of how Matchups works.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-3">
              <li>Message frequency varies. Message and data rates may apply.</li>
              <li>Consent to receive texts is <span className="text-white font-medium">not a condition of any purchase</span> or of creating an account and using the rest of the Platform. Because Matchups are coordinated by text, it is required to be matched into a circle.</li>
              <li>You can opt out at any time by replying <span className="text-white font-medium">STOP</span> to any message, or by turning off SMS in your profile settings. Reply <span className="text-white font-medium">HELP</span> for help.</li>
              <li>We do not sell or share your phone number with third parties for their own marketing.</li>
            </ul>
            <p>You may also receive email and in-app/push notifications. You can manage email and push preferences in your settings.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. How Information Is Shared</h2>
            <p className="mb-3">
              <span className="text-white font-medium">With other members.</span> Your profile (name, photo, city, disciplines, interests, Instagram, and bio)
              is visible to other members in the directory and in clubs and circles you join. Information you mark as private, and sensitive fields such as
              your birthdate, age, gender, phone number, and email (unless you turn on "show email"), are not shown on your public profile. Please only share what
              you're comfortable with others seeing.
            </p>
            <p className="mb-3">
              <span className="text-white font-medium">With your circle.</span> Once a circle you've been placed in is confirmed, its members can see each other's name,
              photo, city, and creative disciplines. Proposed circles that haven't been confirmed are visible only to our team.
            </p>
            <p className="mb-3">
              <span className="text-white font-medium">With our team.</span> Authorized Christ Collective staff and administrators can see the information you give us when
              you sign up — including your age, contact details, availability, and activity choices — to plan circles, coordinate meetups, and support the community.
            </p>
            <p className="mb-3"><span className="text-white font-medium">We do not sell your personal information.</span> We share information with service providers who help us run the Platform:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="text-white font-medium">Stripe</span> — secure payment processing</li>
              <li><span className="text-white font-medium">Supabase</span> — database hosting and file/media storage</li>
              <li><span className="text-white font-medium">Resend</span> — transactional email delivery, including new-signup notifications sent to our team</li>
              <li><span className="text-white font-medium">Apify</span> — if you verify your Instagram, receives the handle you entered and reads that account's public profile so we can check for your verification code</li>
              <li><span className="text-white font-medium">An SMS provider</span> — to deliver the text messages you opt into</li>
              <li><span className="text-white font-medium">AI moderation provider</span> — text and images may be analyzed to detect harmful content; not retained for model training</li>
              <li><span className="text-white font-medium">Apple &amp; Google</span> — to deliver mobile push notifications</li>
              <li>
                <span className="text-white font-medium">Meta (Facebook / Instagram)</span> — we use the Meta Pixel on our website and Meta's Conversions API to measure and improve our
                ads. When you sign up through our website, we send Meta that sign-up event along with your IP address, browser information, Meta cookie identifiers, and{" "}
                <span className="text-white font-medium">hashed</span> (one-way encrypted) versions of your email, phone number, name, city, birthdate, and account ID, so Meta can match
                the sign-up to our ads. Meta processes this under its own terms and privacy policy. You can opt out — see Section 8.
              </li>
              <li><span className="text-white font-medium">Law enforcement or regulators</span> — when required by law or to protect the safety of our community</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide services. If you delete your
              account, we will remove your personal data within 30 days, except where retention is required by law or for legitimate purposes
              such as fraud prevention, safety, or resolving disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights &amp; Choices</h2>
            <p className="mb-4">Depending on where you live, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information (you can also edit most of it in your profile)</li>
              <li>Request deletion of your personal data</li>
              <li>Opt out of SMS, email, or push communications</li>
              <li>Ask not to be photographed or filmed at a meetup (just tell your guide), or ask us to stop using existing photos or video of you in future materials</li>
              <li>Request data portability</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at <span className="text-primary">privacy@christcollective.com</span>. We will not
              discriminate against you for exercising your rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. California Privacy Rights</h2>
            <p>
              If you are a California resident, the CCPA/CPRA gives you the rights described in Section 7, including the right to know what personal
              information we collect, to request deletion, and to opt out of the "sale" or "sharing" of personal information. <span className="text-white font-medium">We do not
              sell your personal information.</span> However, our use of the Meta Pixel and Conversions API to measure our ads may be considered "sharing" for cross-context
              behavioral advertising under California law.
            </p>
            <p className="mt-3">
              <span className="text-white font-medium">To opt out of sharing:</span> turn on Global Privacy Control (GPC) in your browser — when we receive a GPC signal, we don't load
              the Meta Pixel and don't send your sign-up to Meta — or email <span className="text-primary">privacy@christcollective.com</span> with "Do Not Share" in the subject line.
              To make any other request, email us at the same address.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS/TLS encryption, hashed passwords, session management, rate limiting,
              and input validation. Payment data is handled exclusively through Stripe's PCI-compliant infrastructure. However, no method of
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Cookies &amp; Tracking</h2>
            <p>
              We use session cookies to keep you logged in and maintain your preferences. On our website (not in the mobile app), we use the Meta Pixel,
              which sets cookies to measure how our ads perform. You can block it with Global Privacy Control (see Section 8) or by disabling cookies in your
              browser settings, though disabling all cookies may affect Platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Children's &amp; Minors' Privacy</h2>
            <p>
              The Platform is not intended for children under 13, and we do not knowingly collect information from them. Because Matchups and Clubs
              can lead to in-person meetups, those features are intended for users <span className="text-white font-medium">18 and older</span>, and we ask for your birthday when you
              sign up to confirm it. If you believe a child under
              13 has provided us information, contact us and we will remove it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users when we make material changes. Continued use of
              the Platform after changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at:</p>
            <div className="mt-4 p-4 bg-[#0A0A0A] border border-primary/20 rounded-lg">
              <p className="text-white font-semibold">Christ Collective</p>
              <p className="text-primary">privacy@christcollective.com</p>
              <p className="text-gray-400">christcollective.com</p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-gray-500 text-sm">© 2025 Christ Collective. All rights reserved.</p>
          <div className="flex gap-4 text-sm">
            <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">Terms of Service</Link>
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
