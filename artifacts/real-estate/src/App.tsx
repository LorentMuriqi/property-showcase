import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ScrollToTop } from "@/components/ScrollToTop";
import NotFound from "@/pages/not-found";


// Pages
import Home from "@/pages/Home";
import Projects from "@/pages/Projects";
import ProjectDetails from "@/pages/ProjectDetails";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProjectForm from "@/pages/admin/AdminProjectForm";
import AdminVirtualTour from "@/pages/admin/AdminVirtualTour";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminRules from "@/pages/admin/AdminRules";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetails} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      
{/* Admin Routes */}
<Route path="/admin/login" component={AdminLogin} />
<Route path="/admin" component={AdminDashboard} />
<Route path="/admin/users" component={AdminUsers} />
<Route path="/admin/rules" component={AdminRules} />
<Route path="/admin/projects/new" component={AdminProjectForm} />
<Route path="/admin/projects/:id/edit" component={AdminProjectForm} />
<Route path="/admin/projects/:id/virtual-tour" component={AdminVirtualTour} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
<WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
  <ScrollToTop />
  <Router />
</WouterRouter>
          <Toaster />
          <Analytics />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
