import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { fetchLocalMachineInfo } from '../hooks/useLoginServices';
import {
  getLocalMachineInfo,
  setLocalMachineInfo,
  type LocalMachineInfo,
} from '../utils/machineInfoStore';

export type { LocalMachineInfo } from '../utils/machineInfoStore';

interface LocalMachineContextValue {
  machineInfo: LocalMachineInfo | null;
  loading: boolean;
  available: boolean;
  refreshMachineInfo: () => Promise<LocalMachineInfo | null>;
}

const LocalMachineContext = createContext<LocalMachineContextValue | undefined>(undefined);

export const LocalMachineProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [machineInfo, setMachineInfo] = useState<LocalMachineInfo | null>(getLocalMachineInfo);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(Boolean(getLocalMachineInfo()));

  const refreshMachineInfo = useCallback(async (): Promise<LocalMachineInfo | null> => {
    setLoading(true);
    try {
      const result = await fetchLocalMachineInfo();
      if (result.success && result.data) {
        const freshInfo = result.data as LocalMachineInfo;
        setMachineInfo(freshInfo);
        setAvailable(true);
        setLocalMachineInfo(freshInfo);
        return freshInfo;
      }

      // A temporarily unavailable local agent should not erase the last known device.
      const cachedInfo = getLocalMachineInfo();
      setMachineInfo(cachedInfo);
      setAvailable(Boolean(cachedInfo));
      return cachedInfo;
    } catch {
      const cachedInfo = getLocalMachineInfo();
      setMachineInfo(cachedInfo);
      setAvailable(Boolean(cachedInfo));
      return cachedInfo;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMachineInfo();
  }, [refreshMachineInfo]);

  return (
    <LocalMachineContext.Provider value={{ machineInfo, loading, available, refreshMachineInfo }}>
      {children}
    </LocalMachineContext.Provider>
  );
};

export const useLocalMachine = (): LocalMachineContextValue => {
  const context = useContext(LocalMachineContext);
  if (!context) {
    throw new Error('useLocalMachine must be used within LocalMachineProvider');
  }
  return context;
};
