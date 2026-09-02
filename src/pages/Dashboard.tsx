import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ISOAuditReport } from '../components/ISOAuditReport';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Project = {
  id: string;
  name: string;
  status: string;
  progress: number;
  category: string;
};

type Evaluation = {
  projectId: string;
  ratings: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    q5: number;
  };
};

type ProjectKPI = {
  id: string;
  name: string;
  status: string;
  category: string;
  avgScore: number;    // 0-5
  scorePercent: number; // 0-100
  evalCount: number;
  progress: number;
};

type HistoryEntry = {
  assetId: string;
  equipment: string;
  user: string;
  status: string;
  date: string;
  action: string;
  detail: string;
};

type ITReviewRecord = {
  id: string;
  applicantName?: string;
  department?: string;
  rating?: number | string;
  reviewComment?: string;
  reviewDate?: string;
  requestDate?: string;
  reviewedAt?: Timestamp;
  createdAt?: Timestamp;
};

const assetStatusColor: Record<string, string> = {
  'Active': 'bg-secondary-container text-on-secondary-container',
  'Repair': 'bg-error-container text-error',
  'Retired': 'bg-surface-container-highest text-outline',
};

const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  return `${diffInDays} days ago`;
};

const statusColor: Record<string, { bg: string; text: string; dot: string }> = {
  'Completed':   { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'In Progress': { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  'Planning':    { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'On Hold':     { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400' },
};

const getScoreGradient = (pct: number) => {
  if (pct >= 80) return 'from-emerald-400 to-emerald-600';
  if (pct >= 60) return 'from-[#27619d] to-[#5190d6]';
  if (pct >= 40) return 'from-amber-400 to-amber-600';
  return 'from-rose-400 to-rose-600';
};

const getScoreLabel = (pct: number) => {
  if (pct >= 80) return { label: 'ดีเยี่ยม', color: 'text-emerald-600' };
  if (pct >= 60) return { label: 'ดี', color: 'text-[#27619d]' };
  if (pct >= 40) return { label: 'พอใช้', color: 'text-amber-600' };
  return { label: 'ต้องปรับปรุง', color: 'text-rose-600' };
};

const parseUnknownDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const getMonthKeyFromDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthKeyFromValue = (value: unknown) => {
  const parsedDate = parseUnknownDate(value);
  return parsedDate ? getMonthKeyFromDate(parsedDate) : '';
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey || '-';

  return new Date(year, month - 1, 1).toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  });
};

const formatReviewDate = (value: unknown) => {
  const parsedDate = parseUnknownDate(value);
  if (!parsedDate) return '-';

  return parsedDate.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getReviewMonthKey = (record: ITReviewRecord) =>
  getMonthKeyFromValue(record.reviewDate)
  || getMonthKeyFromValue(record.requestDate)
  || getMonthKeyFromValue(record.reviewedAt)
  || getMonthKeyFromValue(record.createdAt);

const getReviewTimestamp = (record: ITReviewRecord) =>
  parseUnknownDate(record.reviewDate)?.getTime()
  || parseUnknownDate(record.requestDate)?.getTime()
  || parseUnknownDate(record.reviewedAt)?.getTime()
  || parseUnknownDate(record.createdAt)?.getTime()
  || 0;

const getReviewRating = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value || 0);
  if (Number.isNaN(numericValue)) return 0;
  return Math.max(0, Math.min(5, numericValue));
};

// Animated bar component
const AnimatedBar = ({ percent, gradient }: { percent: number; gradient: string }) => {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setWidth(percent), 100);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [percent]);

  return (
    <div ref={ref} className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000 ease-out shadow-sm`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [kpiData, setKpiData] = useState<ProjectKPI[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<'all' | 'evaluated'>('evaluated');
  const [overallAvg, setOverallAvg] = useState(0);

  const [totalAssets, setTotalAssets] = useState(0);
  const [pendingRepairs, setPendingRepairs] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewRecords, setReviewRecords] = useState<ITReviewRecord[]>([]);
  const [selectedReviewMonth, setSelectedReviewMonth] = useState('');

  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const currentReviewMonthKey = getMonthKeyFromDate(new Date());

  const exportToPDF = async () => {
    if (!reportRef.current) {
      alert('Report reference not found!');
      return;
    }
    try {
      setIsExporting(true);
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2,
        useCORS: true,
        logging: true
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ISO_Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };


  useEffect(() => {
    loadKpiData();
    loadDashboardStats();
    loadReviewData();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const [assetsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets')),
        getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'users')),
      ]);

      setTotalAssets(assetsSnap.size);
      
      let repairs = 0;
      let allHistory: HistoryEntry[] = [];
      assetsSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Repair') {
          repairs++;
        }
        if (data.history && Array.isArray(data.history)) {
          data.history.forEach((h: any) => {
            allHistory.push({
              assetId: doc.id,
              equipment: data.name || 'Unknown',
              user: data.user || 'Unassigned',
              status: data.status || 'Unknown',
              date: h.date,
              action: h.action,
              detail: h.detail,
            });
          });
        }
      });
      setPendingRepairs(repairs);
      allHistory.sort((a, b) => b.date.localeCompare(a.date));
      setRecentHistory(allHistory.slice(0, 5));
      
      setActiveUsers(usersSnap.size);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadKpiData = async () => {
    try {
      setKpiLoading(true);
      const [projSnap, evalSnap] = await Promise.all([
        getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects')),
        getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projectEvaluations')),
      ]);

      const projects = projSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      const evaluations = evalSnap.docs.map((d) => d.data() as Evaluation);

      // Group evaluations by projectId
      const evalMap: Record<string, Evaluation[]> = {};
      evaluations.forEach((e) => {
        if (!evalMap[e.projectId]) evalMap[e.projectId] = [];
        evalMap[e.projectId].push(e);
      });

      const kpis: ProjectKPI[] = projects.map((p) => {
        const evals = evalMap[p.id] || [];
        let avgScore = 0;
        if (evals.length > 0) {
          const total = evals.reduce((sum, e) => {
            const perEval = (e.ratings.q1 + e.ratings.q2 + e.ratings.q3 + e.ratings.q4 + e.ratings.q5) / 5;
            return sum + perEval;
          }, 0);
          avgScore = total / evals.length;
        }
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          category: p.category,
          avgScore,
          scorePercent: Math.round((avgScore / 5) * 100),
          evalCount: evals.length,
          progress: p.progress || 0,
        };
      });

      // Sort by scorePercent desc, then by evalCount
      kpis.sort((a, b) => {
        if (b.evalCount === 0 && a.evalCount === 0) return 0;
        if (b.evalCount === 0) return -1;
        if (a.evalCount === 0) return 1;
        return b.scorePercent - a.scorePercent;
      });

      setKpiData(kpis);

      // Overall average from projects that have evaluations
      const evaluated = kpis.filter((k) => k.evalCount > 0);
      if (evaluated.length > 0) {
        const avg = evaluated.reduce((s, k) => s + k.scorePercent, 0) / evaluated.length;
        setOverallAvg(Math.round(avg));
      }
    } catch (err) {
      console.error('Error loading KPI data:', err);
    } finally {
      setKpiLoading(false);
    }
  };

  const loadReviewData = async () => {
    try {
      setReviewLoading(true);
      const reviewsSnap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'itReviews'));
      const reviews = reviewsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<ITReviewRecord, 'id'>),
      }));

      reviews.sort((left, right) => getReviewTimestamp(right) - getReviewTimestamp(left));
      setReviewRecords(reviews);
    } catch (error) {
      console.error('Error loading IT reviews:', error);
    } finally {
      setReviewLoading(false);
    }
  };

  const displayedKpis = kpiFilter === 'evaluated'
    ? kpiData.filter((k) => k.evalCount > 0)
    : kpiData;

  const availableReviewMonths = useMemo(
    () =>
      Array.from(new Set(reviewRecords.map((record) => getReviewMonthKey(record)).filter(Boolean))).sort((left, right) =>
        right.localeCompare(left),
      ),
    [reviewRecords],
  );

  useEffect(() => {
    if (!availableReviewMonths.length) {
      setSelectedReviewMonth(currentReviewMonthKey);
      return;
    }

    if (availableReviewMonths.includes(currentReviewMonthKey)) {
      if (!selectedReviewMonth || !availableReviewMonths.includes(selectedReviewMonth)) {
        setSelectedReviewMonth(currentReviewMonthKey);
      }
      return;
    }

    if (!selectedReviewMonth || !availableReviewMonths.includes(selectedReviewMonth)) {
      setSelectedReviewMonth(availableReviewMonths[0]);
    }
  }, [availableReviewMonths, currentReviewMonthKey, selectedReviewMonth]);

  const monthlyReviews = useMemo(
    () => reviewRecords.filter((record) => getReviewMonthKey(record) === selectedReviewMonth),
    [reviewRecords, selectedReviewMonth],
  );

  const monthlyReviewTotal = monthlyReviews.reduce((sum, record) => sum + getReviewRating(record.rating), 0);
  const monthlyReviewCount = monthlyReviews.length;
  const monthlyReviewAverage = monthlyReviewCount > 0 ? monthlyReviewTotal / monthlyReviewCount : 0;
  const monthlyReviewPercent = monthlyReviewCount > 0 ? Math.round((monthlyReviewTotal / (monthlyReviewCount * 5)) * 100) : 0;
  const monthlyReviewScoreInfo = monthlyReviewCount > 0
    ? getScoreLabel(monthlyReviewPercent)
    : { label: 'ยังไม่มีรีวิว', color: 'text-slate-500' };
  const selectedReviewMonthLabel = formatMonthLabel(selectedReviewMonth || currentReviewMonthKey);

  return (
    <div className="p-8 max-w-[95%] mx-auto">
      <header className="relative mb-12 rounded-3xl overflow-hidden min-h-[320px] flex items-center shadow-lg border border-white/30 bg-surface/30 backdrop-blur-sm">
        <div className="absolute inset-0 z-0">
          <img 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay" 
            alt="office" 
            src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600&h=400&fit=crop"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"></div>
        </div>
        <div className="relative z-10 px-12 max-w-2xl">
          <h1 className="text-5xl font-extrabold text-on-surface mb-4 tracking-tight leading-tight">
            Welcome to the <br/><span className="text-primary">CMG IT Management</span>
          </h1>
          <p className="text-lg text-on-surface-variant mb-8 font-body">
            Streamline your IT lifecycle. Managing {statsLoading ? '...' : totalAssets.toLocaleString()} assets across 4 global departments with precision and clarity.
          </p>
          <div className="relative group max-w-md">
            <span className="absolute inset-y-0 left-4 flex items-center text-outline group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined">search</span>
            </span>
            <input 
              className="w-full pl-12 pr-4 py-4 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white/80 transition-all placeholder:text-outline font-body shadow-sm" 
              placeholder="Quick search for serial, user, or asset ID..." 
              type="text"
            />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-primary-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-secondary-container rounded-2xl text-on-secondary-container">
              <span className="material-symbols-outlined">computer</span>
            </div>
            {/* <span className="text-xs font-bold text-primary bg-primary-container/20 px-3 py-1 rounded-full">+12 this month</span> */}
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">{statsLoading ? '...' : totalAssets.toLocaleString()}</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Total Assets</div>
        </div>

        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-error-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-error-container/20 rounded-2xl text-error">
              <span className="material-symbols-outlined">handyman</span>
            </div>
            <span className="text-xs font-bold text-error bg-error-container/20 px-3 py-1 rounded-full">High Priority</span>
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">{statsLoading ? '...' : pendingRepairs.toLocaleString()}</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Pending Repairs</div>
        </div>

        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-tertiary-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-tertiary-container/30 rounded-2xl text-on-tertiary-container">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="text-xs font-bold text-on-tertiary-container bg-tertiary-container/30 px-3 py-1 rounded-full">Active</span>
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">{statsLoading ? '...' : activeUsers.toLocaleString()}</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Active Users</div>
        </div>
      </section>

      {/* ===== PROJECT KPI CHART SECTION ===== */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-on-surface mb-1">Project KPI Dashboard</h2>
            <p className="text-sm text-on-surface-variant font-body">คะแนนความพึงพอใจโปรเจกต์ (% Total จากการประเมิน)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 overflow-hidden shadow-sm">
              <button
                onClick={() => setKpiFilter('evaluated')}
                className={`px-5 py-2.5 text-sm font-bold transition-all ${kpiFilter === 'evaluated' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-white/40'}`}
              >
                มีการประเมิน
              </button>
              <button
                onClick={() => setKpiFilter('all')}
                className={`px-5 py-2.5 text-sm font-bold transition-all ${kpiFilter === 'all' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-white/40'}`}
              >
                ทั้งหมด
              </button>
            </div>
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-70"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-[18px]">download</span>
              )}
              {isExporting ? 'Generating...' : 'Export ISO Report'}
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-2xl text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              Projects
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Summary Cards */}
          <div className="xl:col-span-1 flex flex-col gap-4">
            {/* Overall Score Card */}
            <div className="bg-gradient-to-br from-[#1a4a7a] to-[#27619d] rounded-3xl p-7 text-white shadow-lg shadow-[#27619d]/30 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/20"></div>
                <div className="absolute -bottom-12 -left-8 w-52 h-52 rounded-full bg-white/10"></div>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-white text-[24px]">military_tech</span>
                  <span className="text-xl font-extrabold uppercase tracking-wider text-white">Overall KPI</span>
                </div>
                <div className="text-6xl font-extrabold mb-1 tracking-tight">
                  {kpiLoading ? '—' : `${overallAvg}%`}
                </div>
                <div className="text-sm text-white/70 font-medium mb-5">คะแนนเฉลี่ยรวมทุกโปรเจกต์</div>
                {/* Circular progress */}
                <div className="flex items-center gap-3">
                  <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/>
                    <circle
                      cx="26" cy="26" r="22"
                      fill="none"
                      stroke="white"
                      strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 22}`}
                      strokeDashoffset={`${2 * Math.PI * 22 * (1 - overallAvg / 100)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 26 26)"
                      style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
                    />
                    <text x="26" y="31" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{overallAvg}%</text>
                  </svg>
                  <div>
                    <div className="text-xs font-bold text-white/60 uppercase tracking-wider">จากโปรเจกต์ที่มีการประเมิน</div>
                    <div className="text-lg font-extrabold text-white">
                      {kpiData.filter(k => k.evalCount > 0).length} / {kpiData.length} โปรเจกต์
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats breakdown */}
            <div className="bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/40 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wider">สรุปผล</h3>
              {[
                { label: 'ดีเยี่ยม (≥80%)', count: kpiData.filter(k => k.scorePercent >= 80 && k.evalCount > 0).length, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                { label: 'ดี (60–79%)',      count: kpiData.filter(k => k.scorePercent >= 60 && k.scorePercent < 80 && k.evalCount > 0).length, color: 'bg-[#27619d]', textColor: 'text-[#27619d]' },
                { label: 'พอใช้ (40–59%)',  count: kpiData.filter(k => k.scorePercent >= 40 && k.scorePercent < 60 && k.evalCount > 0).length, color: 'bg-amber-400', textColor: 'text-amber-700' },
                { label: 'ต้องปรับปรุง',    count: kpiData.filter(k => k.scorePercent < 40 && k.evalCount > 0).length, color: 'bg-rose-500', textColor: 'text-rose-700' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}></div>
                    <span className="text-xs font-medium text-on-surface-variant">{item.label}</span>
                  </div>
                  <span className={`text-sm font-extrabold ${item.textColor}`}>{item.count}</span>
                </div>
              ))}
              <div className="border-t border-white/30 pt-3 flex items-center justify-between">
                <span className="text-xs font-medium text-on-surface-variant">ยังไม่มีการประเมิน</span>
                <span className="text-sm font-extrabold text-on-surface-variant">
                  {kpiData.filter(k => k.evalCount === 0).length}
                </span>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="xl:col-span-3 bg-white/40 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-white/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">bar_chart</span>
                <span className="font-extrabold text-on-surface">คะแนนประเมินโปรเจกต์ (% of Total)</span>
              </div>
              <span className="text-xs font-bold text-on-surface-variant bg-white/50 px-3 py-1.5 rounded-full border border-white/40">
                {displayedKpis.length} โปรเจกต์
              </span>
            </div>

            <div className="p-7">
              {kpiLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                    <p className="text-sm text-on-surface-variant font-body">กำลังโหลดข้อมูล KPI...</p>
                  </div>
                </div>
              ) : displayedKpis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">analytics</span>
                  <p className="text-sm font-bold text-on-surface-variant">ยังไม่มีข้อมูลการประเมินโปรเจกต์</p>
                  <p className="text-xs text-outline mt-1">ไปที่หน้า Projects เพื่อทำการประเมิน</p>
                </div>
              ) : (
                <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {displayedKpis.map((kpi, idx) => {
                    const gradient = getScoreGradient(kpi.scorePercent);
                    const scoreInfo = kpi.evalCount > 0 ? getScoreLabel(kpi.scorePercent) : null;
                    const sc = statusColor[kpi.status] || statusColor['Planning'];
                    return (
                      <div
                        key={kpi.id}
                        onClick={() => navigate(`/projects/${kpi.id}`)}
                        className="group cursor-pointer px-3 py-2 rounded-xl hover:bg-white/50 border border-transparent hover:border-white/60 transition-all"
                      >
                        {/* Row: rank + name + bar + score — all in one compact line */}
                        <div className="flex items-center gap-2.5">
                          {/* Rank badge */}
                          <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                            idx === 0 ? 'bg-amber-400 text-white' :
                            idx === 1 ? 'bg-slate-300 text-slate-700' :
                            idx === 2 ? 'bg-orange-300 text-white' :
                            'bg-surface-container text-on-surface-variant'
                          }`}>
                            {kpi.evalCount > 0 ? idx + 1 : '—'}
                          </div>

                          {/* Name + status dot */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-on-surface truncate group-hover:text-primary transition-colors leading-tight">
                              {kpi.name}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`}></span>
                              <span className={`text-[9px] font-semibold ${sc.text} truncate`}>{kpi.status}</span>
                            </div>
                          </div>

                          {/* Bar */}
                          <div className="flex-[1] min-w-0">
                            {kpi.evalCount > 0 ? (
                              <AnimatedBar percent={kpi.scorePercent} gradient={gradient} />
                            ) : (
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="h-2 w-0 rounded-full bg-slate-200"/>
                              </div>
                            )}
                          </div>

                          {/* Score */}
                          <div className="shrink-0 w-16 text-right">
                            {kpi.evalCount > 0 ? (
                              <span className={`text-[13px] font-extrabold ${scoreInfo?.color}`}>
                                {kpi.scorePercent}%
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-outline">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              {!kpiLoading && displayedKpis.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mt-5 pt-5 border-t border-white/30">
                  {[
                    { label: 'ดีเยี่ยม ≥80%', color: 'bg-emerald-500' },
                    { label: 'ดี 60–79%',     color: 'bg-[#27619d]' },
                    { label: 'พอใช้ 40–59%', color: 'bg-amber-400' },
                    { label: 'ต้องปรับปรุง <40%', color: 'bg-rose-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-2.5 rounded ${item.color}`}></div>
                      <span className="text-[11px] font-medium text-on-surface-variant">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="mb-1 text-3xl font-bold text-on-surface">Monthly Reviews</h2>
            <p className="text-base text-on-surface-variant font-body">
              แสดงรีวิวเฉพาะเดือนที่เลือก และคำนวณคะแนนจากสูตร คะแนนรวม / (จำนวนรีวิว x 5) x 100
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-md">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Month</label>
              <select
                value={selectedReviewMonth}
                onChange={(event) => setSelectedReviewMonth(event.target.value)}
                className="bg-transparent text-base font-bold text-on-surface outline-none"
              >
                {(availableReviewMonths.length ? availableReviewMonths : [currentReviewMonthKey]).map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-1">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c3aed] via-[#2563eb] to-[#0f766e] p-7 text-white shadow-lg">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/30"></div>
                <div className="absolute -bottom-10 -left-10 h-52 w-52 rounded-full bg-white/10"></div>
              </div>
              <div className="relative z-10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px]">reviews</span>
                  <span className="text-xl font-extrabold">{selectedReviewMonthLabel}</span>
                </div>
                <div className="text-6xl font-extrabold tracking-tight">{reviewLoading ? '—' : `${monthlyReviewPercent}%`}</div>
                <div className="mt-2 text-base font-medium text-white/80">คะแนนรีวิวเฉลี่ยของเดือนนี้</div>
                <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white/70">Average Score</div>
                    <div className="text-2xl font-extrabold">{monthlyReviewAverage.toFixed(1)}/5</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-white/70">Reviews</div>
                    <div className="text-2xl font-extrabold">{monthlyReviewCount}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm backdrop-blur-md">
              <h3 className="mb-4 text-base font-extrabold uppercase tracking-wider text-on-surface">Review Summary</h3>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-on-surface-variant">คะแนนเฉลี่ยเป็นเปอร์เซ็นต์</span>
                    <span className={`text-base font-extrabold ${monthlyReviewScoreInfo.color}`}>{monthlyReviewPercent}%</span>
                  </div>
                  <AnimatedBar percent={monthlyReviewPercent} gradient={getScoreGradient(monthlyReviewPercent)} />
                </div>

                <div className="flex items-center justify-between border-t border-white/30 pt-4">
                  <span className="text-sm font-medium text-on-surface-variant">ระดับคะแนน</span>
                  <span className={`text-base font-extrabold ${monthlyReviewScoreInfo.color}`}>{monthlyReviewScoreInfo.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface-variant">จำนวนรีวิวของเดือน</span>
                  <span className="text-base font-extrabold text-on-surface">{monthlyReviewCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/40 shadow-sm backdrop-blur-md xl:col-span-2">
            <div className="flex items-center justify-between border-b border-white/30 px-7 py-5">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface">Review List</h3>
                <p className="text-sm text-on-surface-variant">{selectedReviewMonthLabel}</p>
              </div>
              <span className="rounded-full border border-white/40 bg-white/50 px-3 py-1.5 text-sm font-bold text-on-surface-variant">
                {monthlyReviewCount} reviews
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-4 custom-scrollbar">
              {reviewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
                    <p className="text-sm text-on-surface-variant font-body">กำลังโหลดรีวิว...</p>
                  </div>
                </div>
              ) : monthlyReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined mb-3 text-5xl text-outline-variant">forum</span>
                  <p className="text-sm font-bold text-on-surface-variant">ยังไม่มีรีวิวในเดือนนี้</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyReviews.map((review) => {
                    const ratingValue = getReviewRating(review.rating);

                    return (
                      <div key={review.id} className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-on-surface-variant">
                              {formatReviewDate(review.reviewDate || review.requestDate || review.reviewedAt || review.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-2 text-amber-700">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span
                                key={`${review.id}-star-${index}`}
                                className={`material-symbols-outlined text-[18px] ${index < ratingValue ? 'text-amber-500' : 'text-slate-300'}`}
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                            <span className="ml-1 text-sm font-bold">{ratingValue}/5</span>
                          </div>
                        </div>

                        <p className="text-base leading-8 text-on-surface-variant">{review.reviewComment || '-'}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold text-on-surface">Recent Asset History</h2>
            <a className="text-primary text-sm font-semibold hover:underline" href="#">View All Logs</a>
          </div>
          <div className="bg-white/20 backdrop-blur-xl rounded-3xl p-2 border border-white/30 shadow-sm">
            <div className="bg-white/40 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/30">
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Asset ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Equipment</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Assigned To</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider text-right">Last Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20">
                    {recentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant font-body">
                          {statsLoading ? 'Loading history...' : 'No recent history found.'}
                        </td>
                      </tr>
                    ) : (
                      recentHistory.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-white/40 transition-colors">
                          <td className="px-6 py-5 font-display font-bold text-primary">{entry.assetId}</td>
                          <td className="px-6 py-5 text-sm">
                            <div className="font-semibold text-on-surface">{entry.equipment}</div>
                            <div className="text-xs text-on-surface-variant mt-0.5">{entry.action}</div>
                          </td>
                          <td className="px-6 py-5 text-sm text-on-surface-variant">{entry.user}</td>
                          <td className="px-6 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${assetStatusColor[entry.status] || 'bg-surface-container-highest text-outline'}`}>{entry.status}</span>
                          </td>
                          <td className="px-6 py-5 text-xs text-right text-outline">{timeAgo(entry.date)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-on-surface mb-4">Quick Actions</h2>
          <div className="bg-primary-container/20 backdrop-blur-md rounded-3xl p-8 border border-white/40 relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-on-primary-container mb-2">Register New Equipment</h3>
              <p className="text-primary-dim text-sm mb-6">Easily add new hardware to the organizational ledger.</p>
              {userProfile && (
                <button className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:translate-x-1 transition-transform flex items-center gap-2">
                  Launch Wizard <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
            <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-9xl text-primary/5 group-hover:scale-110 transition-transform">qr_code_scanner</span>
          </div>

          <div className="bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/40 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface mb-4">Urgent Repair Tickets</h3>
            <div className="space-y-4">
              <div className="flex gap-4 p-3 hover:bg-white/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20">
                <div className="w-10 h-10 rounded-full bg-error-container/20 text-error flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sm">warning</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Broken Screen - LAP-089</div>
                  <div className="text-xs text-on-surface-variant">Requested by Elena R. • 2h ago</div>
                </div>
              </div>
              <div className="flex gap-4 p-3 hover:bg-white/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20">
                <div className="w-10 h-10 rounded-full bg-secondary-container/30 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sm">battery_alert</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Battery Swelling - PHN-112</div>
                  <div className="text-xs text-on-surface-variant">Requested by Marcus T. • 5h ago</div>
                </div>
              </div>
            </div>
            {userProfile && (
              <button className="w-full mt-6 py-3 text-sm font-bold text-primary border-t border-white/20 hover:bg-white/20 transition-colors">
                View Maintenance Dashboard
              </button>
            )}
          </div>
        </div>
      </section>
      {/* Hidden PDF Report Container */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -50, opacity: 0.001, pointerEvents: 'none' }}>
        <ISOAuditReport 
          ref={reportRef} 
          kpiData={kpiData} 
          overallAvg={overallAvg} 
          userProfile={userProfile} 
        />
      </div>
    </div>
  );
};

export default Dashboard;
