import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Flow AI',
  description: 'Flow AI Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-block">
          &larr; Back to Flow AI
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-10">Last updated: March 14, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Flow AI (&quot;the Service&quot;), operated at gwdf.pro, you agree
              to be bound by these Terms of Service. If you do not agree to these terms, do not
              use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              Flow AI is a video processing and distribution platform that allows users to upload
              videos, apply AI-generated captions, trending music, and hashtags, and distribute
              content across social media platforms including YouTube, Instagram, Facebook, and Threads.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 13 years old to use the Service.</li>
              <li>One person or entity may not maintain more than one account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Subscriptions and Payments</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Some features require a paid subscription (Flow AI Pro at $29/month).</li>
              <li>Payments are processed securely through Stripe.</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
              <li>You may cancel your subscription at any time through your account settings.</li>
              <li>Refunds are handled on a case-by-case basis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Content</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You retain ownership of all content you upload to the Service.</li>
              <li>
                By uploading content, you grant us a limited license to process, store, and
                distribute your content as directed by you through the Service.
              </li>
              <li>You are solely responsible for the content you upload and distribute.</li>
              <li>
                You must have all necessary rights and permissions for any content you upload,
                including music, images, and video footage.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Prohibited Uses</h2>
            <p className="mb-3">You may not use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload or distribute content that is illegal, harmful, or violates third-party rights</li>
              <li>Distribute spam, malware, or deceptive content</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Use the Service in any way that violates applicable laws or regulations</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Upload content that violates the terms of connected social media platforms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Social Media Integrations</h2>
            <p>
              The Service connects to third-party social media platforms. Your use of those
              platforms is subject to their respective terms of service. We are not responsible
              for the actions, policies, or content of third-party platforms. You may disconnect
              any social media account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. AI-Generated Content</h2>
            <p>
              The Service uses artificial intelligence to generate captions, hashtags, and music
              recommendations. AI-generated content is provided as suggestions and may not always
              be accurate or appropriate. You are responsible for reviewing and approving all
              content before distribution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable
              for any indirect, incidental, special, or consequential damages arising from your
              use of the Service, including but not limited to loss of data, revenue, or profits.
              Our total liability shall not exceed the amount you paid for the Service in the
              preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access.
              We may temporarily suspend the Service for maintenance, updates, or circumstances
              beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these
              Terms. You may terminate your account at any time. Upon termination, your right
              to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Continued use of the Service after changes
              constitutes acceptance of the modified Terms. We will make reasonable efforts to
              notify you of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States. Any disputes shall be
              resolved in the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at{' '}
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
