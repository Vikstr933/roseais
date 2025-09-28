import { Switch, Route } from "wouter";
import Home from "./pages/Home";
import Workspaces from "./pages/Workspaces";
import PromptPlayground from "./pages/PromptPlayground";
import AgentManager from "./pages/AgentManager";
import ComponentView from "./pages/ComponentView";
import SystemLogs from "./pages/SystemLogs";
import Sessions from "./pages/Sessions";
import Companies from "./pages/Companies";
import Frameworks from "./pages/Frameworks";
import { Navigation } from "./components/Navigation";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/playground" component={PromptPlayground} />
        <Route path="/agent-manager" component={AgentManager} />
        <Route path="/companies" component={Companies} />
        <Route path="/frameworks" component={Frameworks} />
        <Route path="/preview/:component" component={ComponentView} />
        <Route path="/editor/:component" component={ComponentView} />
        <Route path="/system-logs" component={SystemLogs} />
        <Route path="/sessions" component={Sessions} />
      </Switch>
    </div>
  );
}

export default App;
