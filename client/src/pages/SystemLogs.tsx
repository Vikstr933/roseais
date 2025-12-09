import React from 'react';
import { LogViewer } from '../components/LogViewer';
import { AuthGuard } from '../components/AuthGuard';

export default function SystemLogs() {
  return (
    <AuthGuard>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">System Logs</h1>
          <p className="text-sm text-gray-500">
            Real-time logs of AI agent operations and system events
          </p>
        </div>
        <LogViewer />
      </div>
    </AuthGuard>
  );
}
