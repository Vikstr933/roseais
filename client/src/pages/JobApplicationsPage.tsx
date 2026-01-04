import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  Mail,
  ExternalLink,
  Edit,
  Trash2,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ApplicationStatus = 'applied' | 'viewed' | 'interview' | 'rejected' | 'offer' | 'accepted' | 'declined';
type ApplicationMethod = 'email' | 'form' | 'linkedin' | 'website' | 'manual';

interface JobApplication {
  id: number;
  jobTitle: string;
  companyName?: string;
  location?: string;
  status: ApplicationStatus;
  appliedAt: string;
  applicationMethod?: ApplicationMethod;
  jobUrl?: string;
  recruiterEmail?: string;
  emailSent: boolean;
  emailOpened: boolean;
  emailReplied: boolean;
  interviewScheduled: boolean;
  interviewDate?: string;
  notes?: string;
  resumeId?: number;
}

interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  byMethod: Record<ApplicationMethod, number>;
  recentApplications: number;
  interviewRate: number;
  offerRate: number;
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  applied: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  interview: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  offer: 'bg-green-100 text-green-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: 'Ansökt',
  viewed: 'Visad',
  interview: 'Intervju',
  rejected: 'Avslagen',
  offer: 'Erbjudande',
  accepted: 'Accepterad',
  declined: 'Avböjd',
};

const METHOD_LABELS: Record<ApplicationMethod, string> = {
  email: 'E-post',
  form: 'Formulär',
  linkedin: 'LinkedIn',
  website: 'Webbplats',
  manual: 'Manuell',
};

