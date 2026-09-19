import React, { useMemo } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { BarChart3, Clock, Gauge } from 'lucide-react';

interface SpeedZoneHistogramProps {
  analysis: RideAnalysis;
  theme?: AppTheme;
}

export const SpeedZoneHistogram: React.FC<SpeedZoneHistogramProps> = ({ 
  analysis,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const formatDuration = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '0m';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.round((totalSec % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Dynamically calculate speed thresholds according to maximum recorded ride speed
  const { thresholds, zones } = useMemo(() => {
    const maxSpd = Math.max(20, analysis.maxSpeedKmh);
    const totalSec = Math.max(1, analysis.totalDurationSeconds);

    // Adaptive threshold calculation
    let t1 = 30; // Low speed cap
    let t2 = 60; // Moderate speed cap
    let t3 = 85; // High speed start

    if (maxSpd <= 45) {
      // City commute, cycling, scooter, or dense traffic
      t1 = 15;
      t2 = 28;
      t3 = 38;
    } else if (maxSpd <= 75) {
      // Mixed suburban / rolling hills
      t1 = 20;
      t2 = 40;
      t3 = 58;
    } else if (maxSpd <= 110) {
      // Standard open highway / tour
      t1 = 30;
      t2 = 60;
      t3 = 85;
    } else {
      // Fast highway tour or track
      t1 = 40;
      t2 = 75;
      t3 = 105;
    }

    // Time spent in each bracket
    let time0 = analysis.stoppedTimeSeconds;
    let timeLow = 0;
    let timeMid = 0;
    let timeBrisk = 0;
    let timeHigh = 0;

    const points = analysis.points;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev.time && curr.time) {
        const dt = Math.max(0, (new Date(curr.time).getTime() - new Date(prev.time).getTime()) / 1000);
        if (dt > 0 && dt < 180) {
          const spd = (prev.speedKmh + curr.speedKmh) / 2;
          if (spd < 1.0) {
            // stationary
          } else if (spd <= t1) {
            timeLow += dt;
          } else if (spd <= t2) {
            timeMid += dt;
          } else if (spd <= t3) {
            timeBrisk += dt;
          } else {
            timeHigh += dt;
          }
        }
      }
    }

    const movingSum = timeLow + timeMid + timeBrisk + timeHigh;
    if (movingSum > 0 && analysis.movingTimeSeconds > 0) {
      const scale = analysis.movingTimeSeconds / movingSum;
      timeLow *= scale;
      timeMid *= scale;
      timeBrisk *= scale;
      timeHigh *= scale;
    } else if (movingSum === 0 && analysis.movingTimeSeconds > 0) {
      timeLow = analysis.movingTimeSeconds * 0.25;
      timeMid = analysis.movingTimeSeconds * 0.45;
      timeBrisk = analysis.movingTimeSeconds * 0.20;
      timeHigh = analysis.movingTimeSeconds * 0.10;
    }

    const p0 = Math.round((time0 / totalSec) * 100);
    const p1 = Math.round((timeLow / totalSec) * 100);
    const p2 = Math.round((timeMid / totalSec) * 100);
    const p3 = Math.round((timeBrisk / totalSec) * 100);
    const p4 = Math.max(0, 100 - (p0 + p1 + p2 + p3));

    const zoneList = [
      {
        id: 'stationary',
        title: 'Stationary / Idle',
        speedLabel: '0 km/h',
        badgeColor: 'text-slate-400 bg-slate-800/60 border-slate-700/60',
        barColor: 'bg-slate-500',
        colorHex: '#64748b',
        durationSec: time0,
        percentage: p0,
        desc: 'Signal waits, pauses & pit-stops',
      },
      {
        id: 'low',
        title: 'Low Speed / Technical',
        speedLabel: `1 - ${t1} km/h`,
        badgeColor: 'text-sky-400 bg-sky-950/40 border-sky-800/50',
        barColor: 'bg-sky-400',
        colorHex: '#38bdf8',
        durationSec: timeLow,
        percentage: p1,
        desc: 'City traffic, junctions & tight turns',
      },
      {
        id: 'moderate',
        title: 'Moderate / Flow Pace',
        speedLabel: `${t1} - ${t2} km/h`,
        badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
        barColor: 'bg-emerald-500',
        colorHex: '#10b981',
        durationSec: timeMid,
        percentage: p2,
        desc: 'Arterial roads, sweeping curves & steady flow',
      },
      {
        id: 'brisk',
        title: 'Cruising / Open Pace',
        speedLabel: `${t2} - ${t3} km/h`,
        badgeColor: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
        barColor: 'bg-amber-500',
        colorHex: '#f59e0b',
        durationSec: timeBrisk,
        percentage: p3,
        desc: 'Open roadways & sustained highway cruising',
      },
      {
        id: 'high',
        title: 'High Speed / Bursts',
        speedLabel: `${t3}+ km/h`,
        badgeColor: 'text-rose-400 bg-rose-950/40 border-rose-800/50',
        barColor: 'bg-rose-500',
        colorHex: '#f43f5e',
        durationSec: timeHigh,
        percentage: p4,
        desc: `Fast open stretches up to ${maxSpd.toFixed(0)} km/h peak`,
      },
    ];

    return {
      thresholds: { t1, t2, t3 },
      zones: zoneList,
    };
  }, [analysis]);

  const totalDurationText = formatDuration(analysis.totalDurationSeconds);
  const haltsText = formatDuration(analysis.stoppedTimeSeconds);
  const movingText = formatDuration(analysis.movingTimeSeconds);
  const haltsPct = Math.round((analysis.stoppedTimeSeconds / Math.max(1, analysis.totalDurationSeconds)) * 100);
  const movingPct = 100 - haltsPct;

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const subBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#223140]';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-[#131b24] border-[#202d3d] hover:border-[#2f4259]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const barTrack = isLight ? 'bg-slate-200' : 'bg-[#1e2a38]';

  return (
    <div className={`w-full rounded-xl border p-4 sm:p-5 shadow-lg space-y-4 transition-colors ${cardBg}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className={`font-heading font-black text-sm sm:text-base tracking-wide uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Speed & Velocity Distribution
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/15 text-sky-500 border border-sky-500/30 rounded">
              {totalDurationText} Total Monitored
            </span>
          </div>
          <p className={`text-xs mt-1 ${subText}`}>
            Time distribution across dynamically calibrated speed zones based on your ride's maximum pace ({analysis.maxSpeedKmh.toFixed(1)} km/h).
          </p>
        </div>

        {/* Top Right Summary Pills */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${subBg}`}>
            <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
            <span className={subText}>Stationary: </span>
            <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{haltsText} ({haltsPct}%)</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${subBg}`}>
            <Gauge className="w-3.5 h-3.5 text-emerald-500" />
            <span className={subText}>Moving Throttle: </span>
            <span className="text-emerald-500 font-bold">{movingText} ({movingPct}%)</span>
          </div>
        </div>
      </div>

      {/* Cumulative Stacked Color Bar */}
      <div className="space-y-1.5 pt-1">
        <div className={`flex items-center justify-between text-[11px] font-mono ${subText}`}>
          <span>Velocity spectrum allocation:</span>
          <span className="text-sky-500 font-bold">100% Ride Monitored</span>
        </div>
        <div className={`w-full h-3 rounded-full overflow-hidden flex p-0.5 border ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#141d26] border-[#223140]'}`}>
          {zones.map(z => (
            <div
              key={z.id}
              style={{ width: `${Math.max(z.percentage, 1)}%` }}
              className={`h-full ${z.barColor} transition-all first:rounded-l-full last:rounded-r-full`}
              title={`${z.title} (${z.speedLabel}): ${formatDuration(z.durationSec)} (${z.percentage}%)`}
            />
          ))}
        </div>
      </div>

      {/* 5 Distinct Adaptive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
        {zones.map(z => (
          <div
            key={z.id}
            className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${itemBg}`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`} title={z.title}>
                  {z.title}
                </span>
                <span className={`px-1.5 py-0.5 text-[10px] font-mono font-extrabold border rounded ${z.badgeColor}`}>
                  {z.percentage}%
                </span>
              </div>
              
              <div className={`text-[11px] font-mono mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {z.speedLabel}
              </div>

              <div className={`font-mono font-black text-2xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {formatDuration(z.durationSec)}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className={`text-[11px] leading-tight line-clamp-2 ${subText}`}>
                {z.desc}
              </div>
              <div className={`w-full h-1.5 ${barTrack} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${z.barColor}`}
                  style={{ width: `${Math.min(100, Math.max(4, z.percentage))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
