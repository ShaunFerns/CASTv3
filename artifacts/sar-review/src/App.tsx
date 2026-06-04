import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { CalibrationProvider } from "@/lib/calibration";
import { AuthProvider } from "@/lib/auth";
import Home from "@/pages/home";
import Sar from "@/pages/sar";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Review from "@/pages/review";
import Extract from "@/pages/extract";
import Summary from "@/pages/summary";
import SarAnalytics from "@/pages/sar-analytics";
import FreeElectives from "@/pages/free-electives";
import About from "@/pages/about";
import Structure from "@/pages/structure";
import Programme from "@/pages/programme";
import ProgrammeImport from "@/pages/programme-import";
import GaDashboard from "@/pages/ga-dashboard";
import GreenCompDashboard from "@/pages/greencomp-dashboard";
import DigCompDashboard from "@/pages/digcomp-dashboard";
import EntreCompDashboard from "@/pages/entrecomp-dashboard";
import ModuleCatalogue from "@/pages/module-catalogue";
import Assessment from "@/pages/assessment";
import Modality from "@/pages/modality";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

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
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sar" component={Sar} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/upload" component={Upload} />
        <Route path="/modules/:id/extract" component={Extract} />
        <Route path="/modules/:id" component={Review} />
        <Route path="/summary" component={Summary} />
        <Route path="/sar-analytics" component={SarAnalytics} />
        <Route path="/free-electives" component={FreeElectives} />
        <Route path="/about" component={About} />
        <Route path="/structure" component={Structure} />
        <Route path="/programme/catalogue" component={ModuleCatalogue} />
        <Route path="/programme/ga" component={GaDashboard} />
        <Route path="/programme/greencomp" component={GreenCompDashboard} />
        <Route path="/programme/digcomp" component={DigCompDashboard} />
        <Route path="/programme/entrecomp" component={EntreCompDashboard} />
        <Route path="/programme/import" component={ProgrammeImport} />
        <Route path="/programme" component={Programme} />
        <Route path="/assessment" component={Assessment} />
        <Route path="/modality" component={Modality} />
        <Route path="/admin/login" component={Login} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CalibrationProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CalibrationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
