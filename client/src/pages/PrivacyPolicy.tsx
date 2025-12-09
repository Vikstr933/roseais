import { useEffect } from 'react';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy - AI Library';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
            <p>
              AI Library ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Username, email address, display name, and password</li>
              <li><strong>Profile Information:</strong> Preferences, settings, and profile data</li>
              <li><strong>Project Data:</strong> Code, files, and project information you create or upload</li>
              <li><strong>API Keys:</strong> Third-party API keys you provide (stored securely using encryption)</li>
              <li><strong>Payment Information:</strong> Billing details processed through Stripe (we do not store full credit card information)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> How you interact with the Platform, features used, and time spent</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> Server logs, error reports, and diagnostic information</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies and similar technologies for authentication and analytics</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Third-Party Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>OAuth Providers:</strong> Information from Discord, Google, GitHub when you connect accounts</li>
              <li><strong>Payment Processors:</strong> Transaction data from Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and manage subscriptions</li>
              <li>Authenticate users and prevent fraud</li>
              <li>Send you service-related notifications and updates</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Analyze usage patterns to improve user experience</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent security threats</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">4. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information only in the following circumstances:</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Service Providers</h3>
            <p>We share information with third-party service providers who perform services on our behalf, such as:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Hosting Providers:</strong> Render, Vercel for infrastructure</li>
              <li><strong>Payment Processors:</strong> Stripe for payment processing</li>
              <li><strong>Analytics:</strong> For usage analytics and monitoring</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Legal Requirements</h3>
            <p>We may disclose your information if required by law or in response to valid requests by public authorities.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Business Transfers</h3>
            <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of sensitive data (API keys, passwords) at rest and in transit</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and updates</li>
              <li>Row Level Security (RLS) in our database</li>
              <li>Secure API endpoints with authentication</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Your Rights and Choices</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Object:</strong> Object to processing of your information for certain purposes</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at <a href="mailto:support@ailibrary.com" className="text-primary hover:underline">support@ailibrary.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide our services and fulfill the purposes described in this Privacy Policy. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Children's Privacy</h2>
            <p>
              Our services are not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our services, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> <a href="mailto:support@ailibrary.com" className="text-primary hover:underline">support@ailibrary.com</a><br />
              <strong>Discord:</strong> <a href="https://discord.gg/p7rsdJR2nM" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Join our Discord community</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

