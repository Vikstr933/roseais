import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';
import { apiFetch } from '../lib/api';

interface SystemStats {
  users: {
    total: number;
    byRole: Record<string, number>;
    byTier: Record<string, number>;
  };
  agents: {
    total: number;
    system: number;
    user: number;
  };
  workspaces: {
    total: number;
  };
  credentials: {
    total: number;
  };
}

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | 'superadmin';
  tier: 'free' | 'pro' | 'enterprise';
  isActive: number;
  createdAt: string;
  lastActive: string;
  subscriptionStatus?: string;
  stripeCustomerId?: string | null;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  role: string;
  model: string;
  userId?: string | null;
  isSystem: number;
  isActive: number;
  createdAt: string;
  updatedAt: Date;
  _isSystemAgent: boolean;
  _ownerUserId: string | null;
}

interface Workspace {
  id: number;
  name: string;
  description?: string;
  ownerId: string;
  status: string;
  createdAt: string;
  updatedAt: Date;
}

export default function AdminDashboard() {
  const { user, isLoading, sessionToken } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'agents' | 'workspaces'>('stats');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) {
      setLocation('/');
    }
  }, [user, isLoading, setLocation]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return;

    const fetchData = async () => {
      setLoadingData(true);
      setError(null);

      try {
        if (!sessionToken) throw new Error('No auth token');

        if (activeTab === 'stats') {
          const res = await apiFetch('/api/admin/stats');
          if (!res.ok) throw new Error('Failed to fetch stats');
          const data = await res.json();
          setStats(data);
        } else if (activeTab === 'users') {
          const res = await apiFetch('/api/admin/users');
          if (!res.ok) throw new Error('Failed to fetch users');
          const data = await res.json();
          setUsers(data);
        } else if (activeTab === 'agents') {
          const res = await apiFetch('/api/admin/agents');
          if (!res.ok) throw new Error('Failed to fetch agents');
          const data = await res.json();
          setAgents(data);
        } else if (activeTab === 'workspaces') {
          const res = await apiFetch('/api/admin/workspaces');
          if (!res.ok) throw new Error('Failed to fetch workspaces');
          const data = await res.json();
          setWorkspaces(data);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [activeTab, user, sessionToken]);

  const updateUserRole = async (userId: string, role: string) => {
    try {
      if (!sessionToken) return;
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });

      if (!res.ok) throw new Error('Failed to update role');

      // Refresh users list
      setUsers(users.map(u => u.id === userId ? { ...u, role: role as any } : u));
      alert('Role updated successfully!');
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role');
    }
  };

  const updateUserTier = async (userId: string, tier: string) => {
    try {
      if (!sessionToken) return;
      const res = await apiFetch(`/api/admin/users/${userId}/tier`, {
        method: 'PUT',
        body: JSON.stringify({ tier })
      });

      if (!res.ok) throw new Error('Failed to update tier');

      // Refresh users list
      setUsers(users.map(u => u.id === userId ? { ...u, tier: tier as any } : u));
      alert('Tier updated successfully!');
    } catch (err) {
      console.error('Error updating tier:', err);
      alert('Failed to update tier');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50">
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-purple-700">System management and administration</p>
        </div>

        {/* Tabs */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1 mb-6 border border-purple-200/50 shadow-lg">
          <div className="flex space-x-1">
            {[
              { key: 'stats', label: 'Statistics', icon: '📊' },
              { key: 'users', label: 'Users', icon: '👥' },
              { key: 'agents', label: 'Agents', icon: '🤖' },
              { key: 'workspaces', label: 'Workspaces', icon: '📁' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-4 py-3 rounded-md font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-violet-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-purple-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loadingData ? (
          <div className="text-gray-900 text-center py-12">
            <div className="text-xl">Loading {activeTab}...</div>
          </div>
        ) : (
          <>
            {/* Statistics Tab */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Users Stats */}
                <div className="bg-white/95 backdrop-blur-sm border border-purple-200/50 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Users</h3>
                    <span className="text-3xl">👥</span>
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mb-4">{stats.users.total}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Admins:</span>
                      <span className="text-gray-900 font-medium">{(stats.users.byRole.admin || 0) + (stats.users.byRole.superadmin || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Users:</span>
                      <span className="text-gray-900 font-medium">{stats.users.byRole.user || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Agents Stats */}
                <div className="bg-white/95 backdrop-blur-sm border border-purple-200/50 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Agents</h3>
                    <span className="text-3xl">🤖</span>
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mb-4">{stats.agents.total}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">System:</span>
                      <span className="text-gray-900 font-medium">{stats.agents.system}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">User-created:</span>
                      <span className="text-gray-900 font-medium">{stats.agents.user}</span>
                    </div>
                  </div>
                </div>

                {/* Workspaces Stats */}
                <div className="bg-white/95 backdrop-blur-sm border border-purple-200/50 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Workspaces</h3>
                    <span className="text-3xl">📁</span>
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mb-4">{stats.workspaces.total}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total workspaces</span>
                    </div>
                  </div>
                </div>

                {/* Credentials Stats */}
                <div className="bg-white/95 backdrop-blur-sm border border-purple-200/50 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Credentials</h3>
                    <span className="text-3xl">🔑</span>
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mb-4">{stats.credentials.total}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total API keys</span>
                    </div>
                  </div>
                </div>

                {/* Tier Distribution */}
                <div className="bg-white/95 backdrop-blur-sm border border-purple-200/50 rounded-lg p-6 md:col-span-2 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Tiers</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{stats.users.byTier.free || 0}</div>
                      <div className="text-sm text-gray-600">Free</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{stats.users.byTier.pro || 0}</div>
                      <div className="text-sm text-gray-600">Pro</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{stats.users.byTier.enterprise || 0}</div>
                      <div className="text-sm text-gray-600">Enterprise</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-white/95 backdrop-blur-sm rounded-lg overflow-hidden border border-purple-200/50 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-purple-100/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Tier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-200/30">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-purple-50/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{u.displayName}</div>
                            <div className="text-sm text-gray-600">@{u.username}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{u.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={u.role}
                              onChange={(e) => updateUserRole(u.id, e.target.value)}
                              className="bg-white text-gray-900 px-3 py-1 rounded text-sm border border-purple-200/50 focus:border-purple-500 focus:outline-none"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={u.tier}
                              onChange={(e) => updateUserTier(u.id, e.target.value)}
                              className="bg-white text-gray-900 px-3 py-1 rounded text-sm border border-purple-200/50 focus:border-purple-500 focus:outline-none"
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-violet-600 hover:text-violet-700 mr-3">View</button>
                            <button className="text-rose-600 hover:text-rose-700">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div className="bg-white/95 backdrop-blur-sm rounded-lg overflow-hidden border border-purple-200/50 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-purple-100/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-200/30">
                      {agents.map(agent => (
                        <tr key={agent.id} className="hover:bg-purple-50/50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            <div className="text-sm text-gray-600 truncate max-w-xs">{agent.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${agent._isSystemAgent ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {agent._isSystemAgent ? 'System' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{agent.model}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {agent._ownerUserId || 'System'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${agent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {agent.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(agent.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Workspaces Tab */}
            {activeTab === 'workspaces' && (
              <div className="bg-white/95 backdrop-blur-sm rounded-lg overflow-hidden border border-purple-200/50 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-purple-100/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Owner ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-200/30">
                      {workspaces.map(ws => (
                        <tr key={ws.id} className="hover:bg-purple-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ws.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 truncate max-w-md">{ws.description || 'No description'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ws.ownerId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                              {ws.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(ws.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
