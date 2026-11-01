import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import {
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  Archive,
  PlayCircle,
  ShieldCheck,
  RefreshCw,
  Code2,
  Users,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Sparkles
} from 'lucide-react';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

interface StatusMetric {
  status: TaskStatus;
  label: string;
  count: number;
  color: string;
  borderColor: string;
  bgLight: string;
  icon: React.ElementType;
  description: string;
}

interface PriorityBreakdown {
  status: string;
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

interface VelocityPoint {
  day: string;
  pending: number;
  in_progress: number;
  completed: number;
  archived: number;
}

interface MockTenantDataset {
  tenantName: string;
  tenantEmail: string;
  userId: string;
  totalTasks: number;
  statusMetrics: StatusMetric[];
  priorityBreakdown: PriorityBreakdown[];
  velocity: VelocityPoint[];
}

const DATASETS: Record<string, MockTenantDataset> = {
  'user_a': {
    tenantName: 'Alex Mercer (Platform Architect)',
    tenantEmail: 'alex.mercer@taskflow.dev',
    userId: '8f7d9a10-4c2b-4e1a-9f5e-1a2b3c4d5e6f',
    totalTasks: 42,
    statusMetrics: [
      {
        status: 'pending',
        label: 'Pending',
        count: 14,
        color: '#f59e0b',
        borderColor: '#d97706',
        bgLight: 'rgba(245, 158, 11, 0.1)',
        icon: Clock,
        description: 'Enqueued in backlog, awaiting execution or priority assignment.'
      },
      {
        status: 'in_progress',
        label: 'In Progress',
        count: 11,
        color: '#0ea5e9',
        borderColor: '#0284c7',
        bgLight: 'rgba(14, 165, 233, 0.1)',
        icon: PlayCircle,
        description: 'Actively being processed by tenant worker or user assignment.'
      },
      {
        status: 'completed',
        label: 'Completed',
        count: 12,
        color: '#10b981',
        borderColor: '#059669',
        bgLight: 'rgba(16, 185, 129, 0.1)',
        icon: CheckCircle2,
        description: 'Successfully verified, finished, and marked resolved.'
      },
      {
        status: 'archived',
        label: 'Archived',
        count: 5,
        color: '#64748b',
        borderColor: '#475569',
        bgLight: 'rgba(100, 116, 139, 0.1)',
        icon: Archive,
        description: 'Soft-closed historical tasks preserved for tenancy audit trails.'
      }
    ],
    priorityBreakdown: [
      { status: 'Pending', low: 3, medium: 6, high: 4, urgent: 1 },
      { status: 'In Progress', low: 1, medium: 4, high: 5, urgent: 1 },
      { status: 'Completed', low: 4, medium: 5, high: 2, urgent: 1 },
      { status: 'Archived', low: 2, medium: 2, high: 1, urgent: 0 }
    ],
    velocity: [
      { day: 'Mon', pending: 18, in_progress: 8, completed: 4, archived: 2 },
      { day: 'Tue', pending: 16, in_progress: 10, completed: 6, archived: 3 },
      { day: 'Wed', pending: 15, in_progress: 12, completed: 8, archived: 4 },
      { day: 'Thu', pending: 13, in_progress: 14, completed: 10, archived: 4 },
      { day: 'Fri', pending: 14, in_progress: 11, completed: 12, archived: 5 }
    ]
  },
  'user_b': {
    tenantName: 'Elena Rostova (DevOps Lead)',
    tenantEmail: 'elena.rostova@taskflow.dev',
    userId: 'b3e4f7a2-11c9-4781-a95e-99f2b8a314cd',
    totalTasks: 28,
    statusMetrics: [
      {
        status: 'pending',
        label: 'Pending',
        count: 6,
        color: '#f59e0b',
        borderColor: '#d97706',
        bgLight: 'rgba(245, 158, 11, 0.1)',
        icon: Clock,
        description: 'Queued infrastructure migration tasks.'
      },
      {
        status: 'in_progress',
        label: 'In Progress',
        count: 7,
        color: '#0ea5e9',
        borderColor: '#0284c7',
        bgLight: 'rgba(14, 165, 233, 0.1)',
        icon: PlayCircle,
        description: 'Running container deployment tests and CI workflows.'
      },
      {
        status: 'completed',
        label: 'Completed',
        count: 13,
        color: '#10b981',
        borderColor: '#059669',
        bgLight: 'rgba(16, 185, 129, 0.1)',
        icon: CheckCircle2,
        description: 'Terraform blueprints applied and verified.'
      },
      {
        status: 'archived',
        label: 'Archived',
        count: 2,
        color: '#64748b',
        borderColor: '#475569',
        bgLight: 'rgba(100, 116, 139, 0.1)',
        icon: Archive,
        description: 'Retired staging environment configurations.'
      }
    ],
    priorityBreakdown: [
      { status: 'Pending', low: 1, medium: 2, high: 2, urgent: 1 },
      { status: 'In Progress', low: 0, medium: 2, high: 3, urgent: 2 },
      { status: 'Completed', low: 3, medium: 6, high: 3, urgent: 1 },
      { status: 'Archived', low: 1, medium: 1, high: 0, urgent: 0 }
    ],
    velocity: [
      { day: 'Mon', pending: 10, in_progress: 5, completed: 8, archived: 1 },
      { day: 'Tue', pending: 9, in_progress: 6, completed: 10, archived: 1 },
      { day: 'Wed', pending: 8, in_progress: 7, completed: 11, archived: 2 },
      { day: 'Thu', pending: 7, in_progress: 8, completed: 12, archived: 2 },
      { day: 'Fri', pending: 6, in_progress: 7, completed: 13, archived: 2 }
    ]
  }
};

export function TaskStatusVisualizer() {
  const [tenantKey, setTenantKey] = useState<string>('user_a');
  const [chartType, setChartType] = useState<'donut' | 'bar' | 'velocity'>('donut');
  const [showJsonContract, setShowJsonContract] = useState<boolean>(false);
  const [refreshSeed, setRefreshSeed] = useState<number>(0);

  const activeDataset = DATASETS[tenantKey];

  // Dynamically calculate pie data
  const pieData = useMemo(() => {
    return activeDataset.statusMetrics.map(item => ({
      name: item.label,
      value: item.count + (refreshSeed % 2 === 1 && item.status === 'pending' ? 1 : 0),
      status: item.status,
      color: item.color
    }));
  }, [activeDataset, refreshSeed]);

  const totalCalculated = useMemo(() => {
    return pieData.reduce((acc, curr) => acc + curr.value, 0);
  }, [pieData]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const count = data.value;
      const pct = ((count / totalCalculated) * 100).toFixed(1);
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl font-sans text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.payload.color || data.color }}
            />
            <span className="font-semibold text-white">{data.name || data.dataKey}</span>
          </div>
          <div className="text-slate-300">
            Count: <span className="font-mono font-bold text-white">{count}</span> tasks
          </div>
          <div className="text-slate-400 text-[11px] mt-0.5">
            Share: <span className="font-mono text-indigo-400">{pct}%</span> of tenant tasks
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-6 space-y-6 shadow-xl backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-800/80 rounded font-semibold">
              Future Phase UI Preview
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> ADR-002 Tenant Scoped
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Task Status Distribution & Analytical Telemetry
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Demonstrates real-time visualization of Task API endpoints (<code className="text-indigo-300">GET /api/v1/tasks</code>) across the four core lifecycle statuses: <span className="text-amber-400">pending</span>, <span className="text-sky-400">in_progress</span>, <span className="text-emerald-400">completed</span>, and <span className="text-slate-400">archived</span>.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tenant Selector to demonstrate ADR-002 isolation */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <Users className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              className="bg-transparent text-xs text-slate-200 border-none outline-none pr-2 cursor-pointer font-medium"
            >
              <option value="user_a" className="bg-slate-900 text-white">Tenant: Alex (42 Tasks)</option>
              <option value="user_b" className="bg-slate-900 text-white">Tenant: Elena (28 Tasks)</option>
            </select>
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setChartType('donut')}
              title="Donut Distribution"
              className={`p-1.5 rounded text-xs transition-colors ${
                chartType === 'donut' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              title="Priority Breakdown"
              className={`p-1.5 rounded text-xs transition-colors ${
                chartType === 'bar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('velocity')}
              title="Status Timeline Velocity"
              className={`p-1.5 rounded text-xs transition-colors ${
                chartType === 'velocity' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setRefreshSeed(s => s + 1)}
            title="Simulate Real-time Task Ingestion"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-lg border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            <span>Simulate Poll</span>
          </button>

          <button
            onClick={() => setShowJsonContract(!showJsonContract)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              showJsonContract
                ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>API Contract</span>
          </button>
        </div>
      </div>

      {/* Tenant Context Pill */}
      <div className="flex flex-wrap items-center justify-between text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 gap-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Active Tenant Context:</span>
          <span className="text-white font-semibold">{activeDataset.tenantName}</span>
          <span className="text-slate-500">({activeDataset.tenantEmail})</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>user_id: <span className="text-indigo-400 truncate max-w-[120px] inline-block align-bottom">{activeDataset.userId}</span></span>
          <span className="text-slate-600">|</span>
          <span>Tenant Scope: <span className="text-emerald-400 font-bold">100% Isolated</span></span>
        </div>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {activeDataset.statusMetrics.map((metric) => {
          const Icon = metric.icon;
          const currentCount = metric.count + (refreshSeed % 2 === 1 && metric.status === 'pending' ? 1 : 0);
          const percent = ((currentCount / totalCalculated) * 100).toFixed(0);
          return (
            <div
              key={metric.status}
              className="p-3.5 rounded-lg border transition-all duration-200"
              style={{
                backgroundColor: metric.bgLight,
                borderColor: metric.borderColor + '55'
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: metric.color }} />
                  {metric.label}
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700">
                  {percent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white tracking-tight">
                  {currentCount}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  tasks
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                {metric.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Chart Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Chart View (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950/80 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {chartType === 'donut' && 'Task Status Proportions (Donut Distribution)'}
              {chartType === 'bar' && 'Status Distribution by Priority Tier (Stacked)'}
              {chartType === 'velocity' && '7-Day Status Velocity & Queue Throughput'}
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Total Monitored: <strong className="text-slate-200">{totalCalculated}</strong> tasks
            </span>
          </div>

          <div className="h-[280px] w-full">
            {chartType === 'donut' && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={customTooltip} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-xs text-slate-300 font-sans ml-1">{value}</span>}
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    animationDuration={600}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeDataset.priorityBreakdown}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="status" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(val) => <span className="text-xs text-slate-300 capitalize">{val}</span>}
                  />
                  <Bar dataKey="urgent" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="high" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="medium" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="low" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'velocity' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeDataset.velocity}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                  <Area type="monotone" dataKey="in_progress" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorProgress)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pending" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Analytical Insights & Architecture notes (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="font-semibold text-white">Status State Lifecycle</span>
              <span className="text-[10px] font-mono text-indigo-400">RFC Status Finite Machine</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="font-mono text-slate-200">pending</span>
                </div>
                <span className="text-slate-400 text-[11px]">Initial task creation</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span className="font-mono text-slate-200">in_progress</span>
                </div>
                <span className="text-slate-400 text-[11px]">Claimed by worker/user</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="font-mono text-slate-200">completed</span>
                </div>
                <span className="text-slate-400 text-[11px]">Terminal success state</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span className="font-mono text-slate-200">archived</span>
                </div>
                <span className="text-slate-400 text-[11px]">Soft retention audit</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80 leading-relaxed">
              <strong className="text-slate-300">Database Index Synergy:</strong> Queries populating this visualizer utilize composite index <code className="text-indigo-300">ix_tasks_user_id_status</code> on <code className="text-indigo-300">(user_id, status)</code>, executing in &lt;1.2ms without full table scans.
            </div>
          </div>
        </div>
      </div>

      {/* Contract Snippet Modal / Drawer */}
      {showJsonContract && (
        <div className="p-4 bg-slate-950 rounded-xl border border-indigo-900/60 font-mono text-xs text-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-indigo-300 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              REST API Contract: GET /api/v1/tasks Response Schema
            </span>
            <span className="text-[10px] text-slate-500">HTTP 200 OK — Application/JSON</span>
          </div>
          <pre className="overflow-x-auto text-[11px] text-emerald-300 leading-relaxed bg-slate-900/90 p-3 rounded-lg border border-slate-800">
{`{
  "total": ${totalCalculated},
  "page": 1,
  "size": 50,
  "pages": 1,
  "items": [
    {
      "id": "e4f8a120-7b3c-4d9a-8e2f-0123456789ab",
      "user_id": "${activeDataset.userId}",
      "title": "Provision PostgreSQL 16+ Migration Pipeline",
      "description": "Execute Alembic upgrade head and verify gen_random_uuid() constraint.",
      "status": "in_progress",
      "priority": "high",
      "due_date": "2026-11-05T18:00:00Z",
      "created_at": "2026-10-31T01:15:20Z",
      "updated_at": "2026-10-31T03:45:00Z"
    },
    {
      "id": "c1a2d3e4-5f6a-7b8c-9d0e-112233445566",
      "user_id": "${activeDataset.userId}",
      "title": "Validate JWT Claim Verification Suite",
      "description": "Ensure sub, exp (30m), iat, iss, aud, type are rigorously rejected when forged.",
      "status": "completed",
      "priority": "urgent",
      "due_date": null,
      "created_at": "2026-10-30T10:00:00Z",
      "updated_at": "2026-10-30T16:20:00Z"
    }
  ]
}`}
          </pre>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Notice: Only tasks owned by current JWT tenant <code className="text-white">{activeDataset.userId}</code> are returned in accordance with ADR-002.</span>
          </div>
        </div>
      )}
    </div>
  );
}
