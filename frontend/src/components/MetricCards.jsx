import React from 'react'
import { ShieldCheck, AlertTriangle, Zap, Cloud } from 'lucide-react'

export default function MetricCards({ status }) {
  const safeCount = status.total_safe || 0
  const violationCount = status.total_violations || 0
  const fps = (status.fps || 0).toFixed(1)
  const latency = status.api_latency_ms || 0
  const compliance = status.compliance_rate !== undefined ? status.compliance_rate : 100.0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
      
      {/* Metric 1: Hợp lệ / Đội mũ */}
      <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-all duration-300 hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Hợp Lệ (Có Mũ)
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {safeCount}
          </span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {compliance}% Đạt chuẩn
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, compliance)}%` }}
          />
        </div>
      </div>

      {/* Metric 2: Vi phạm / Không mũ */}
      <div className={`glass-panel p-4 rounded-xl border transition-all duration-300 relative overflow-hidden ${
        violationCount > 0 
          ? 'border-red-400 dark:border-red-500/60 bg-red-50/60 dark:bg-red-950/20 shadow-md shadow-red-500/10 animate-pulse-subtle' 
          : 'border-slate-200 dark:border-slate-800 hover:border-red-400/40'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Vi Phạm (Không Mũ)
          </span>
          <div className={`p-2 rounded-lg ${
            violationCount > 0 
              ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold tabular-nums ${violationCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {violationCount}
          </span>
          {violationCount > 0 && (
            <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">
              CẦN NHẮC NHỞ
            </span>
          )}
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-red-500 h-full rounded-full transition-all duration-500" 
            style={{ width: violationCount > 0 ? '100%' : '0%' }}
          />
        </div>
      </div>

      {/* Metric 3: Tốc độ xử lý FPS */}
      <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tốc Độ Khung Hình
          </span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {fps}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
            FPS Mượt mà
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-blue-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, (fps / 30) * 100)}%` }}
          />
        </div>
      </div>

      {/* Metric 4: AI Response Latency */}
      <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Độ Trễ Phản Hồi AI
          </span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Cloud className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
            {latency} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">ms</span>
          </span>
          <span className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 font-mono font-semibold">
            Thời Gian Thực
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.max(10, Math.min(100, 100 - (latency / 6)))}%` }}
          />
        </div>
      </div>

    </div>
  )
}
