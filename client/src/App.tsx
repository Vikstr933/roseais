import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import Workspaces from "@/pages/Workspaces";
import PromptPlayground from "@/pages/PromptPlayground";
import { Navigation } from "@/components/Navigation";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/playground" component={PromptPlayground} />
      </Switch>
    </div>
  );
}

export default App;