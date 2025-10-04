import { Switch, Route } from 'wouter';
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
import { Navigation } from './components/Navigation';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <Switch>
          <Route path="/" component={NewHome} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/workspaces" component={Workspaces} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/playground" component={PromptPlayground} />
          <Route path="/playground/:projectId" component={PromptPlayground} />
          <Route path="/agent-manager" component={AgentManager} />
          <Route path="/companies" component={Companies} />
          <Route path="/frameworks" component={Frameworks} />
          <Route path="/preview/:component" component={ComponentView} />
          <Route path="/editor/:component" component={ComponentView} />
          <Route path="/system-logs" component={SystemLogs} />
          <Route path="/sessions" component={Sessions} />
        </Switch>
      </div>
    </AuthProvider>
  );
}

export default App;
