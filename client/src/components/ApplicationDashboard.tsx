import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '../lib/api';
import { Clock, Building2, MapPin, TrendingUp, CheckCircle2, XCircle, Loader2, Filter } from 'lucide-react';
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
        setApplications(data.applications || []);
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
      <div className="flex items-center justify-between">
        <CardTitle className="text-2xl">Job Applications</CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applications</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Applications List */}
      <div className="space-y-3">
        {applications.map((app) => (
          <Card key={app.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Company Logo Placeholder */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {app.companyName.charAt(0).toUpperCase()}
                  </div>

                  {/* Job Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{app.jobTitle}</h3>
                      {getStatusBadge(app.applicationStatus)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {app.companyName}
                      </div>
                      {app.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {app.location}
                        </div>
                      )}
                    </div>
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        View Job Posting →
                      </a>
                    )}
                  </div>

                  {/* Match Score & Time */}
                  <div className="text-right">
                    {app.matchPercentage !== undefined && (
                      <div className="flex items-center gap-1 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-semibold text-green-600">{app.matchPercentage}%</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(app.appliedAt || app.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {applications.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>No applications found.</p>
            <p className="text-sm mt-2">Start applying to jobs to see them here!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

