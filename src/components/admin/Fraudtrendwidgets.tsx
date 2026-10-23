import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Layers, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { FraudVolume, ViolationType } from '../../types/types';

const ACCENT = '#3B82F6';
const DANGER = '#E5484D';
const WARNING = '#F59E0B';

interface FraudVolumeOverTimeCardProps {
  data: FraudVolume[];
  isLoading: boolean;
}

interface FraudCategoryMixCardProps {
  data: ViolationType[];
  isLoading: boolean;
}

const CardShell: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  dark: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, dark, children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className={`rounded-2xl border p-5 backdrop-blur-xl shadow-lg ${className || ''} ${
      dark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200/70'
    }`}
  >
    <div className="flex items-center gap-2.5 mb-4">
      <div
        className={`p-1.5 rounded-lg ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}
      >
        {icon}
      </div>
      <div>
        <h3
          className={`text-[14px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}
        >
          {title}
        </h3>
        <p
          className={`text-[11px] ${dark ? 'text-white/45' : 'text-slate-500'}`}
        >
          {subtitle}
        </p>
      </div>
    </div>
    {children}
  </motion.div>
);

const Skeleton: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div
    className={`animate-pulse rounded-xl h-[190px] ${dark ? 'bg-white/5' : 'bg-slate-100'}`}
  />
);

const EmptyState: React.FC<{ dark: boolean; message: string }> = ({
  dark,
  message,
}) => (
  <div
    className={`flex h-[190px] items-center justify-center rounded-xl text-sm ${
      dark ? 'bg-white/5 text-white/45' : 'bg-slate-50 text-slate-500'
    }`}
  >
    {message}
  </div>
);

export const FraudVolumeOverTimeCard: React.FC<
  FraudVolumeOverTimeCardProps
> = ({ data, isLoading }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: new Date(p.period || p.generatedAt).toLocaleDateString(
          undefined,
          {
            month: 'short',
            day: 'numeric',
          }
        ),
        pendingAlerts: p.pendingAlerts ?? p.pendingCount ?? 0,
      })),
    [data]
  );

  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const axisColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.45)';

  return (
    <CardShell
      title="Fraud Volume Over Time"
      subtitle="Alerts raised, confirmed fraud, and pending alerts"
      icon={<TrendingUp className="w-4 h-4" />}
      dark={dark}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          <div className="text-center">
            <div
              className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Loading alerts...
            </div>
            <div
              className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Analyzing alerts patterns
            </div>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <EmptyState
          dark={dark}
          message="No fraud volume data for this period."
        />
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="dashAlertsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
              <linearGradient
                id="dashConfirmedGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={DANGER} stopOpacity={0.25} />
                <stop offset="100%" stopColor={DANGER} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dashPendingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WARNING} stopOpacity={0.25} />
                <stop offset="100%" stopColor={WARNING} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: dark ? '#0f172a' : '#ffffff',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="alertsRaised"
              name="Alerts Raised"
              stroke={ACCENT}
              fill="url(#dashAlertsGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="confirmedFraud"
              name="Confirmed Fraud"
              stroke={DANGER}
              fill="url(#dashConfirmedGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="pendingAlerts"
              name="Pending Alerts"
              stroke={WARNING}
              fill="url(#dashPendingGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </CardShell>
  );
};

export const FraudCategoryMixCard: React.FC<FraudCategoryMixCardProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <CardShell
      title="Fraud Category Mix"
      subtitle="Share of confirmed cases"
      icon={<Layers className="w-4 h-4" />}
      dark={dark}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          <div className="text-center">
            <div
              className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Loading alerts...
            </div>
            <div
              className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Analyzing alerts patterns
            </div>
          </div>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          dark={dark}
          message="No fraud categories for this period."
        />
      ) : (
        <div className="space-y-2.5">
          {data.map((c, i) => (
            <div key={c.category}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className={dark ? 'text-white/70' : 'text-slate-600'}>
                  {c.category}
                </span>
                <span className={dark ? 'text-white/50' : 'text-slate-400'}>
                  {c.percentOfTotal}%
                </span>
              </div>
              <div
                className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-slate-100'}`}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.percentOfTotal}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ background: ACCENT, opacity: 1 - i * 0.1 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
};
