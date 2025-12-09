import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock, Building, CreditCard, Settings as SettingsIcon, Key } from 'lucide-react';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import CredentialVault from './CredentialVault';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-foreground">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your account settings, preferences, and billing information
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-grid overflow-x-auto">
            <TabsTrigger value="account" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <Key className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <Building className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              <SettingsIcon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-4">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4">
            <CredentialVault />
          </TabsContent>

          <TabsContent value="company" className="space-y-4">
            <CompanySettings />
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <BillingSettings />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <PreferencesSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
