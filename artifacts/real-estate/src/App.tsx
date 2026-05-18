import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ScrollToTop } from "@/components/ScrollToTop";

const Home = lazy(() => import("@/pages/Home"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetails = lazy(() => import("@/pages/ProjectDetails"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));

const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProjectForm = lazy(() => import("@/pages/admin/AdminProjectForm"));
const AdminVirtualTour = lazy(() => import("@/pages/admin/AdminVirtualTour"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminRules = lazy(() => import("@/pages/admin/AdminRules"));
const AdminClientTours = lazy(() => import("@/pages/admin/AdminClientTours"));

const PublicVirtualTour = lazy(() => import("@/pages/PublicVirtualTour"));
const EmbeddedVirtualTour = lazy(() => import("@/pages/EmbeddedVirtualTour"));
const PublicClientVirtualTour = lazy(() => import("@/pages/PublicClientVirtualTour"));

const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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

        {/* Public Virtual Tour Routes */}
        <Route path="/tour/:id" component={PublicVirtualTour} />
        <Route path="/embed/tour/:id" component={EmbeddedVirtualTour} />
        <Route path="/client-tour/:token" component={PublicClientVirtualTour} />
        <Route path="/embed/client-tour/:token" component={PublicClientVirtualTour} />

        {/* Client-only Virtual Tour Admin Routes */}
        <Route path="/admin/client-tours" component={AdminClientTours} />
        <Route path="/admin/client-tours/:id/virtual-tour" component={AdminVirtualTour} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;