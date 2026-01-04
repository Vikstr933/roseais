import { Switch, Route, useLocation } from 'wouter';
import { lazy, Suspense } from 'react';
import { Navigation } from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// App version - force cache bust
const APP_VERSION = '2025.11.03.1';

// Lazy load pages for code splitting - reduces initial bundle size
const NewHome = lazy(() => import('./pages/NewHome'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const PromptPlayground = lazy(() => import('./pages/PromptPlayground'));
const AgentManager = lazy(() => import('./pages/AgentManager'));
const ComponentView = lazy(() => import('./pages/ComponentView'));
const SystemLogs = lazy(() => import('./pages/SystemLogs'));
const Sessions = lazy(() => import('./pages/Sessions'));
// Removed: Companies and Frameworks pages (not actively used)
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Pricing = lazy(() => import('./pages/Pricing'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Assistant = lazy(() => import('./pages/Assistant'));
const PluginGenerator = lazy(() => import('./pages/PluginGenerator'));
const ElonChat = lazy(() => import('./pages/ElonChat'));
const PublicProjects = lazy(() => import('./pages/PublicProjects'));
const PublicProjectDetail = lazy(() => import('./pages/PublicProjectDetail'));
const VideoTranscriptionApp = lazy(() => import('./pages/VideoTranscriptionApp'));
const ResumeAnalysisApp = lazy(() => import('./pages/ResumeAnalysisApp'));
const JobApplicationsPage = lazy(() => import('./pages/JobApplicationsPage'));
const DataInsights = lazy(() => import('./pages/DataInsights'));

// Lazy load heavy components
const AssistantWidget = lazy(() => import('./components/AssistantWidget'));
const BackgroundTasksPanel = lazy(() => import('./components/BackgroundTasksPanel'));
const OmniAssistant = lazy(() => import('./components/OmniAssistant').then(module => ({ default: module.OmniAssistant })));
const InsightsPanel = lazy(() => import('./components/OmniAssistant').then(module => ({ default: module.InsightsPanel })));
const PWAInstallPrompt = lazy(() => import('./components/PWAInstallPrompt').then(module => ({ default: module.PWAInstallPrompt })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function AppContent() {
  const [location] = useLocation();
  const { user, isLoading: authIsLoading } = useAuth();
  const { currentSession } = useWorkspace();

  // Determine current page for context
  const getCurrentPage = () => {
    if (location === '/') return 'home';
    if (location.startsWith('/playground')) return 'playground';
    if (location.startsWith('/workspaces')) return 'workspaces';
    if (location.startsWith('/agent-manager')) return 'agent-manager';
    return location.replace('/', '');
  };

  // Always render Navigation and basic structure, even during auth loading
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ backgroundColor: 'var(--background, #0a0a0a)' }}>
      <Navigation />
      {authIsLoading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]" style={{ paddingTop: '5rem' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : (
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Public routes */}
          <Route path="/" component={NewHome} />
          <Route path="/public-projects" component={PublicProjects} />
          <Route path="/public-projects/:id" component={PublicProjectDetail} />
          <Route path="/community/video-transcription" component={VideoTranscriptionApp} />
          <Route path="/community/resume-analysis" component={ResumeAnalysisApp} />
          <Route path="/community/job-applications" component={JobApplicationsPage} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/callback" component={AuthCallback} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          
          {/* Dedicated Elon Chat Page for PWA */}
          <Route path="/elon" component={ElonChat} />
          <Route path="/chat" component={ElonChat} />

        {/* Protected routes */}
        <Route path="/workspaces">
          <ProtectedRoute>
            <Workspaces />
          </ProtectedRoute>
        </Route>
        <Route path="/projects/:id">
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        </Route>
        <Route path="/playground">
          <ProtectedRoute>
            <PromptPlayground />
          </ProtectedRoute>
        </Route>
        <Route path="/playground/:projectId">
          <ProtectedRoute>
            <PromptPlayground />
          </ProtectedRoute>
        </Route>
        <Route path="/agent-manager">
          <ProtectedRoute>
            <AgentManager />
          </ProtectedRoute>
        </Route>
        <Route path="/preview/:component">
          <ProtectedRoute>
            <ComponentView />
          </ProtectedRoute>
        </Route>
        <Route path="/editor/:component">
          <ProtectedRoute>
            <ComponentView />
          </ProtectedRoute>
        </Route>
        <Route path="/system-logs">
          <ProtectedRoute>
            <SystemLogs />
          </ProtectedRoute>
        </Route>
        <Route path="/sessions">
          <ProtectedRoute>
            <Sessions />
          </ProtectedRoute>
        </Route>
        <Route path="/integrations">
          <ProtectedRoute>
            <Integrations />
          </ProtectedRoute>
        </Route>
        <Route path="/settings">
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        </Route>
        <Route path="/data-insights">
          <ProtectedRoute>
            <DataInsights />
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/assistant">
          <ProtectedRoute>
            <Assistant />
          </ProtectedRoute>
        </Route>
        <Route path="/plugin-generator">
          <ProtectedRoute>
            <PluginGenerator />
          </ProtectedRoute>
        </Route>
        </Switch>
      </Suspense>
      )}

      {/* Global AI Assistant - Only show when logged in */}
      {user && (
        <Suspense fallback={null}>
          {/* Legacy AssistantWidget - Can be disabled via settings in future */}
          {/* <AssistantWidget
            contextData={{
              currentPage: getCurrentPage(),
              workspaceId: currentSession?.id,
              generatedFiles: currentSession?.generatedFiles || [],
              currentPrompt: currentSession?.metadata?.currentPrompt,
              lastGenerationResult: currentSession?.generatedFiles ? {
                filesGenerated: currentSession.generatedFiles.length,
                files: currentSession.generatedFiles
              } : undefined
            }}
          /> */}

          {/* Elon - AI Assistant with Web Search */}
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('[App] OmniAssistant ErrorBoundary caught error:', error);
              console.error('[App] Error info:', errorInfo);
              // Also log to window for visibility
              (window as any).__OMNI_ASSISTANT_ERROR__ = { error, errorInfo };
            }}
            fallback={
              <div className="fixed bottom-4 right-4 p-4 bg-destructive text-destructive-foreground rounded-lg shadow-lg max-w-md z-50">
                <p className="text-sm font-semibold mb-2">Elon Assistant failed to load</p>
                <p className="text-xs mb-2">Check browser console (F12) for details.</p>
                <p className="text-xs opacity-75">
                  Error: {(window as any).__OMNI_ASSISTANT_ERROR__?.error?.message || 'Unknown error'}
                </p>
                <button
                  onClick={() => {
                    console.log('[App] Full error details:', (window as any).__OMNI_ASSISTANT_ERROR__);
                    window.location.reload();
                  }}
                  className="mt-2 text-xs underline"
                >
                  Reload page
                </button>
              </div>
            }
          >
            <OmniAssistant />
          </ErrorBoundary>
          <InsightsPanel />

          <BackgroundTasksPanel />
        </Suspense>
      )}

      {/* PWA Install Prompt - Show globally */}
      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>
    </div>
  );
}

function App() {
  console.log('[App] Component rendering...');
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
