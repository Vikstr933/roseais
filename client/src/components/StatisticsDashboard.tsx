import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '../lib/api';
import { TrendingUp, Send, MessageSquare, Briefcase, Award, BarChart3, Loader2 } from 'lucide-react';

interface Statistics {
  totalApplications: number;
  applied: number;
  interviews: number;
  offers: number;
  averageMatchScore: number;
  responseRate: string;
}

export function StatisticsDashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatistics, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await apiFetch('/api/job-applications/stats');
      const data = await response.json();
      if (data.success && data.stats) {
        // Transform the stats to match our interface
        setStats({
          totalApplications: data.stats.totalApplications || 0,
          applied: data.stats.applied || 0,
          interviews: data.stats.interviews || 0,
          offers: data.stats.offers || 0,
          averageMatchScore: data.stats.averageMatchScore || 0,
          responseRate: data.stats.responseRate || '0',
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No statistics available yet. Start applying to jobs to see your progress!
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      title: 'Total Applications',
      value: stats.totalApplications,
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Applied',
      value: stats.applied,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Interviews',
      value: stats.interviews,
      icon: MessageSquare,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Offers',
      value: stats.offers,
      icon: Award,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    },
    {
      title: 'Avg Match Score',
      value: `${stats.averageMatchScore.toFixed(0)}%`,
      icon: BarChart3,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      title: 'Response Rate',
      value: `${stats.responseRate}%`,
      icon: Briefcase,
      color: 'text-pink-500',
      bgColor: 'bg-pink-50 dark:bg-pink-950',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card key={idx} className={`${stat.bgColor}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

