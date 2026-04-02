import React, { createContext, useContext, ReactNode } from 'react';
import { useSysLogApi } from '../hooks/useSysLogApi';

interface SysLogContextType {
  log: (data: Partial<sysLog>) => Promise<boolean>;
  debug: (data: Partial<sysLog>) => Promise<boolean>;
  info: (data: Partial<sysLog>) => Promise<boolean>;
  warn: (data: Partial<sysLog>) => Promise<boolean>;
  error: (data: Partial<sysLog>) => Promise<boolean>;
  fatal: (data: Partial<sysLog>) => Promise<boolean>;
  flushBufferedLogs: () => Promise<void>;
  getBufferedCount: () => number;
  isLoading: boolean;
  error: string | null;
}

const SysLogContext = createContext<SysLogContextType | undefined>(undefined);

interface SysLogProviderProps {
  children: ReactNode;
  autoFlush?: boolean;
  flushInterval?: number;
  maxBufferSize?: number;
}

export const SysLogProvider: React.FC<SysLogProviderProps> = ({
  children,
  autoFlush = true,
  flushInterval = 30000,
  maxBufferSize = 50,
}) => {
  const sysLogApi = useSysLogApi({
    autoFlush,
    flushInterval,
    maxBufferSize,
  });

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      sysLogApi.cleanup();
    };
  }, [sysLogApi]);

  return (
    <SysLogContext.Provider value={sysLogApi}>
      {children}
    </SysLogContext.Provider>
  );
};

export const useSysLog = (): SysLogContextType => {
  const context = useContext(SysLogContext);
  if (context === undefined) {
    throw new Error('useSysLog must be used within a SysLogProvider');
  }
  return context;
};