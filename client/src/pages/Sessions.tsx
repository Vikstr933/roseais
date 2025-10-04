import React from 'react';
import SessionHistory from '../components/SessionHistory';
import { AuthGuard } from '../components/AuthGuard';

export default function Sessions() {
  return (
    <AuthGuard>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Code Generation Sessions</h1>
        <SessionHistory />
      </div>
    </AuthGuard>
  );
}
