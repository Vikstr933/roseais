import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '../lib/api';
import { Clock, Building2, MapPin, TrendingUp, CheckCircle2, XCircle, Loader2, Filter, Briefcase } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JobApplication {
  id: number;
  jobTitle: string;
  companyName: string;
  location?: string;
  applicationStatus: string;
  matchPercentage?: number;
  appliedAt?: string;
  createdAt: string;
  jobUrl?: string;
}

export function ApplicationDashboard() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchApplications();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchApplications, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchApplications = async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await apiFetch(`/api/job-applications${params}`);
      const data = await response.json();
      if (data.success) {
        // Remove duplicates based on id
        const uniqueApplications = Array.from(
          new Map((data.applications || []).map((app: JobApplication) => [app.id, app])).values()
        );
        setApplications(uniqueApplications);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending: { label: 'Pending', variant: 'secondary', icon: Loader2 },
      applied: { label: 'Applied', variant: 'default', icon: CheckCircle2 },
      waiting: { label: 'Waiting', variant: 'outline', icon: Clock },
      interview: { label: 'Interview', variant: 'default', icon: TrendingUp },
      offer: { label: 'Offer', variant: 'default', icon: CheckCircle2 },
      rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading && applications.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Filter */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Min Ansöknings-Tracker</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Här ser du alla jobb du har loggat eller ansökt till
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="pending">Väntar</SelectItem>
            <SelectItem value="applied">Ansökt</SelectItem>
            <SelectItem value="waiting">Väntar på svar</SelectItem>
            <SelectItem value="interview">Intervju</SelectItem>
            <SelectItem value="offer">Erbjudande</SelectItem>
            <SelectItem value="rejected">Avslagen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Inga ansökningar hittades</p>
          <p className="text-xs mt-1">Börja spåra jobb för att se dem här</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <div
              key={app.id}
              className="group p-4 border rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Company Logo */}
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {app.companyName?.charAt(0).toUpperCase() || '?'}
                </div>

                {/* Job Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm leading-tight mb-1">{app.jobTitle}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        {app.companyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {app.companyName}
                          </span>
                        )}
                        {app.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {app.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(app.applicationStatus)}
                      {app.matchPercentage !== undefined && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-medium">
                          <TrendingUp className="h-3 w-3" />
                          {app.matchPercentage}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Visa jobbannons →
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(app.appliedAt || app.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

