import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchLocalMachineInfo } from "../hooks/useLoginServices";

const LocalMachineContext = createContext(null);

export const LocalMachineProvider = ({ children }) => {
    const [machineInfo, setMachineInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [available, setAvailable] = useState(false);

    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const loadLocalInfo = async () => {
            const result = await fetchLocalMachineInfo();

            if (result.success) {
                setMachineInfo(result.data);
                setAvailable(true);

            } else {
                setAvailable(false);
            }

            setLoading(false);
        };

        loadLocalInfo();
    }, []);

    return (
        <LocalMachineContext.Provider
            value={{ machineInfo, loading, available }}
        >
            {children}
        </LocalMachineContext.Provider>
    );
};

export const useLocalMachine = () => useContext(LocalMachineContext);
