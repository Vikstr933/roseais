import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { User, Lock, Building, CreditCard, Settings as SettingsIcon, Key } from 'lucide-react';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import { CredentialsAndKeysSettings } from '@/components/settings/CredentialsAndKeysSettings';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-foreground">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your account, credentials, and preferences
          </p>
        </div>

        {/* Vertical Tabs Layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            {/* Vertical Tab List - LEFT SIDE */}
            <Card className="p-2 h-fit">
              <TabsList className="flex flex-col items-stretch h-auto bg-transparent space-y-1">
                <TabsTrigger 
                  value="account" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <User className="h-4 w-4" />
                  <span>Account</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Lock className="h-4 w-4" />
                  <span>Security</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="credentials" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Key className="h-4 w-4" />
                  <span>Credentials & Keys</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="company" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Building className="h-4 w-4" />
                  <span>Company</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="billing" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="preferences" 
                  className="justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Preferences</span>
                </TabsTrigger>
              </TabsList>
            </Card>

            {/* Tab Content - RIGHT SIDE */}
            <div>
              <TabsContent value="account" className="mt-0">
                <AccountSettings />
              </TabsContent>

              <TabsContent value="security" className="mt-0">
                <SecuritySettings />
              </TabsContent>

              <TabsContent value="credentials" className="mt-0">
                <CredentialsAndKeysSettings />
              </TabsContent>

              <TabsContent value="company" className="mt-0">
                <CompanySettings />
              </TabsContent>

              <TabsContent value="billing" className="mt-0">
                <BillingSettings />
              </TabsContent>

              <TabsContent value="preferences" className="mt-0">
                <PreferencesSettings />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
