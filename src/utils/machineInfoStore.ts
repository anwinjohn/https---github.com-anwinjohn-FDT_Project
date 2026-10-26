export const MACHINE_INFO_STORAGE_KEY = 'localMachineInfo';

export interface LocalMachineInfo {
  uniqueId: string | null;
  systemName: string | null;
  loggedInUser: string | null;
  clientMacAddress: string | null;
  clientIpAddress: string | null;
}

let currentMachineInfo: LocalMachineInfo | null = null;

export const getLocalMachineInfo = (): LocalMachineInfo | null => {
  if (currentMachineInfo) return currentMachineInfo;
  try {
    const cached = localStorage.getItem(MACHINE_INFO_STORAGE_KEY);
    currentMachineInfo = cached ? (JSON.parse(cached) as LocalMachineInfo) : null;
  } catch {
    currentMachineInfo = null;
  }
  return currentMachineInfo;
};

export const setLocalMachineInfo = (machineInfo: LocalMachineInfo | null): void => {
  currentMachineInfo = machineInfo;
  try {
    if (machineInfo) {
      localStorage.setItem(MACHINE_INFO_STORAGE_KEY, JSON.stringify(machineInfo));
    } else {
      localStorage.removeItem(MACHINE_INFO_STORAGE_KEY);
    }
  } catch {
    // Keep the in-memory value usable when browser storage is unavailable.
  }
};
