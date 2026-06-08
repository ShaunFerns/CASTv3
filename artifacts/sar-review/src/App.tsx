import { useEffect, type ComponentType, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { CalibrationProvider } from "@/lib/calibration";
import { AuthProvider, useAuth } from "@/lib/auth";
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
import UploadCurriculum from "@/pages/ingestion";
import ProgrammeWorkspace from "@/pages/programme-workspace";
import ProgrammeMapPage from "@/pages/programme-map";
import FrameworkHub from "@/pages/framework-hub";
import ModuleBuilder from "@/pages/module-builder";
import ModuleLibrary from "@/pages/module-library";
import ReviewEnhancement from "@/pages/review-enhancement";
import DataQuality from "@/pages/data-quality";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md rounded border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Checking CAST v3 access...</div>
        <p className="mt-2 text-sm text-slate-500">Please wait while CAST verifies your session.</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md rounded border border-blue-100 bg-white p-6 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Sign in required</div>
        <p className="mt-2 text-sm text-slate-600">
          Upload Curriculum and programme workspace tools are available after CAST v3 login.
        </p>
        <Link
          href="/admin/login"
          className="mt-4 inline-flex rounded bg-blue-950 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
        >
          Log in to CAST
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

function protectedPage(Component: ComponentType) {
  return function ProtectedPage() {
    return (
      <ProtectedRoute>
        <Component />
      </ProtectedRoute>
    );
  };
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sar" component={Sar} />
        <Route path="/dashboard" component={protectedPage(Dashboard)} />
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
        <Route path="/programme/map" component={protectedPage(ProgrammeMapPage)} />
        <Route path="/programme/workspace" component={protectedPage(ProgrammeWorkspace)} />
        <Route path="/programme" component={Programme} />
        <Route path="/frameworks/:frameworkKey" component={FrameworkHub} />
        <Route path="/frameworks" component={FrameworkHub} />
        <Route path="/module-library" component={protectedPage(ModuleLibrary)} />
        <Route path="/module-builder" component={protectedPage(ModuleBuilder)} />
        <Route path="/review-enhancement" component={protectedPage(ReviewEnhancement)} />
        <Route path="/data-quality" component={protectedPage(DataQuality)} />
        <Route path="/assessment" component={Assessment} />
        <Route path="/modality" component={Modality} />
        <Route path="/ingestion" component={protectedPage(UploadCurriculum)} />
        <Route path="/upload-curriculum" component={protectedPage(UploadCurriculum)} />
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
