import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import { Navigation } from "@/components/Navigation";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
      </Switch>
    </div>
  );
}

export default App;
