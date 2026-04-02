import { sysLog } from "../types/sysLog";
import { useState, useCallback, useRef } from 'react';
import apiClient from '../utils/apiClient';


interface UseSysLogApiProps {
    autoFlush?: boolean;
    flushInterval?: number;
    maxBufferSize?: number;
}

interface LogBufferItem {
    log: sysLog;
    timestamp: number;
}

export const useSysLogApi = (props?: UseSysLogApiProps) => {

    const {
        autoFlush = false,
        flushInterval = 30000, // 30 seconds
        maxBufferSize = 50,
    } = props || {};

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logBuffer = useRef<LogBufferItem[]>([]);
    const flushTimer = useRef<NodeJS.Timeout | null>(null);

    const log = useCallback(async (logData: Partial<sysLog>): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            // Fill in default values if not provided
            const completeLog: sysLog = {
                action: logData.action || 'UNKNOWN_ACTION',
                user_id: logData.user_id || null,
                username: logData.username || null,
                details: logData.details || '',
                module: logData.module || 'UNKNOWN_MODULE',
                level: logData.level || 'INFO',
                critical: logData.critical || false,
                ip_address: logData.ip_address || null,
                user_agent: logData.user_agent || null,
                duration_ms: logData.duration_ms || null,
                status_code: logData.status_code || null,
                reference_id: logData.reference_id || null,
                metadata: logData.metadata || null,
            };

            const response = await apiClient.post('/api/logs/syslog', completeLog);
            return response.status === 201 || response.status === 200;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);

            // Buffer the failed log for retry
            if (logData.action) {
                bufferLog(logData as sysLog);
            }

            console.error('SysLog API error:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Helper methods for different log levels
    const debug = useCallback((data: Partial<sysLog>) =>
        log({ ...data, level: 'DEBUG' }), [log]);

    const info = useCallback((data: Partial<sysLog>) =>
        log({ ...data, level: 'INFO' }), [log]);

    const warn = useCallback((data: Partial<sysLog>) =>
        log({ ...data, level: 'WARN' }), [log]);

    const errorLog = useCallback((data: Partial<sysLog>) =>
        log({ ...data, level: 'ERROR' }), [log]);

    const fatal = useCallback((data: Partial<sysLog>) =>
        log({ ...data, level: 'FATAL', critical: true }), [log]);

    // Buffer logs for batch sending
    const bufferLog = useCallback((logData: sysLog) => {
        logBuffer.current.push({
            log: logData,
            timestamp: Date.now(),
        });

        // Remove old logs if buffer exceeds max size
        if (logBuffer.current.length > maxBufferSize) {
            logBuffer.current.shift();
        }

        // Auto flush if enabled and buffer has items
        if (autoFlush && logBuffer.current.length > 0) {
            if (!flushTimer.current) {
                flushTimer.current = setTimeout(flushBufferedLogs, flushInterval);
            }
        }
    }, [autoFlush, flushInterval, maxBufferSize]);

    // Flush buffered logs
    const flushBufferedLogs = useCallback(async () => {
        if (logBuffer.current.length === 0) {
            if (flushTimer.current) {
                clearTimeout(flushTimer.current);
                flushTimer.current = null;
            }
            return;
        }

        const logsToSend = [...logBuffer.current];
        logBuffer.current = [];

        try {
            setIsLoading(true);
            const response = await apiClient.post('/api/logs/syslog/batch', {
                logs: logsToSend.map(item => item.log),
            });

            if (response.status !== 200 && response.status !== 201) {
                // Re-buffer failed logs
                logsToSend.forEach(item => bufferLog(item.log));
            }
        } catch (err) {
            // Re-buffer failed logs
            logsToSend.forEach(item => bufferLog(item.log));
            console.error('Failed to flush buffered logs:', err);
        } finally {
            setIsLoading(false);

            // Reset timer if there are still buffered logs
            if (logBuffer.current.length > 0 && autoFlush) {
                flushTimer.current = setTimeout(flushBufferedLogs, flushInterval);
            } else {
                flushTimer.current = null;
            }
        }
    }, [autoFlush, flushInterval, bufferLog]);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        if (flushTimer.current) {
            clearTimeout(flushTimer.current);
            flushTimer.current = null;
        }

        // Try to flush remaining logs before cleanup
        if (logBuffer.current.length > 0) {
            flushBufferedLogs();
        }
    }, [flushBufferedLogs]);

    return {
        // Main log function
        log,

        // Level-specific functions
        debug,
        info,
        warn,
        error: errorLog,
        fatal,

        // Buffer management
        bufferLog,
        flushBufferedLogs,
        getBufferedCount: () => logBuffer.current.length,

        // State
        isLoading,
        error,

        // Cleanup
        cleanup,
    };

};