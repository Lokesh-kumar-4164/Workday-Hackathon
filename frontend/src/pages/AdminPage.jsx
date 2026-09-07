import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, LogOut, Plus, Trash2,
  Calendar, Clock, MapPin, Users, Search, X, CheckCircle2,
  AlertCircle, LayoutGrid, ShieldCheck, ToggleLeft, ToggleRight,
  Eye, Activity, Cpu, TrendingUp, Zap, RefreshCw,
  Shield, ShieldAlert, Sliders, Database, RotateCcw, Server,
} from 'lucide-react';
import {
  createEventApi,
  deleteEventApi,
  getEventRegistrantsApi,
  toggleEventAvailabilityApi,
} from '../api/eventApi';
import {
  fetchMetricsSummary,
  fetchMetricsRange,
  fetchRateLimitStatusApi,
  updateRateLimitConfigApi,
  resetRateLimitApi,
} from '../api/metricsApi';

const CATEGORIES = ['Technology', 'Design', 'Engineering', 'Leadership', 'Business', 'Other'];

const CATEGORY_COLORS = {
  Technology: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Design: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Engineering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Leadership: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Business: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Other: 'bg-slate-700/30 text-slate-400 border-slate-700',
};

/* ── Helpers ── */
function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(hhmm) {
  if (!hhmm) return '';
  const [hh, mm] = hhmm.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function formatEventDate(event) {
  if (!event.eventDate) return '';
  const d = new Date(event.eventDate);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatEventTime(event) {
  const parts = [event.startTime && formatTime(event.startTime), event.endTime && formatTime(event.endTime)].filter(Boolean);
  return parts.join(' – ') || '—';
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, color = 'text-indigo-400' }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ── SVG Sparkline Chart ─────────────────────────────────────────────────────
 *  Renders a minimal area sparkline from an array of {t, v} points.
 *  No external chart library required.
 */
function SparklineChart({ series = [], height = 120, color = '#6366f1', label = '', yUnit = '' }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Flatten all values to compute global y-range
  const allValues = series.flatMap(s => s.values.map(p => p.v)).filter(v => v != null);
  const allTimes  = series.flatMap(s => s.values.map(p => p.t)).filter(t => t != null);

  if (allValues.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-slate-600 text-xs">
        No data yet — make some API requests then refresh
      </div>
    );
  }

  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const rangeY = maxY - minY || 1;
  const rangeT = maxT - minT || 1;

  const W = 600;  // viewBox width
  const H = height;
  const PAD = 4;

  const toX = t => PAD + ((t - minT) / rangeT) * (W - PAD * 2);
  const toY = v => H - PAD - ((v - minY) / rangeY) * (H - PAD * 2);

  // Colour palette for multiple series
  const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171', '#a78bfa'];

  return (
    <div className="relative">
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setTooltip(null)}
        onMouseMove={e => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const xRatio = (e.clientX - rect.left) / rect.width;
          const tHover = minT + xRatio * rangeT;
          // Find closest point across all series
          let best = null;
          let bestDist = Infinity;
          series.forEach((s, si) => {
            s.values.forEach(p => {
              if (p.v == null) return;
              const d = Math.abs(p.t - tHover);
              if (d < bestDist) { bestDist = d; best = { ...p, label: s.label, si }; }
            });
          });
          if (best) setTooltip(best);
        }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={PAD} x2={W - PAD}
            y1={PAD + f * (H - PAD * 2)} y2={PAD + f * (H - PAD * 2)}
            stroke="#1e293b" strokeWidth="1" />
        ))}

        {series.map((s, si) => {
          const pts = s.values.filter(p => p.v != null);
          if (pts.length < 2) return null;
          const lineColor = PALETTE[si % PALETTE.length];
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
          const areaD = `${d} L${toX(pts[pts.length-1].t).toFixed(1)},${H} L${toX(pts[0].t).toFixed(1)},${H} Z`;
          return (
            <g key={s.label}>
              <defs>
                <linearGradient id={`grad-${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={lineColor} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaD} fill={`url(#grad-${si})`} />
              <path d={d} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line
              x1={toX(tooltip.t)} x2={toX(tooltip.t)}
              y1={PAD} y2={H - PAD}
              stroke="#ffffff30" strokeWidth="1" strokeDasharray="3,3"
            />
            <circle cx={toX(tooltip.t)} cy={toY(tooltip.v)} r={3}
              fill={PALETTE[tooltip.si % PALETTE.length]} stroke="#fff" strokeWidth="1.5" />
          </>
        )}
      </svg>

      {/* Tooltip bubble */}
      {tooltip && (
        <div className="absolute top-2 right-2 bg-slate-950/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs pointer-events-none">
          <p className="text-slate-400">{new Date(tooltip.t * 1000).toLocaleTimeString()}</p>
          <p className="text-white font-semibold">{tooltip.v?.toFixed(3)}{yUnit} <span className="text-slate-500 font-normal">{tooltip.label}</span></p>
        </div>
      )}

      {/* Legend for multi-series */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {series.map((s, si) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: (['#6366f1','#22d3ee','#f59e0b','#34d399','#f87171','#a78bfa'])[si % 6] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Monitoring Stat Card ── */
function MetricCard({ icon: Icon, label, value, unit = '', color = 'text-indigo-400', bg = 'from-indigo-600/20 to-indigo-600/5' }) {
  const isNull = value == null;
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className={`text-2xl font-extrabold ${color} ${isNull ? 'opacity-40' : ''}`}>
        {isNull ? '—' : `${value}${unit}`}
      </p>
    </div>
  );
}

/* ── Monitoring Tab ───────────────────────────────────────────────────────── */
function MonitoringTab() {
  const [summary, setSummary] = useState(null);
  const [range, setRange]     = useState(null);
  const [source, setSource]   = useState(null);  // 'local' | 'prometheus'
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const REFRESH_MS = 30_000;

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, r] = await Promise.all([
        fetchMetricsSummary(),
        fetchMetricsRange(3600, '30s'),
      ]);
      setSummary(s);
      setRange(r);
      setSource(r.source ?? 'local');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load monitoring data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const pct = v => v != null ? `${(v * 100).toFixed(2)}%` : null;
  const ms  = v => v != null ? `${v}` : null;
  const rps = v => v != null ? `${v}` : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
            <Activity className="w-3.5 h-3.5" /> Live Monitoring
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">System Metrics</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-sm">Auto-refreshes every 30 s</p>
            {source && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                source === 'prometheus'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {source === 'prometheus' ? '⬤ Prometheus' : '⬤ Local store'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/40 rounded-xl px-3 py-2 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {lastUpdated && (
        <p className="text-[11px] text-slate-600 -mt-4">
          Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({length: 7}).map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard icon={Zap}        label="Requests / sec"   value={rps(summary?.requestsPerSec)}    unit=" req/s" color="text-indigo-400" bg="from-indigo-600/20 to-indigo-600/5" />
            <MetricCard icon={Activity}   label="Avg Latency"      value={ms(summary?.avgLatencyMs)}       unit=" ms"    color="text-cyan-400"   bg="from-cyan-600/20 to-cyan-600/5" />
            <MetricCard icon={TrendingUp} label="p95 Latency"      value={ms(summary?.p95LatencyMs)}       unit=" ms"    color="text-purple-400" bg="from-purple-600/20 to-purple-600/5" />
            <MetricCard icon={AlertCircle} label="Error Rate"      value={pct(summary?.errorRate)}                       color="text-rose-400"   bg="from-rose-600/20 to-rose-600/5" />
            <MetricCard icon={Eye}         label="4xx / sec"        value={rps(summary?.fourxxPerSec)}      unit=" req/s" color="text-amber-400"  bg="from-amber-600/20 to-amber-600/5" />
            <MetricCard icon={AlertCircle} label="5xx / sec"        value={rps(summary?.fivexxPerSec)}      unit=" req/s" color="text-red-400"    bg="from-red-600/20 to-red-600/5" />
            <MetricCard icon={Cpu}         label="Active Instances" value={summary?.activeInstances}                      color="text-emerald-400" bg="from-emerald-600/20 to-emerald-600/5" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-200 mb-3">Request Rate (req/s)</p>
              <SparklineChart series={range?.requestRate ?? []} yUnit=" req/s" />
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-200 mb-3">Latency (ms)</p>
              <SparklineChart series={range?.latencyMs ?? []} yUnit=" ms" color="#22d3ee" />
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-200 mb-3">Error Rate</p>
              <SparklineChart series={range?.errorRate ?? []} yUnit="" color="#f87171" />
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-200 mb-3">Requests by Instance</p>
              <SparklineChart series={range?.byInstance ?? []} yUnit=" req/s" color="#34d399" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Rate Limiter Tab ──────────────────────────────────────────────────────── */
function RateLimiterTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Config editor state
  const [maxTokens, setMaxTokens] = useState(10);
  const [refillRate, setRefillRate] = useState(1);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');

  // Reset state
  const [resettingIp, setResettingIp] = useState(null);
  const [resetAllLoading, setResetAllLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Search filter for IP table
  const [searchIp, setSearchIp] = useState('');

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    setError('');
    try {
      const res = await fetchRateLimitStatusApi();
      setData(res);
      if (res.config && !isBackground) {
        setMaxTokens(res.config.maxTokens);
        setRefillRate(res.config.refillRate);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to connect to Redis rate limiter.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess('');
    setConfigError('');
    try {
      const res = await updateRateLimitConfigApi({
        maxTokens: Number(maxTokens),
        refillRate: Number(refillRate),
      });
      setConfigSuccess(res.message || 'Rate limit policy updated live in Redis!');
      setTimeout(() => setConfigSuccess(''), 4000);
      load(true);
    } catch (err) {
      setConfigError(err?.response?.data?.message || 'Failed to update rate limit configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleApplyPreset = (presetTokens, presetRefill) => {
    setMaxTokens(presetTokens);
    setRefillRate(presetRefill);
  };

  const handleResetIp = async (ip) => {
    setResettingIp(ip);
    setActionSuccess('');
    try {
      const res = await resetRateLimitApi(ip);
      setActionSuccess(res.message || `Rate limit reset for ${ip}`);
      setTimeout(() => setActionSuccess(''), 4000);
      load(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reset IP bucket.');
    } finally {
      setResettingIp(null);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm('Are you sure you want to reset all active rate-limiting token buckets?')) return;
    setResetAllLoading(true);
    setActionSuccess('');
    try {
      const res = await resetRateLimitApi(null, true);
      setActionSuccess(res.message || 'All rate limit buckets reset.');
      setTimeout(() => setActionSuccess(''), 4000);
      load(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reset all buckets.');
    } finally {
      setResetAllLoading(false);
    }
  };

  const filteredBuckets = (data?.activeBuckets ?? []).filter(b =>
    !searchIp || b.ip.toLowerCase().includes(searchIp.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <Shield className="w-3.5 h-3.5" /> Redis Token Bucket Shield
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Rate Limiter & Shield</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-sm">Protected by Upstash Redis cluster · Auto-polls every 5s</p>
            {data?.connected ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected ({data.pingMs}ms)
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
                Disconnected
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetAll}
            disabled={resetAllLoading || (data?.activeBuckets?.length ?? 0) === 0}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 rounded-xl px-3 py-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetAllLoading ? 'animate-spin' : ''}`} />
            Reset All Buckets
          </button>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500/40 bg-slate-900/60 rounded-xl px-3 py-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[11px] text-slate-600 -mt-4">
          Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Success banner */}
      {actionSuccess && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={Database}
              label="Redis Protected Calls"
              value={data?.stats?.total ?? 0}
              unit=" reqs"
              color="text-indigo-400"
              bg="from-indigo-600/20 to-indigo-600/5"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Allowed Requests"
              value={data?.stats?.allowed ?? 0}
              unit=""
              color="text-emerald-400"
              bg="from-emerald-600/20 to-emerald-600/5"
            />
            <MetricCard
              icon={ShieldAlert}
              label="Throttled (429) Calls"
              value={data?.stats?.blocked ?? 0}
              unit={` (${data?.stats?.blockedRate ?? 0}%)`}
              color="text-rose-400"
              bg="from-rose-600/20 to-rose-600/5"
            />
            <MetricCard
              icon={Users}
              label="Active Client Buckets"
              value={data?.activeBuckets?.length ?? 0}
              unit=" IPs"
              color="text-amber-400"
              bg="from-amber-600/20 to-amber-600/5"
            />
          </div>

          {/* Grid of Dynamic Config and Connection Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Policy Config Panel */}
            <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Rate Limit Policy</h3>
                    <p className="text-xs text-slate-400">Updates applied in Redis immediately with zero downtime</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active:</span>
                  <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    {data?.config?.maxTokens} cap / {data?.config?.refillRate} ref/s
                  </span>
                </div>
              </div>

              {configSuccess && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{configSuccess}</span>
                </div>
              )}

              {configError && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{configError}</span>
                </div>
              )}

              {/* Quick Presets */}
              <div className="mb-5">
                <p className="text-xs text-slate-400 mb-2 font-medium">Quick Policy Presets:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(5, 0.5)}
                    className="p-2 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 text-left transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400">Strict</p>
                    <p className="text-[10px] text-slate-500">5 cap · 0.5/sec</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(10, 1)}
                    className="p-2 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 text-left transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400">Standard</p>
                    <p className="text-[10px] text-slate-500">10 cap · 1/sec</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(25, 3)}
                    className="p-2 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 text-left transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400">Moderate</p>
                    <p className="text-[10px] text-slate-500">25 cap · 3/sec</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(50, 10)}
                    className="p-2 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 text-left transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400">Surge/Scale</p>
                    <p className="text-[10px] text-slate-500">50 cap · 10/sec</p>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Max Burst Capacity (Tokens)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Maximum token capacity a single IP can accumulate.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Token Refill Rate (Tokens / sec)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="500"
                    value={refillRate}
                    onChange={(e) => setRefillRate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Number of tokens refilled back per elapsed second.</p>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingConfig ? <Spinner className="h-3.5 w-3.5" /> : <SaveIcon className="w-3.5 h-3.5" />}
                    Save Policy to Redis
                  </button>
                </div>
              </form>
            </div>

            {/* Redis Architecture & Health Details */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cluster Infrastructure</h3>
                    <p className="text-xs text-slate-400">Upstash Serverless Redis engine</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Connection</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Live / Responsive
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Ping Latency</span>
                    <span className="font-mono font-semibold text-slate-200">{data?.pingMs ?? 0} ms</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Algorithm</span>
                    <span className="font-semibold text-slate-200">Atomic Token Bucket (Lua)</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Protected Routes</span>
                    <span className="font-semibold text-slate-200">Auth & Event Registration</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400">Fail-Safe Mode</span>
                    <span className="font-semibold text-indigo-400">Fail Open (SurgeShield)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
                <p className="flex items-center gap-1 text-slate-300 font-semibold mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Surge Protection Active
                </p>
                Requests exceeding the burst threshold automatically receive an HTTP 429 response with exact Retry-After headers.
              </div>
            </div>
          </div>

          {/* Active Client Token Buckets Table */}
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-bold text-white">Active Client Token Buckets</h3>
                <p className="text-xs text-slate-400">IPs currently consuming tokens and tracked in Redis</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by client IP…"
                  value={searchIp}
                  onChange={(e) => setSearchIp(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {filteredBuckets.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                <p className="font-semibold text-slate-400">No active throttled buckets</p>
                <p className="mt-0.5">All client buckets are either full or expired from Redis.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-3 px-3">Client IP</th>
                      <th className="pb-3 px-3">Token Balance</th>
                      <th className="pb-3 px-3">Remaining TTL</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredBuckets.map((bucket) => {
                      const max = bucket.maxTokens || 10;
                      const pct = Math.max(0, Math.min(100, (bucket.tokens / max) * 100));
                      const isLow = bucket.tokens < 2;

                      return (
                        <tr key={bucket.key} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                            {bucket.ip}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2 max-w-xs">
                              <div className="flex-1 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isLow ? 'bg-rose-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-slate-300 shrink-0">
                                {bucket.tokens} / {max}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono">
                            {bucket.ttl}s
                          </td>
                          <td className="py-3 px-3">
                            {bucket.isThrottled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Throttled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Healthy
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleResetIp(bucket.ip)}
                              disabled={resettingIp === bucket.ip}
                              className="px-2.5 py-1 rounded-lg border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer text-[11px] font-medium disabled:opacity-50"
                            >
                              {resettingIp === bucket.ip ? 'Resetting…' : 'Unblock / Reset'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Rate Limit Decision Log */}
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Live Rate Limiting Activity Log</h3>
                <p className="text-xs text-slate-400">Last 50 decisions captured directly from Redis</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {data?.recentLogs?.length ?? 0} events recorded
              </span>
            </div>

            {(!data?.recentLogs || data.recentLogs.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No recent rate-limited calls recorded yet. Send requests to /user/login or /events/:id/register to see live traffic.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {data.recentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/70 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        log.allowed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {log.allowed ? 'ALLOWED' : 'BLOCKED 429'}
                      </span>
                      <span className="font-mono font-semibold text-slate-200">{log.method} {log.route}</span>
                      <span className="font-mono text-slate-500 text-[11px] hidden sm:inline">IP: {log.ip}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span>{log.remaining} tokens left</span>
                      <span className="text-slate-600 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SaveIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

/* ── Event Row ── */
function EventRow({ event, onRemove, onToggle, onViewRegistrants, loadingId }) {
  const catCls = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Other;
  const isActing = loadingId === event.id;
  const registeredCount = event.capacity - event.availableSeats;

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-slate-700 transition-colors duration-150">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catCls}`}>
            {event.category}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            event.available
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {event.available ? 'Active' : 'Disabled'}
          </span>
        </div>
        <p className="text-sm font-bold text-slate-100 truncate">{event.title}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatEventDate(event)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatEventTime(event)}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {registeredCount}/{event.capacity} registered · {event.availableSeats} seats left
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* View registrants */}
        <button
          onClick={() => onViewRegistrants(event)}
          title="View registrants"
          className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Toggle availability */}
        <button
          onClick={() => onToggle(event.id, !event.available)}
          disabled={isActing}
          title={event.available ? 'Disable event' : 'Enable event'}
          className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-150 cursor-pointer disabled:opacity-50"
        >
          {isActing ? <Spinner /> : event.available ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onRemove(event.id)}
          title="Remove event"
          className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Add Event Form ── */
function AddEventForm({ onAdd, onClose }) {
  const empty = { title: '', date: '', startTime: '', endTime: '', location: '', seats: '', category: 'Technology', description: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
    if (apiError) setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Event name is required';
    if (!form.date) {
      errs.date = 'Date is required';
    } else {
      const picked = new Date(form.date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (picked < today) errs.date = 'Date cannot be in the past';
    }
    if (!form.startTime) errs.startTime = 'Start time is required';
    if (!form.endTime) {
      errs.endTime = 'End time is required';
    } else if (form.startTime && form.endTime <= form.startTime) {
      errs.endTime = 'End time must be after start time';
    }
    if (!form.location.trim()) errs.location = 'Location is required';
    const s = Number(form.seats);
    if (!form.seats || isNaN(s) || s < 1) errs.seats = 'Enter a valid seat count (≥ 1)';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError('');
    try {
      const result = await createEventApi({
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim(),
        eventDate: new Date(form.date).toISOString(),
        startTime: form.startTime,
        endTime: form.endTime,
        category: form.category,
        capacity: Number(form.seats),
      });
      setDone(true);
      setTimeout(() => { onAdd(result.event); onClose(); }, 900);
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (field) =>
    `w-full px-4 py-2.5 bg-slate-950/60 border ${
      errors[field] ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
    } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`;

  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl shadow-indigo-950/50 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Add New Event</h3>
              <p className="text-xs text-slate-400 mt-0.5">Fill in the details to publish an event</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {apiError && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {done ? (
            <div className="text-center py-8 space-y-3">
              <div className="inline-flex p-4 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-white font-semibold">Event added successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Event Name <span className="text-rose-400">*</span>
                </label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Annual Tech Summit" className={inputCls('title')} />
                {errors.title && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Optional event description…" rows={2}
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200 resize-none" />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Event Date <span className="text-rose-400">*</span>
                </label>
                <input type="date" name="date" min={todayISO} value={form.date} onChange={handleChange} className={`${inputCls('date')} [color-scheme:dark]`} />
                {errors.date && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.date}</p>}
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Start Time <span className="text-rose-400">*</span></label>
                  <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className={`${inputCls('startTime')} [color-scheme:dark]`} />
                  {errors.startTime && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.startTime}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">End Time <span className="text-rose-400">*</span></label>
                  <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className={`${inputCls('endTime')} [color-scheme:dark]`} />
                  {errors.endTime && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.endTime}</p>}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Location <span className="text-rose-400">*</span></label>
                <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Hall B, Convention Center" className={inputCls('location')} />
                {errors.location && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.location}</p>}
              </div>

              {/* Seats + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Seats <span className="text-rose-400">*</span></label>
                  <input name="seats" type="number" min="1" value={form.seats} onChange={handleChange} placeholder="e.g. 50" className={inputCls('seats')} />
                  {errors.seats && <p className="flex items-center gap-1 text-xs text-rose-400 mt-1"><AlertCircle className="w-3.5 h-3.5" />{errors.seats}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-4 transition-all duration-200 cursor-pointer [color-scheme:dark]">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm font-semibold transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                  {saving ? <><Spinner /> Saving...</> : <><Plus className="w-4 h-4" /> Add Event</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Registrants Modal ── */
function RegistrantsModal({ event, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const result = await getEventRegistrantsApi(event.id);
        setData(result);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load registrants.');
      } finally {
        setLoading(false);
      }
    })();
  }, [event.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Registrants</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{event.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6 text-indigo-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-rose-400 text-sm">{error}</div>
          ) : data?.registrants?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No one has registered yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
                <span>{data.totalRegistered} registered</span>
                <span>{data.availableSeats} seats remaining</span>
              </div>
              <div className="space-y-2">
                {data.registrants.map((r) => (
                  <div key={r.registrationId} className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {r.userName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{r.userName}</p>
                      <p className="text-xs text-slate-500 truncate">{r.userEmail}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(r.registeredAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Admin Page ── */
export default function AdminPage({ user, onLogout, events, eventsLoading, eventsError, onRefreshEvents }) {
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'monitoring'
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [viewRegistrantsEvent, setViewRegistrantsEvent] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const filtered = events.filter(ev => {
    const q = search.toLowerCase();
    return (
      ev.title?.toLowerCase().includes(q) ||
      ev.location?.toLowerCase().includes(q) ||
      ev.category?.toLowerCase().includes(q)
    );
  });

  const total = events.length;
  const totalSeats = events.reduce((s, e) => s + (e.capacity ?? 0), 0);
  const categories = [...new Set(events.map(e => e.category))].filter(Boolean).length;

  async function handleToggle(id, newAvailable) {
    setTogglingId(id);
    setActionError('');
    try {
      await toggleEventAvailabilityApi(id, newAvailable);
      await onRefreshEvents();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Failed to toggle event.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmRemove(id) {
    setDeletingId(id);
    setActionError('');
    try {
      await deleteEventApi(id);
      setConfirmRemoveId(null);
      await onRefreshEvents();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  const Bg = () => (
    <>
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    </>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      <Bg />

      {/* Navbar */}
      <header className="relative z-10 border-b border-slate-800/80 backdrop-blur-md bg-slate-950/60 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/25">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">SurgeShield</span>
              <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Admin</span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('events')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Events
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'monitoring'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Monitoring
            </button>
            <button
              onClick={() => setActiveTab('ratelimit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'ratelimit'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Rate Limiter
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="truncate max-w-[180px]">{user?.email}</span>
            </div>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 rounded-xl px-3 py-2 transition-colors duration-150 cursor-pointer">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {activeTab === 'monitoring' ? (
          <MonitoringTab />
        ) : activeTab === 'ratelimit' ? (
          <RateLimiterTab />
        ) : (
          <>
            {/* Page Title */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin Panel
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Event Management</h1>
                <p className="text-slate-400 text-sm mt-1.5">Create, manage, and monitor events visible to all registered users.</p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Event
              </button>
            </div>

            {/* Action error banner */}
            {actionError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
                <button onClick={() => setActionError('')} className="ml-auto cursor-pointer text-rose-300 hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Events" value={total} sub="published to users" />
              <StatCard label="Total Seats" value={totalSeats} sub="across all events" color="text-blue-400" />
              <StatCard label="Categories" value={categories} sub="event types" color="text-purple-400" />
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, location, or category…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Event List */}
            <section>
              <p className="text-xs text-slate-500 font-medium mb-3">
                Showing {filtered.length} of {total} event{total !== 1 ? 's' : ''}
                {search && <span className="text-indigo-400"> for "{search}"</span>}
              </p>

              {eventsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner className="h-8 w-8 text-indigo-400" />
                </div>
              ) : eventsError ? (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                  <p className="text-rose-400 font-medium">{eventsError}</p>
                  <button onClick={onRefreshEvents} className="mt-3 text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer">Retry</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center">
                  <LayoutGrid className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">No events found</p>
                  <p className="text-slate-600 text-sm mt-1">Try adjusting your search or add a new event.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(ev => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      onRemove={(id) => setConfirmRemoveId(id)}
                      onToggle={handleToggle}
                      onViewRegistrants={setViewRegistrantsEvent}
                      loadingId={togglingId}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} SurgeShield · Admin Panel
      </footer>

      {/* Add Event Modal */}
      {showAddForm && (
        <AddEventForm
          onAdd={() => { onRefreshEvents(); setShowAddForm(false); }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Registrants Modal */}
      {viewRegistrantsEvent && (
        <RegistrantsModal
          event={viewRegistrantsEvent}
          onClose={() => setViewRegistrantsEvent(null)}
        />
      )}

      {/* Confirm Remove Modal */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-rose-950/30 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Remove Event?</h3>
            <p className="text-slate-400 text-sm">
              This will permanently remove{' '}
              <span className="text-slate-200 font-semibold">
                {events.find(e => e.id === confirmRemoveId)?.title}
              </span>{' '}
              and all its registrations. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm font-semibold transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => handleConfirmRemove(confirmRemoveId)}
                disabled={deletingId === confirmRemoveId}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-60">
                {deletingId === confirmRemoveId ? <><Spinner /> Deleting...</> : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
