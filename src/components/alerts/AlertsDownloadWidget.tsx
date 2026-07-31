import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  CheckCircle2,
  Loader2,
  Lock,
  X,
} from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import type { AlertExportFormat } from '../../utils/alertsCsvExport';

export type ExportFormat = AlertExportFormat;

interface FormatOption {
  id: ExportFormat;
  label: string;
  extension: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'csv',
    label: 'CSV',
    extension: '.csv',
    description: 'Opens in Excel, Sheets, or any spreadsheet tool',
    icon: FileSpreadsheet,
    enabled: true,
  },
  {
    id: 'xlsx',
    label: 'Excel',
    extension: '.xlsx',
    description: 'Native Excel format with formatting',
    icon: FileSpreadsheet,
    enabled: true,
  },
  {
    id: 'pdf',
    label: 'PDF',
    extension: '.pdf',
    description: 'Print-ready summary document',
    icon: FileText,
    enabled: true,
  },
  {
    id: 'json',
    label: 'JSON',
    extension: '.json',
    description: 'Raw data for integrations',
    icon: FileJson,
    enabled: true,
  },
];

// Fallback labels while an export request is being established. The exporter
// supplies these stages with real progress once it starts fetching records.
const PROGRESS_STAGES = [
  { upTo: 30, label: 'Gathering matching alerts…' },
  { upTo: 65, label: 'Formatting rows…' },
  { upTo: 90, label: 'Compiling file…' },
  { upTo: 99, label: 'Almost ready…' },
];

interface AlertsDownloadWidgetProps {
  theme: 'light' | 'dark';
  totalCount: number;
  exporting: boolean;
  exportProgress?: number;
  exportStage?: string;
  canExport: boolean;
  onExport: (format: ExportFormat) => void;
  onDeniedAttempt?: () => void;
}

const AlertsDownloadWidget: React.FC<AlertsDownloadWidgetProps> = ({
  theme,
  totalCount,
  exporting,
  exportProgress,
  exportStage,
  canExport,
  onExport,
  onDeniedAttempt,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [progress, setProgress] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasExporting = useRef(false);

  const isDark = theme === 'dark';

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Use real export progress when supplied; retain a gentle fallback animation
  // while the first request is being established.
  useEffect(() => {
    if (exporting) {
      wasExporting.current = true;
      setJustCompleted(false);
      setProgress(exportProgress ?? 4);
      if (exportProgress !== undefined) return;
      const interval = setInterval(() => {
        setProgress((prev) => {
          const stage = PROGRESS_STAGES.find((s) => prev < s.upTo);
          const ceiling = stage ? stage.upTo : 99;
          if (prev >= ceiling) return prev;
          const step = Math.max(1, (ceiling - prev) * 0.12);
          return Math.min(ceiling, prev + step);
        });
      }, 220);
      return () => clearInterval(interval);
    }

    if (wasExporting.current) {
      // Export just finished (success or failure) — snap to 100 and show a checkmark briefly
      wasExporting.current = false;
      setProgress(100);
      setJustCompleted(true);
      const timeout = setTimeout(() => {
        setJustCompleted(false);
        setProgress(0);
        setIsOpen(false);
      }, 1100);
      return () => clearTimeout(timeout);
    }
  }, [exporting, exportProgress]);

  const currentStageLabel =
    exportStage ?? PROGRESS_STAGES.find((s) => progress < s.upTo)?.label ?? 'Finalizing file…';

  const handleTriggerClick = () => {
    if (!canExport) {
      onDeniedAttempt?.();
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleDownloadClick = () => {
    if (exporting) return;
    onExport(selectedFormat);
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileHover={{ scale: canExport ? 1.05 : 1 }}
        whileTap={{ scale: canExport ? 0.95 : 1 }}
        onClick={handleTriggerClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors border ${
          !canExport
            ? isDark
              ? 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed'
              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
            : isDark
              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30'
              : 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300'
        }`}
      >
        {!canExport ? (
          <Lock className="w-4 h-4" />
        ) : exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {exporting ? 'Exporting…' : 'Download'}
      </motion.button>

      <AnimatePresence>
        {isOpen && canExport && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden ${
              isDark
                ? 'bg-[#151b2c] border-white/10'
                : 'bg-white border-gray-200'
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-white/10' : 'border-gray-100'
              }`}
            >
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Download alerts
                </p>
                <p
                  className={`text-xs ${
                    isDark ? 'text-white/50' : 'text-gray-500'
                  }`}
                >
                  {formatNumber(totalCount)} alert
                  {totalCount === 1 ? '' : 's'} match your current filters
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded-lg ${
                  isDark
                    ? 'text-white/40 hover:text-white hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3">
              {exporting || justCompleted ? (
                <div className="px-2 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    {justCompleted ? (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="p-1.5 rounded-full bg-green-500/20"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </motion.div>
                    ) : (
                      <Loader2
                        className={`w-5 h-5 animate-spin ${
                          isDark ? 'text-green-300' : 'text-green-600'
                        }`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {justCompleted ? 'File ready' : currentStageLabel}
                      </p>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-white/40' : 'text-gray-500'
                        }`}
                      >
                        {justCompleted
                          ? 'Check your downloads folder'
                          : 'Large lists can take a moment'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`h-2 rounded-full overflow-hidden ${
                      isDark ? 'bg-white/10' : 'bg-gray-100'
                    }`}
                  >
                    <motion.div
                      className={`h-full rounded-full ${
                        justCompleted
                          ? 'bg-green-500'
                          : 'bg-gradient-to-r from-green-500 to-emerald-400'
                      }`}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.25 }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {FORMAT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = selectedFormat === option.id;
                      return (
                        <button
                          key={option.id}
                          disabled={!option.enabled}
                          onClick={() =>
                            option.enabled && setSelectedFormat(option.id)
                          }
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                            !option.enabled
                              ? isDark
                                ? 'border-transparent opacity-40 cursor-not-allowed'
                                : 'border-transparent opacity-50 cursor-not-allowed'
                              : selected
                                ? isDark
                                  ? 'border-green-500/40 bg-green-500/10'
                                  : 'border-green-300 bg-green-50'
                                : isDark
                                  ? 'border-white/10 hover:bg-white/5'
                                  : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg ${
                              isDark ? 'bg-white/10' : 'bg-gray-100'
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 ${
                                isDark ? 'text-white/70' : 'text-gray-600'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isDark ? 'text-white' : 'text-gray-900'
                                }`}
                              >
                                {option.label}
                              </span>
                              <span
                                className={`text-xs ${
                                  isDark ? 'text-white/40' : 'text-gray-400'
                                }`}
                              >
                                {option.extension}
                              </span>
                              {!option.enabled && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    isDark
                                      ? 'bg-white/10 text-white/50'
                                      : 'bg-gray-200 text-gray-500'
                                  }`}
                                >
                                  Coming soon
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-xs truncate ${
                                isDark ? 'text-white/40' : 'text-gray-500'
                              }`}
                            >
                              {option.description}
                            </p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              selected
                                ? 'border-green-400'
                                : isDark
                                  ? 'border-white/20'
                                  : 'border-gray-300'
                            }`}
                          >
                            {selected && (
                              <div className="w-2 h-2 rounded-full bg-green-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDownloadClick}
                    disabled={totalCount === 0}
                    className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      totalCount === 0
                        ? isDark
                          ? 'bg-white/5 text-white/30 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Download {formatNumber(totalCount)} alert
                    {totalCount === 1 ? '' : 's'}
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AlertsDownloadWidget;
