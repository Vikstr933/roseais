import { Switch, Route, useLocation } from 'wouter';
import NewHome from './pages/NewHome';
import Workspaces from './pages/Workspaces';
import ProjectDetail from './pages/ProjectDetail';
import PromptPlayground from './pages/PromptPlayground';
import AgentManager from './pages/AgentManager';
import ComponentView from './pages/ComponentView';
import SystemLogs from './pages/SystemLogs';
import Sessions from './pages/Sessions';
import Companies from './pages/Companies';
import Frameworks from './pages/Frameworks';
import AuthCallback from './pages/AuthCallback';
import Pricing from './pages/Pricing';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import { Navigation } from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import AssistantWidget from './components/AssistantWidget';
import BackgroundTasksPanel from './components/BackgroundTasksPanel';
import { ProtectedRoute } from './components/ProtectedRoute';

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
      <Switch>
        {/* Public routes */}
        <Route path="/" component={NewHome} />
        <Route path="/auth/callback" component={AuthCallback} />
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
      </Switch>

      {/* Global AI Assistant Widget - Only show when logged in */}
      {user && (
        <>
          <AssistantWidget
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
          />
          <BackgroundTasksPanel />
        </>
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