export default function JobApplicationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/community/job-applications/resume/:resumeId');
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState({
    jobTitle: '',
    companyName: '',
    location: '',
    applicationMethod: '' as ApplicationMethod | '',
    jobUrl: '',
    recruiterEmail: '',
    notes: '',
    resumeId: undefined as number | undefined,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      setShowAuthDialog(true);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchStats();
    }
  }, [user, statusFilter, searchQuery, params?.resumeId]);

  const fetchApplications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // If viewing applications for a specific resume
      if (params?.resumeId) {
        const response = await apiFetch(`/api/job-applications/resume/${params.resumeId}`);
        if (!response.ok) throw new Error('Failed to fetch applications');
        const data = await response.json();
        setApplications(data.applications || []);
        return;
      }

      // Otherwise, fetch all applications with filters
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }
      if (searchQuery) {
        queryParams.append('search', searchQuery);
      }

      const response = await apiFetch(`/api/job-applications?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch applications');
      
      const data = await response.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte hämta jobbansökningar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      const response = await apiFetch('/api/job-applications/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateApplication = async () => {
    if (!formData.jobTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Jobbtitel krävs',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await apiFetch('/api/job-applications', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create application');

      toast({
        title: 'Success',
        description: 'Jobbansökan skapad',
      });

      setShowCreateDialog(false);
      setFormData({
        jobTitle: '',
        companyName: '',
        location: '',
        applicationMethod: '',
        jobUrl: '',
        recruiterEmail: '',
        notes: '',
        resumeId: undefined,
      });
      fetchApplications();
      fetchStats();
    } catch (error) {
      console.error('Error creating application:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte skapa jobbansökan',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateApplication = async (id: number, updates: Partial<JobApplication>) => {
    try {
      const response = await apiFetch(`/api/job-applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update application');

      toast({
        title: 'Success',
        description: 'Jobbansökan uppdaterad',
      });

      setShowEditDialog(false);
      setEditingApplication(null);
      fetchApplications();
      fetchStats();
    } catch (error) {
      console.error('Error updating application:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte uppdatera jobbansökan',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteApplication = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna jobbansökan?')) return;

    try {
      const response = await apiFetch(`/api/job-applications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete application');

      toast({
        title: 'Success',
        description: 'Jobbansökan borttagen',
      });

      fetchApplications();
      fetchStats();
    } catch (error) {
      console.error('Error deleting application:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte ta bort jobbansökan',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={() => setShowAuthDialog(false)}
      />
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl pt-24">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                Jobbansökningar
              </h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/community/resume-analysis')}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                CV Analys
              </Button>
            </div>
            <p className="text-muted-foreground mt-2">
              Spåra och hantera alla dina jobbansökningar på ett ställe
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ny ansökan
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Totalt</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Senaste 30 dagarna</p>
                    <p className="text-2xl font-bold">{stats.recentApplications}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Intervjufrekvens</p>
                    <p className="text-2xl font-bold">{stats.interviewRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Erbjudandefrekvens</p>
                    <p className="text-2xl font-bold">{stats.offerRate}%</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Sök jobbtitel, företag eller plats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrera status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Inga jobbansökningar ännu</h3>
            <p className="text-muted-foreground mb-4">
              Börja spåra dina jobbansökningar för att se statistik och förbättra dina chanser
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Skapa första ansökan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => (
            <Card key={application.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{application.jobTitle}</h3>
                      <Badge className={STATUS_COLORS[application.status]}>
                        {STATUS_LABELS[application.status]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                      {application.companyName && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          {application.companyName}
                        </div>
                      )}
                      {application.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {application.location}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(application.appliedAt)}
                      </div>
                      {application.applicationMethod && (
                        <Badge variant="outline">
                          {METHOD_LABELS[application.applicationMethod]}
                        </Badge>
                      )}
                    </div>
                    {application.notes && (
                      <p className="text-sm text-muted-foreground mb-3">{application.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {application.emailSent && (
                        <Badge variant="outline" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          E-post skickad
                        </Badge>
                      )}
                      {application.emailOpened && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          E-post öppnad
                        </Badge>
                      )}
                      {application.emailReplied && (
                        <Badge variant="outline" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Svar mottaget
                        </Badge>
                      )}
                      {application.interviewScheduled && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          Intervju schemalagd
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {application.jobUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(application.jobUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingApplication(application);
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteApplication(application.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ny jobbansökan</DialogTitle>
            <DialogDescription>
              Lägg till en ny jobbansökan för att börja spåra den
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="jobTitle">Jobbtitel *</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="t.ex. Full Stack Developer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="companyName">Företag</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="t.ex. Acme Inc"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Plats</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="t.ex. Stockholm"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applicationMethod">Ansökningsmetod</Label>
              <Select
                value={formData.applicationMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, applicationMethod: value as ApplicationMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj metod" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="jobUrl">Jobbannons URL</Label>
              <Input
                id="jobUrl"
                value={formData.jobUrl}
                onChange={(e) => setFormData({ ...formData, jobUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recruiterEmail">Rekryterares e-post</Label>
              <Input
                id="recruiterEmail"
                type="email"
                value={formData.recruiterEmail}
                onChange={(e) => setFormData({ ...formData, recruiterEmail: e.target.value })}
                placeholder="recruiter@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Anteckningar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Lägg till anteckningar om ansökan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleCreateApplication}>Skapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera jobbansökan</DialogTitle>
            <DialogDescription>
              Uppdatera status och information om jobbansökan
            </DialogDescription>
          </DialogHeader>
          {editingApplication && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editStatus">Status</Label>
                <Select
                  value={editingApplication.status}
                  onValueChange={(value) =>
                    handleUpdateApplication(editingApplication.id, {
                      status: value as ApplicationStatus,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editNotes">Anteckningar</Label>
                <Textarea
                  id="editNotes"
                  value={editingApplication.notes || ''}
                  onChange={(e) =>
                    handleUpdateApplication(editingApplication.id, { notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>E-post tracking</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingApplication.emailOpened}
                      onChange={(e) =>
                        handleUpdateApplication(editingApplication.id, {
                          emailOpened: e.target.checked,
                        })
                      }
                    />
                    <Label>E-post öppnad</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingApplication.emailReplied}
                      onChange={(e) =>
                        handleUpdateApplication(editingApplication.id, {
                          emailReplied: e.target.checked,
                        })
                      }
                    />
                    <Label>Svar mottaget</Label>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Intervju</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingApplication.interviewScheduled}
                    onChange={(e) =>
                      handleUpdateApplication(editingApplication.id, {
                        interviewScheduled: e.target.checked,
                      })
                    }
                  />
                  <Label>Intervju schemalagd</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

