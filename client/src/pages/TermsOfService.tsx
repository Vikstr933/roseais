import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsOfService() {
  useEffect(() => {
    document.title = 'Terms of Service - AI Library';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                By accessing and using AI Library ("the Platform", "we", "us", "our"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">2. Description of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                AI Library is an AI-powered platform that enables users to generate, manage, and deploy web applications using artificial intelligence. Our services include but are not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>AI-powered code generation and application development</li>
                <li>Project management and workspace organization</li>
                <li>Integration with third-party services (Discord, GitHub, Google, Apple, Facebook, etc.)</li>
                <li>Deployment services to platforms like Vercel</li>
                <li>Custom agent creation and management</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">3. User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                To access certain features of the Platform, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your information to keep it accurate, current, and complete</li>
                <li>Maintain the security of your password and identification</li>
                <li>Accept all responsibility for activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">4. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">You agree not to use the Platform to:</p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Generate or distribute malicious code, viruses, or harmful software</li>
                <li>Attempt to gain unauthorized access to the Platform or other users' accounts</li>
                <li>Use the Platform for any illegal or unauthorized purpose</li>
                <li>Interfere with or disrupt the Platform or servers connected to the Platform</li>
                <li>Generate content that is defamatory, harassing, abusive, or otherwise objectionable</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">5. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90 leading-relaxed">
                The Platform and its original content, features, and functionality are owned by AI Library and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-foreground/90 leading-relaxed">
                Code and applications generated by you using the Platform are your property. However, you grant us a license to use, store, and process your content solely for the purpose of providing and improving our services.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">6. Subscription and Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                Some features of the Platform are available through paid subscriptions. By subscribing, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Pay all fees associated with your subscription</li>
                <li>Automatic renewal of your subscription unless cancelled</li>
                <li>No refunds for partial subscription periods unless required by law</li>
              </ul>
              <p className="text-foreground/90">
                We reserve the right to change our pricing at any time. Price changes will be communicated to you in advance.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">7. API Keys and Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                You may provide API keys for third-party services (e.g., OpenAI, Anthropic, GitHub) to use with the Platform. You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-foreground/90">
                <li>Keeping your API keys secure and confidential</li>
                <li>Complying with the terms of service of third-party providers</li>
                <li>Any charges incurred through the use of your API keys</li>
              </ul>
              <p className="text-foreground/90">
                We store API keys securely using encryption, but we are not responsible for any unauthorized access to your keys.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">8. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                To the maximum extent permitted by law, AI Library shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Platform.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">9. Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                We may terminate or suspend your account and access to the Platform immediately, without prior notice or liability, for any reason, including if you breach the Terms. Upon termination, your right to use the Platform will cease immediately.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">10. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">11. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/90">
                If you have any questions about these Terms of Service, please contact us at:
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

