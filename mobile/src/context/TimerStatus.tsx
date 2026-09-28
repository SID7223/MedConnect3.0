import React, { createContext, useContext, useMemo, useState } from 'react';

// Whether the study timer is currently running (port of the web Timer context's
// running flag, used only for the live dot on the Focus tab). StudyTimer is the
// single source of truth and publishes its state here.

interface TimerStatusValue {
  running: boolean;
  setRunning: (v: boolean) => void;
}

const TimerStatusCtx = createContext<TimerStatusValue>({ running: false, setRunning: () => {} });

export function TimerStatusProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const value = useMemo(() => ({ running, setRunning }), [running]);
  return <TimerStatusCtx.Provider value={value}>{children}</TimerStatusCtx.Provider>;
}

export function useTimerStatus(): TimerStatusValue {
  return useContext(TimerStatusCtx);
}
