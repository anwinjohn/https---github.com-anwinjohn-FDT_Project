import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import ReportBuilder from './reports/ReportBuilder';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchReportSources,
  generateReportFile,
  reportTemplateStore,
} from '../services/reportBuilderService';
import type {
  ReportSource,
  ReportTemplateStore,
} from './reports/ReportBuilder';

const ReportsPage: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [sources, setSources] = useState<ReportSource[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReportSources()
      .then((s) => !cancelled && setSources(s))
      .catch(
        () =>
          !cancelled &&
          setLoadError(
            'Could not load the report data sources. Please try again later.'
          )
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div
        className={`rounded-2xl border p-8 min-h-[400px] flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-white/5 border-white/10'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p
            className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}
          >
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (!sources) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p
            className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}
          >
            Loading report designer…
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReportBuilder
      sources={sources}
      templateStore={reportTemplateStore as ReportTemplateStore}
      onGenerate={generateReportFile}
      currentUser={user?.username || 'Current user'}
      theme={theme}
      canViewSensitive={user?.canViewSensitive || false}
    />
  );
};

export default ReportsPage;