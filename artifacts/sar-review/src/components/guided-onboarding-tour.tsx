import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

type TourStep = {
  title: string;
  description: string;
  route: string;
  selector: string;
};

const tourSteps: TourStep[] = [
  {
    title: "Upload Curriculum",
    description: "Start by uploading module descriptors, completing a module manually, or adding programme spreadsheet data.",
    route: "/ingestion",
    selector: '[data-tour="nav-upload-curriculum"]',
  },
  {
    title: "Programme Workspace",
    description: "Create and curate programme versions from uploaded source data before review and mapping.",
    route: "/programme/workspace",
    selector: '[data-tour="nav-programme-workspace"]',
  },
  {
    title: "Programme Maps",
    description: "Explore programme structures as a base map with evidence-informed curriculum layers overlaid.",
    route: "/programme/map",
    selector: '[data-tour="nav-programme-map"]',
  },
  {
    title: "Module Library",
    description: "Browse, search and open uploaded modules without needing to build a full programme workspace first.",
    route: "/module-library",
    selector: '[data-tour="nav-module-library"]',
  },
  {
    title: "Module Builder",
    description: "Inspect descriptor evidence, outcomes, assessments, improvement prompts and evidence claims for a module.",
    route: "/module-builder",
    selector: '[data-tour="nav-module-builder"]',
  },
  {
    title: "Review Cycles",
    description: "Create structured review activities for programme review, validation, accreditation or DELTA-style readiness.",
    route: "/programme/workspace",
    selector: '[data-tour="tab-review-cycles"]',
  },
  {
    title: "Readiness",
    description: "View evidence-informed readiness indicators that support review-team judgement without replacing it.",
    route: "/programme/workspace",
    selector: '[data-tour="tab-readiness"]',
  },
  {
    title: "SWOT",
    description: "Capture strengths, weaknesses, opportunities and threats from findings, readiness observations and review discussion.",
    route: "/programme/workspace",
    selector: '[data-tour="tab-swot"]',
  },
  {
    title: "Action Planning",
    description: "Turn reviewed findings, SWOT items and readiness gaps into traceable programme enhancement actions.",
    route: "/programme/workspace",
    selector: '[data-tour="tab-actions"]',
  },
];

type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

async function saveTourCompletion(completed: boolean) {
  const response = await fetch("/api/security/onboarding-tour", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) throw new Error("Could not save onboarding state");
}

export function GuidedOnboardingTour() {
  const { isAuthenticated, isLoading, onboarding, userId, refreshContext } = useAuth();
  const [location, setLocation] = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<HighlightBox | null>(null);
  const autoStartedForUser = useRef<string | null>(null);

  const step = tourSteps[stepIndex];
  const progress = useMemo(() => `${stepIndex + 1} of ${tourSteps.length}`, [stepIndex]);

  useEffect(() => {
    const startTour = () => {
      setStepIndex(0);
      setActive(true);
    };
    window.addEventListener("cast:start-onboarding-tour", startTour);
    return () => window.removeEventListener("cast:start-onboarding-tour", startTour);
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId) return;
    if (onboarding?.guidedTourCompleted === true) return;
    if (autoStartedForUser.current === userId) return;
    autoStartedForUser.current = userId;
    setStepIndex(0);
    setActive(true);
  }, [isAuthenticated, isLoading, onboarding?.guidedTourCompleted, userId]);

  useEffect(() => {
    if (!active || !step) return;
    if (location !== step.route) {
      setLocation(step.route);
    }
  }, [active, location, setLocation, step]);

  useEffect(() => {
    if (!active || !step) return;

    let cancelled = false;
    const updateHighlight = () => {
      const element = document.querySelector(step.selector);
      if (!element) {
        setHighlight(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setHighlight({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    };

    const timer = window.setTimeout(() => {
      if (!cancelled) updateHighlight();
    }, 150);

    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [active, location, step]);

  async function finishTour() {
    setActive(false);
    setHighlight(null);
    await saveTourCompletion(true).catch(() => undefined);
    await refreshContext().catch(() => undefined);
  }

  function previousStep() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  async function nextStep() {
    if (stepIndex >= tourSteps.length - 1) {
      await finishTour();
      return;
    }
    setStepIndex((current) => current + 1);
  }

  if (!active || !step) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/50" />
      {highlight && (
        <div
          className="absolute rounded-lg border-2 border-amber-300 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.52)] transition-all"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}
      <div className="pointer-events-auto absolute left-1/2 top-[18vh] w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">CAST guided tour</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{step.title}</h2>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Skip guided tour"
            onClick={() => void finishTour()}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
        {!highlight && (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            CAST has opened the relevant workspace. The highlighted control may appear once the page finishes loading.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-slate-500">{progress}</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void finishTour()}>Skip</Button>
            <Button variant="outline" onClick={previousStep} disabled={stepIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button className="bg-blue-950 hover:bg-blue-900" onClick={() => void nextStep()}>
              {stepIndex === tourSteps.length - 1 ? "Finish" : "Next"}
              {stepIndex < tourSteps.length - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
