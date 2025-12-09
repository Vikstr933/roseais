import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy - AI Library';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90 leading-relaxed">
                AI Library ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">2.1 Information You Provide</h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                  <li><strong className="text-foreground">Account Information:</strong> Username, email address, display name, and password</li>
                  <li><strong className="text-foreground">Profile Information:</strong> Preferences, settings, and profile data</li>
                  <li><strong className="text-foreground">Project Data:</strong> Code, files, and project information you create or upload</li>
                  <li><strong className="text-foreground">API Keys:</strong> Third-party API keys you provide (stored securely using encryption)</li>
                  <li><strong className="text-foreground">Payment Information:</strong> Billing details processed through Stripe (we do not store full credit card information)</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">2.2 Automatically Collected Information</h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                  <li><strong className="text-foreground">Usage Data:</strong> How you interact with the Platform, features used, and time spent</li>
                  <li><strong className="text-foreground">Device Information:</strong> IP address, browser type, operating system, and device identifiers</li>
                  <li><strong className="text-foreground">Log Data:</strong> Server logs, error reports, and diagnostic information</li>
                  <li><strong className="text-foreground">Cookies and Tracking:</strong> Session cookies and similar technologies for authentication and analytics</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">2.3 Third-Party Information</h3>
                <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                  <li><strong className="text-foreground">OAuth Providers:</strong> Information from Discord, Google, GitHub, Apple, and Facebook when you connect accounts</li>
                  <li><strong className="text-foreground">Payment Processors:</strong> Transaction data from Stripe</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage subscriptions</li>
                <li>Authenticate users and prevent fraud</li>
                <li>Send you service-related notifications and updates</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Comply with legal obligations</li>
                <li>Detect and prevent security threats</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">4. How We Share Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-foreground/90">We do not sell your personal information. We may share your information only in the following circumstances:</p>
              
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">4.1 Service Providers</h3>
                <p className="text-foreground/90 mb-2">We share information with third-party service providers who perform services on our behalf, such as:</p>
                <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                  <li><strong className="text-foreground">Hosting Providers:</strong> Render, Vercel for infrastructure</li>
                  <li><strong className="text-foreground">Payment Processors:</strong> Stripe for payment processing</li>
                  <li><strong className="text-foreground">Analytics:</strong> For usage analytics and monitoring</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">4.2 Legal Requirements</h3>
                <p className="text-foreground/90">We may disclose your information if required by law or in response to valid requests by public authorities.</p>
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">4.3 Business Transfers</h3>
                <p className="text-foreground/90">In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">5. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                We implement appropriate technical and organizational measures to protect your information, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Encryption of sensitive data (API keys, passwords) at rest and in transit</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and updates</li>
                <li>Row Level Security (RLS) in our database</li>
                <li>Secure API endpoints with authentication</li>
              </ul>
              <p className="text-foreground/90 mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">6. Your Rights and Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li><strong className="text-foreground">Access:</strong> Request a copy of your personal information</li>
                <li><strong className="text-foreground">Correction:</strong> Update or correct inaccurate information</li>
                <li><strong className="text-foreground">Deletion:</strong> Request deletion of your account and data</li>
                <li><strong className="text-foreground">Portability:</strong> Export your data in a machine-readable format</li>
                <li><strong className="text-foreground">Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong className="text-foreground">Object:</strong> Object to processing of your information for certain purposes</li>
              </ul>
              <p className="text-foreground/90 mt-4">
                To exercise these rights, please contact us at <a href="mailto:support@ailibrary.com" className="text-primary hover:underline font-medium">support@ailibrary.com</a>.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">7. Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                We retain your information for as long as necessary to provide our services and fulfill the purposes described in this Privacy Policy. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or legitimate business purposes.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">8. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                Our services are not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will take steps to delete such information.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">9. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our services, you consent to the transfer of your information to these countries.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">10. Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">11. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <div className="space-y-2 text-foreground/90">
                <p>
                  <strong className="text-foreground">Email:</strong> <a href="mailto:support@ailibrary.com" className="text-primary hover:underline font-medium">support@ailibrary.com</a>
                </p>
                <p>
                  <strong className="text-foreground">Discord:</strong> <a href="https://discord.gg/p7rsdJR2nM" className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer">Join our Discord community</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

