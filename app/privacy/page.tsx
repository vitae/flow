import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Flow AI',
  description: 'Flow AI Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-block">
          &larr; Back to Flow AI
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-10">Last updated: March 14, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Flow AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the website gwdf.pro and the Flow AI
              platform (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your name,
                email address, and authentication credentials through third-party providers (Google, Facebook, Instagram).
              </li>
              <li>
                <strong>Video Content:</strong> Videos you upload to the platform for processing and distribution.
              </li>
              <li>
                <strong>Social Media Tokens:</strong> OAuth access tokens for connected social media accounts
                (YouTube, Instagram, Facebook, Threads) to post content on your behalf.
              </li>
              <li>
                <strong>Payment Information:</strong> Billing details processed securely through Stripe.
                We do not store your full credit card number.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact with the Service,
                including features used and content processed.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, operate, and maintain the Service</li>
              <li>To process and distribute your video content to connected social media platforms</li>
              <li>To generate AI-powered captions, hashtags, and music recommendations</li>
              <li>To process payments and manage subscriptions</li>
              <li>To communicate with you about your account and the Service</li>
              <li>To improve and develop new features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p className="mb-3">We integrate with the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase:</strong> Authentication and data storage</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>Google/YouTube API:</strong> Video publishing to YouTube</li>
              <li><strong>Meta (Facebook, Instagram, Threads):</strong> Content publishing</li>
              <li><strong>Anthropic (Claude AI):</strong> AI-powered content generation</li>
            </ul>
            <p className="mt-3">
              Each third-party service has its own privacy policy. We encourage you to review their
              policies before connecting your accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Storage and Security</h2>
            <p>
              Your data is stored securely using Supabase with row-level security policies.
              We use encryption in transit (HTTPS/TLS) and follow industry best practices to
              protect your information. However, no method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Video content
              is stored temporarily during processing and may be deleted after distribution.
              You can request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect social media accounts at any time</li>
              <li>Cancel your subscription and stop data processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management.
              We do not use third-party tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for users under the age of 13. We do not knowingly
              collect information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:support@gwdf.pro" className="text-blue-600 hover:underline">
                support@gwdf.pro
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Flow AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
