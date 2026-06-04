import { createContext, useContext, useState } from "react";

export type CalibrationMode = "conservative" | "balanced" | "generous";

export const CALIBRATION_OPTIONS: { value: CalibrationMode; label: string; uplift: number; desc: string }[] = [
  { value: "conservative", label: "Conservative", uplift: 0.0, desc: "No adjustment" },
  { value: "balanced",     label: "Balanced",     uplift: 0.5, desc: "Small uplift"  },
  { value: "generous",     label: "Generous",     uplift: 1.0, desc: "Larger uplift" },
];

const UPLIFT: Record<CalibrationMode, number> = {
  conservative: 0.0,
  balanced:     0.5,
  generous:     1.0,
};

const LS_KEY = "sarCalibration";

interface CalibrationCtx {
  mode: CalibrationMode;
  setMode: (m: CalibrationMode) => void;
  uplift: number;
}

const CalibrationContext = createContext<CalibrationCtx>({
  mode: "conservative",
  setMode: () => {},
  uplift: 0,
});

export function CalibrationProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<CalibrationMode>(() => {
    const stored = localStorage.getItem(LS_KEY) as CalibrationMode | null;
    return stored && stored in UPLIFT ? stored : "conservative";
  });

  const setMode = (m: CalibrationMode) => {
    localStorage.setItem(LS_KEY, m);
    setModeState(m);
  };

  return (
    <CalibrationContext.Provider value={{ mode, setMode, uplift: UPLIFT[mode] }}>
      {children}
    </CalibrationContext.Provider>
  );
}

export function useCalibration() {
  return useContext(CalibrationContext);
}

export function calcCalibratedBand(rawScore: number | null | undefined, uplift: number): string | null {
  if (rawScore == null) return null;
  const calibrated = Math.min(rawScore + uplift, 4);
  if (calibrated >= 3.0) return "Strong Fit";
  if (calibrated >= 2.5) return "Moderate Fit";
  return "Weak Fit";
}
