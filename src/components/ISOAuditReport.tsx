import React from 'react';
import type { UserProfile } from '../contexts/AuthContext';

export type ProjectKPI = {
  id: string;
  name: string;
  status: string;
  category: string;
  avgScore: number;    // 0-5
  scorePercent: number; // 0-100
  evalCount: number;
  progress: number;
};

interface ISOAuditReportProps {
  kpiData: ProjectKPI[];
  overallAvg: number;
  userProfile: UserProfile | null;
}

export const ISOAuditReport = React.forwardRef<HTMLDivElement, ISOAuditReportProps>(
  ({ kpiData, overallAvg, userProfile }, ref) => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    
    // ISO Target is > 85%
    const isPassing = overallAvg > 85;
    const evaluatedKpis = kpiData.filter(k => k.evalCount > 0);

    return (
      <div 
        ref={ref} 
        className="p-12 font-body"
        style={{ width: '800px', minHeight: '1131px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#2c3437' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 pb-6 mb-8" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h1 className="text-3xl font-extrabold mb-2 uppercase tracking-wide" style={{ color: '#27619d' }}>
              Project KPI Audit Report
            </h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>CMG IT Management System</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Date of Report:</p>
            <p className="mb-2">{today}</p>
            <p className="font-bold">Auditor:</p>
            <p>{userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'System Administrator'}</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-10">
          <h2 className="text-xl font-bold border-l-4 pl-3 mb-6" style={{ borderColor: '#27619d' }}>Executive Summary</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="p-6 rounded-xl border flex flex-col justify-center items-center" style={{ backgroundColor: '#f9fafb', borderColor: '#f3f4f6' }}>
              <p className="text-sm uppercase tracking-widest font-bold mb-2" style={{ color: '#6b7280' }}>Overall KPI Average</p>
              <div className="flex items-end gap-2">
                <span className="text-6xl font-extrabold" style={{ color: isPassing ? '#059669' : '#e11d48' }}>
                  {overallAvg}%
                </span>
              </div>
              <p className="mt-4 text-sm font-medium">
                Target: <span className="font-bold">&gt; 85%</span>
              </p>
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="p-4 rounded-lg border" style={{ backgroundColor: isPassing ? '#ecfdf5' : '#fff1f2', borderColor: isPassing ? '#a7f3d0' : '#fecdd3' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-2xl" style={{ color: isPassing ? '#059669' : '#e11d48' }}>
                    {isPassing ? 'check_circle' : 'warning'}
                  </span>
                  <h3 className="font-bold text-lg" style={{ color: isPassing ? '#065f46' : '#9f1239' }}>
                    {isPassing ? 'Target Achieved' : 'Needs Improvement'}
                  </h3>
                </div>
                <p className="text-sm" style={{ color: isPassing ? '#047857' : '#be123c' }}>
                  {isPassing 
                    ? 'The overall project satisfaction score meets the ISO requirement of greater than 85%.' 
                    : 'The overall project satisfaction score falls below the ISO requirement of 85%. Corrective action is recommended.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        <div>
          <h2 className="text-xl font-bold border-l-4 pl-3 mb-6" style={{ borderColor: '#27619d' }}>Project Breakdown</h2>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y" style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }}>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#4b5563' }}>Project Name</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#4b5563' }}>Category</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider w-1/3" style={{ color: '#4b5563' }}>Score Graph</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-right" style={{ color: '#4b5563' }}>Score</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#e5e7eb' }}>
              {evaluatedKpis.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center" style={{ color: '#6b7280' }}>No evaluated projects found.</td>
                </tr>
              ) : (
                evaluatedKpis.map(kpi => {
                  const pct = kpi.scorePercent;
                  const isPass = pct > 85;
                  
                  return (
                    <tr key={kpi.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td className="py-4 px-4">
                        <div className="font-bold" style={{ color: '#1f2937' }}>{kpi.name}</div>
                        <div className="text-xs" style={{ color: '#6b7280' }}>Evaluations: {kpi.evalCount}</div>
                      </td>
                      <td className="py-4 px-4 text-sm" style={{ color: '#4b5563' }}>{kpi.category}</td>
                      <td className="py-4 px-4">
                        <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                          <div 
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: isPass ? '#10b981' : '#f43f5e' }}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-extrabold" style={{ color: isPass ? '#059669' : '#e11d48' }}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          <div className="mt-8 pt-4 border-t text-xs text-center" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
            Report generated automatically by CMG IT Management System. End of report.
          </div>
        </div>
      </div>
    );
  }
);

ISOAuditReport.displayName = 'ISOAuditReport';
