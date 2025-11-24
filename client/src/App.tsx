import { Switch, Route, useLocation } from 'wouter';
import { lazy, Suspense } from 'react';
import { Navigation } from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { ProtectedRoute } from './components/ProtectedRoute';

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
const Companies = lazy(() => import('./pages/Companies'));
const Frameworks = lazy(() => import('./pages/Frameworks'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Assistant = lazy(() => import('./pages/Assistant'));
const PluginGenerator = lazy(() => import('./pages/PluginGenerator'));

// Lazy load heavy components
const AssistantWidget = lazy(() => import('./components/AssistantWidget'));
const BackgroundTasksPanel = lazy(() => import('./components/BackgroundTasksPanel'));
const OmniAssistant = lazy(() => import('./components/OmniAssistant').then(module => ({ default: module.OmniAssistant })));
const InsightsPanel = lazy(() => import('./components/OmniAssistant').then(module => ({ default: module.InsightsPanel })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function AppContent() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { currentSession } = useWorkspace();

  // Determine current page for context
  const getCurrentPage = () => {
    if (location === '/') return 'home';
    if (location.startsWith('/playground')) return 'playground';
    if (location.startsWith('/workspaces')) return 'workspaces';
    if (location.startsWith('/agent-manager')) return 'agent-manager';
    return location.replace('/', '');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Public routes */}
          <Route path="/" component={NewHome} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/callback" component={AuthCallback} />
          <Route path="/pricing" component={Pricing} />

        {/* Protected routes */}
        <Route path="/workspaces">
          <ProtectedRoute>
            <Workspaces />
          </ProtectedRoute>
        </Route>
        <Route path="/projects/:id">
          {(params) => (
            <ProtectedRoute>
              <ProjectDetail params={params} />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/playground">
          <ProtectedRoute>
            <PromptPlayground />
          </ProtectedRoute>
        </Route>
        <Route path="/playground/:projectId">
          {(params) => (
            <ProtectedRoute>
              <PromptPlayground params={params} />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/agent-manager">
          <ProtectedRoute>
            <AgentManager />
          </ProtectedRoute>
        </Route>
        <Route path="/companies">
          <ProtectedRoute>
            <Companies />
          </ProtectedRoute>
        </Route>
        <Route path="/frameworks">
          <ProtectedRoute>
            <Frameworks />
          </ProtectedRoute>
        </Route>
        <Route path="/preview/:component">
          {(params) => (
            <ProtectedRoute>
              <ComponentView params={params} />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/editor/:component">
          {(params) => (
            <ProtectedRoute>
              <ComponentView params={params} />
            </ProtectedRoute>
          )}
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
          <OmniAssistant />
          <InsightsPanel />

          <BackgroundTasksPanel />
        </Suspense>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
