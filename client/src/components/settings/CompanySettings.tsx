import { useState, useEffect } from 'react';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, MapPin, FileText } from 'lucide-react';

interface CompanyInfo {
  companyName: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  website: string;
}

export function CompanySettings() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>({
    companyName: '',
    vatNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    phone: '',
    website: ''
  });

  useEffect(() => {
    fetchCompanyInfo();
  }, [user]);

  const fetchCompanyInfo = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/user/company/${user.id}`, {
        headers: getAuthHeaders(sessionToken)
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setCompany(data);
        }
      }
    } catch (error) {
      console.error('Error fetching company info:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/company', {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify(company)
      });

      if (!response.ok) {
        throw new Error('Failed to update company information');
      }

      toast({
        title: 'Success',
        description: 'Company information has been updated successfully'
      });
    } catch (error) {
      console.error('Error updating company info:', error);
      toast({
        title: 'Error',
        description: 'Failed to update company information. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            <CardTitle>Company Information</CardTitle>
          </div>
          <CardDescription>
            Business details for invoicing and legal purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                value={company.companyName}
                onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT/Tax ID Number</Label>
              <Input
                id="vatNumber"
                placeholder="GB123456789"
                value={company.vatNumber}
                onChange={(e) => setCompany({ ...company, vatNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://www.example.com"
                value={company.website}
                onChange={(e) => setCompany({ ...company, website: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Address */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>Business Address</CardTitle>
          </div>
          <CardDescription>
            Your company's legal business address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              placeholder="123 Main Street"
              value={company.addressLine1}
              onChange={(e) => setCompany({ ...company, addressLine1: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input
              id="addressLine2"
              placeholder="Suite 100"
              value={company.addressLine2}
              onChange={(e) => setCompany({ ...company, addressLine2: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="San Francisco"
                value={company.city}
                onChange={(e) => setCompany({ ...company, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                placeholder="CA"
                value={company.state}
                onChange={(e) => setCompany({ ...company, state: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP/Postal Code</Label>
              <Input
                id="zipCode"
                placeholder="94105"
                value={company.zipCode}
                onChange={(e) => setCompany({ ...company, zipCode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={company.country} onValueChange={(value) => setCompany({ ...company, country: value })}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="NL">Netherlands</SelectItem>
                <SelectItem value="SE">Sweden</SelectItem>
                <SelectItem value="NO">Norway</SelectItem>
                <SelectItem value="DK">Denmark</SelectItem>
                <SelectItem value="JP">Japan</SelectItem>
                <SelectItem value="SG">Singapore</SelectItem>
                <SelectItem value="IN">India</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={fetchCompanyInfo}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tax Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Tax Information</CardTitle>
          </div>
          <CardDescription>
            Tax settings and compliance information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Tax information is used for generating invoices and ensuring compliance with local tax regulations.
              All invoices will be sent to your registered email address.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
