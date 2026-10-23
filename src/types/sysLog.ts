export interface sysLog {
    action: string;
    user_id: string | null;
    username: string | null;
    details: string;
    module: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    critical: boolean;
    ip_address: string | null;
    user_agent: string | null;
    duration_ms: number | null;
    status_code: string | null;
    reference_id: string | null;
    metadata: string | null;
}