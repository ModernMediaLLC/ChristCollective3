import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>
          <div className="w-16 h-1 bg-primary mb-4"></div>
          <p className="text-gray-400">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: October 4, 2026</p>
        </div>

        <div className="space-y-10 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Christ Collective platform ("Platform"), including our website, mobile application, and community
              features (Clubs and Matchups), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not use
              the Platform. These Terms are a legally binding agreement between you and Christ Collective.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Platform. Because Clubs and Matchups can result in <span className="text-white font-medium">in-person
              meetings with other members, you must be at least 18 years old to participate in Matchups, join clubs, or attend meetups.</span> By using
              these features you represent that you are 18 or older, and you agree to give your real birthday when we ask for it to confirm this. If you are
              between 13 and 17, you may use general community features only, with your parent or guardian's permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Account Registration</h2>
            <p className="mb-4">To access most features, you must register for an account. You agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Provide accurate, current, and complete information, and keep your contact details up to date</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Community Standards and Acceptable Use</h2>
            <p className="mb-4">Christ Collective is a faith-based community. You agree not to post, share, or transmit content that:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-4">
              <li>Is hateful, discriminatory, harassing, or threatening toward any individual or group</li>
              <li>Is sexually explicit, obscene, or pornographic</li>
              <li>Promotes violence, self-harm, or illegal activity</li>
              <li>Infringes on the intellectual property rights of others</li>
              <li>Contains malware, spam, or deceptive content</li>
              <li>Impersonates another person or entity</li>
              <li>Violates any applicable law</li>
            </ul>
            <p>
              You also agree not to use Clubs, Matchups, direct messages, or member profiles to harass, solicit, defraud, or endanger others.
              Content and conduct that violate these standards may result in removal, suspension, or termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Clubs, Matchups &amp; In-Person Meetups — Safety and Assumption of Risk</h2>
            <p className="mb-3">
              Clubs and Matchups help members find and connect with one another, and may lead to in-person meetups at public venues. <span className="text-white font-medium">Please
              read this section carefully.</span>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-3">
              <li>
                <span className="text-white font-medium">We do not screen members.</span> Christ Collective does not conduct criminal background checks,
                identity verification, or other screening of members. We do not vouch for, endorse, or verify any member, host, or venue.
              </li>
              <li>
                <span className="text-white font-medium">How matching works.</span> We group members into circles using the information you give us — such as your city,
                availability, chosen activities, and age — and we may suggest a time, activity, and public venue. Placement is at our discretion: we don't guarantee that
                you'll be placed in a circle, in any particular circle, or by any particular date. Members outside our current launch area may be placed on a waitlist.
              </li>
              <li>
                <span className="text-white font-medium">Guides.</span> Some meetups include one or more volunteer guides who help the group get started. Guides are not
                security staff, chaperones, counselors, or other professionals. They don't screen, supervise, or control members, and they aren't responsible for the conduct
                of other members. We are not a party to interactions between members, and venues are independent third parties we do not control.
              </li>
              <li>
                <span className="text-white font-medium">You are responsible for your own safety.</span> Use good judgment, meet in public places, tell someone
                where you're going, and stop any interaction that feels unsafe. Never share financial information or send money to other members.
              </li>
              <li>
                <span className="text-white font-medium">Assumption of risk.</span> You voluntarily assume all risks associated with communicating with, and meeting,
                other members, and with attending any meetup, activity, or venue — including risks of personal injury, property loss, or wrongful conduct by others.
              </li>
              <li>
                <span className="text-white font-medium">Release.</span> To the fullest extent permitted by law, you release and hold harmless Christ Collective, its
                staff, and volunteers from any and all claims, demands, damages, or liabilities arising out of or related to your interactions with other members or
                your attendance at any meetup, activity, or venue.
              </li>
            </ul>
            <p>If you feel unsafe or witness harmful behavior, use the in-app reporting tools and, in an emergency, contact local authorities.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Text Messages (SMS)</h2>
            <p>
              If you opt in, you consent to receive text messages from Christ Collective about Matchups and community coordination. Message frequency
              varies, and message and data rates may apply. Consent is not a condition of any purchase or of creating an account, but because Matchups are coordinated
              by text, it is required to be matched into a circle. Reply <span className="text-white font-medium">STOP</span> to
              opt out or <span className="text-white font-medium">HELP</span> for help. See our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Photos &amp; Video at Meetups and Events</h2>
            <p>
              We may photograph or film Christ Collective meetups and events. By attending, you agree that we may use photos and video that include you in the app, on our
              social media, and in our advertising, without payment to you. If you'd rather not be photographed or filmed, tell your guide or the event host before or during
              the meetup. You can also email <span className="text-primary">privacy@christcollective.com</span> to ask us to stop using existing photos or video of you in
              future materials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Instagram Verification and Directory Listings</h2>
            <p className="mb-3">
              <span className="text-white font-medium">Instagram verification.</span> Only verify an Instagram account that you own or are authorized to manage. When you verify,
              you authorize us and our service provider to read that account's public profile to confirm the code you added. You may remove the code from your bio once
              verification is complete. We may remove a verification that turns out to be inaccurate.
            </p>
            <p>
              <span className="text-white font-medium">Directory listings.</span> If you list a business or ministry, you confirm that you're authorized to represent it and that
              the listing information is accurate. Listing details, including any contact information you provide, are shown publicly. We may review, edit for formatting,
              decline, or remove listings at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Membership and Payments</h2>
            <h3 className="text-lg font-semibold text-primary mb-2">Membership Tiers</h3>
            <p className="mb-4">
              Christ Collective offers free and, where available, paid membership tiers. Paid memberships are billed through Stripe on a recurring basis.
              By subscribing, you authorize us to charge your payment method for each billing period until you cancel.
            </p>
            <h3 className="text-lg font-semibold text-primary mb-2">Cancellations and Refunds</h3>
            <p className="mb-4">
              You may cancel at any time in your account settings; cancellation takes effect at the end of the current billing period. We do not provide
              partial refunds except where required by law.
            </p>
            <h3 className="text-lg font-semibold text-primary mb-2">Donations</h3>
            <p>
              Donations are processed by Stripe and are final and non-refundable unless a campaign is cancelled by its creator or in cases of verified fraud.
              Christ Collective does not guarantee how campaign creators use donated funds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Shop and E-Commerce</h2>
            <p>
              Products sold through the Christ Collective Shop are processed via Stripe. All sales are final unless a product arrives damaged or defective.
              For order issues, contact us within 14 days of delivery. We may cancel any order at our discretion and issue a full refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Content Ownership and License</h2>
            <p className="mb-4">
              You retain ownership of the content you post. By posting, you grant Christ Collective a non-exclusive, royalty-free, worldwide license to use,
              display, reproduce, and distribute your content solely to operate and improve the Platform.
            </p>
            <p>
              Christ Collective retains all rights to the Platform's design, branding, software, and original content. You may not copy, modify, or distribute
              any part of the Platform without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Content Moderation</h2>
            <p>
              We use automated tools and human moderators to review content. Posts may be held, removed, or rejected without prior notice if they violate these
              Terms. You may report content or members using the in-app reporting feature, and we will take appropriate action at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Termination</h2>
            <p>
              We may restrict (for example, limit your ability to post, comment, or message), suspend, or terminate your account at any time, with or without notice, for
              conduct we believe violates these Terms or is harmful to others,
              the Platform, or us. You may delete your account at any time in your settings. Upon termination, your right to use the Platform ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided on an "as is" and "as available" basis without warranties of any kind, express or implied. We do not warrant that the
              Platform will be uninterrupted, error-free, or secure, and we make no warranties regarding other members, hosts, venues, or the outcome of any meetup.
              Your use of the Platform is at your sole risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">15. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Christ Collective shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages, or for any injury, loss, or damage arising out of your interactions with other members or attendance at any meetup or venue, even if we
              were advised of the possibility. Our total liability for any claim shall not exceed the greater of the amount you paid us in the 12 months preceding
              the claim or one hundred U.S. dollars ($100).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">16. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Christ Collective, its staff, and volunteers from any claims, damages, losses, or expenses (including
              reasonable attorneys' fees) arising out of your use of the Platform, your content, your conduct at meetups, or your violation of these Terms or the
              rights of any third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">17. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of California, without regard to its conflict-of-laws rules. Any dispute arising under these Terms
              shall be resolved in the state or federal courts located in Los Angeles County, California, or through binding arbitration where required by law, and
              you consent to that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">18. Changes to These Terms</h2>
            <p>
              We may update these Terms at any time. When we make material changes, we will notify registered users and update the "Last Updated" date above.
              Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">19. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at:</p>
            <div className="mt-4 p-4 bg-[#0A0A0A] border border-primary/20 rounded-lg">
              <p className="text-white font-semibold">Christ Collective</p>
              <p className="text-primary">legal@christcollective.com</p>
              <p className="text-gray-400">christcollective.com</p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-gray-500 text-sm">© 2025 Christ Collective. All rights reserved.</p>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">Privacy Policy</Link>
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
