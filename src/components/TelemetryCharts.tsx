import React, { useRef, useMemo } from 'react';
import { RideAnalysis, AppTheme, UnitSystem } from '../types';
import { Mountain, Zap, MoveHorizontal } from 'lucide-react';

interface TelemetryChartsProps {
  analysis: RideAnalysis;
  scrubIndex: number | null;
  onScrubChange: (index: number | null) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  analysis,
  scrubIndex,
  onScrubChange,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const elevChartRef = useRef<SVGSVGElement>(null);
  const speedChartRef = useRef<SVGSVGElement>(null);

  const points = analysis.points || [];

  // Max steep climb slope encountered during ride (computed before any early return)
  const maxGradientPct = useMemo(() => {
    if (!points || points.length < 5) return null;
    let maxSlope = 0;
    for (let i = 2; i < points.length - 2; i += 2) {
      const p1 = points[i - 2];
      const p2 = points[i + 2];
      if (p1.ele !== null && p2.ele !== null) {
        const dDist = (p2.distanceFromStartKm - p1.distanceFromStartKm) * 1000;
        if (dDist >= 15) {
          const slope = ((p2.ele - p1.ele) / dDist) * 100;
          if (slope > maxSlope && slope <= 35) {
            maxSlope = slope;
          }
        }
      }
    }
    return maxSlope > 1.5 ? Math.round(maxSlope * 10) / 10 : null;
  }, [points]);

  if (points.length < 2) return null;

  const totalDist = analysis.totalDistanceKm || 1;
  const maxSpeed = Math.max(analysis.maxSpeedKmh, 50);
  const rawMinElev = analysis.elevMinM !== null ? analysis.elevMinM : 0;
  const rawMaxElev = analysis.elevMaxM !== null ? analysis.elevMaxM : 500;
  const minElev = Math.max(0, Math.floor((rawMinElev - 20) / 25) * 25);
  const maxElev = Math.ceil((rawMaxElev + 25) / 25) * 25;
  const elevRange = Math.max(maxElev - minElev, 40);

  // SVG Chart Dimensions
  const svgWidth = 540;
  const svgHeight = 250;
  const padding = { top: 25, right: 25, bottom: 45, left: 50 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Coordinate generators
  const getX = (distKm: number) => padding.left + (distKm / totalDist) * graphWidth;

  // Sample points for clean, smooth SVG rendering
  const sampledIndices: number[] = [];
  const sampleCount = Math.min(points.length, 120);
  const step = Math.max(1, Math.floor(points.length / sampleCount));
  for (let i = 0; i < points.length; i += step) {
    sampledIndices.push(i);
  }
  if (sampledIndices[sampledIndices.length - 1] !== points.length - 1) {
    sampledIndices.push(points.length - 1);
  }

  // Elevation Path & Area
  const elevCoords = sampledIndices.map(idx => {
    const p = points[idx];
    const x = getX(p.distanceFromStartKm);
    const ele = p.ele !== null ? p.ele : minElev;
    const y = padding.top + graphHeight - ((ele - minElev) / elevRange) * graphHeight;
    return { x, y, p, idx };
  });

  const elevPathStr = `M ${elevCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')}`;
  const elevAreaStr = `M ${padding.left},${padding.top + graphHeight} L ${elevCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')} L ${getX(totalDist)},${padding.top + graphHeight} Z`;

  // Speed Path & Area
  const speedCoords = sampledIndices.map(idx => {
    const p = points[idx];
    const x = getX(p.distanceFromStartKm);
    const y = padding.top + graphHeight - (p.speedKmh / maxSpeed) * graphHeight;
    return { x, y, p, idx };
  });

  const speedPathStr = `M ${speedCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')}`;
  const speedAreaStr = `M ${padding.left},${padding.top + graphHeight} L ${speedCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')} L ${getX(totalDist)},${padding.top + graphHeight} Z`;

  // Key dots
  const keyElevDots = sampledIndices
    .filter((_, i) => i % Math.max(1, Math.floor(sampledIndices.length / 8)) === 0 || i === sampledIndices.length - 1)
    .map(idx => {
      const p = points[idx];
      const x = getX(p.distanceFromStartKm);
      const ele = p.ele !== null ? p.ele : minElev;
      const y = padding.top + graphHeight - ((ele - minElev) / elevRange) * graphHeight;
      return { x, y, p };
    });

  const keySpeedDots = sampledIndices
    .filter((_, i) => i % Math.max(1, Math.floor(sampledIndices.length / 8)) === 0 || i === sampledIndices.length - 1)
    .map(idx => {
      const p = points[idx];
      const x = getX(p.distanceFromStartKm);
      const y = padding.top + graphHeight - (p.speedKmh / maxSpeed) * graphHeight;
      return { x, y, p };
    });

  // Universal scrub calculation from clientX
  const updateScrubFromClientX = (clientX: number, targetSvg: SVGSVGElement | null) => {
    if (!targetSvg) return;
    const rect = targetSvg.getBoundingClientRect();
    const touchX = clientX - rect.left;
    const normalizedX = (touchX / rect.width) * svgWidth;
    const relativeX = Math.max(0, Math.min(graphWidth, normalizedX - padding.left));
    const targetDist = (relativeX / graphWidth) * totalDist;

    // Find closest point by distance
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].distanceFromStartKm - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    onScrubChange(closestIndex);
  };

  // Pointer event handlers (scrub on click/drag/touch, never passive mouse hover)
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>, targetRef: React.RefObject<SVGSVGElement | null>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    updateScrubFromClientX(e.clientX, targetRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>, targetRef: React.RefObject<SVGSVGElement | null>) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    updateScrubFromClientX(e.clientX, targetRef.current);
  };

  // Touch event handlers (mobile touch swipe gestures)
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>, targetRef: React.RefObject<SVGSVGElement | null>) => {
    if (e.touches && e.touches.length > 0) {
      updateScrubFromClientX(e.touches[0].clientX, targetRef.current);
    }
  };

  const activePt = scrubIndex !== null ? points[scrubIndex] : null;
  const scrubX = activePt ? getX(activePt.distanceFromStartKm) : null;
  const scrubElevY = activePt
    ? padding.top + graphHeight - (((activePt.ele !== null ? activePt.ele : minElev) - minElev) / elevRange) * graphHeight
    : null;
  const scrubSpeedY = activePt
    ? padding.top + graphHeight - (activePt.speedKmh / maxSpeed) * graphHeight
    : null;

  const xTickSteps = [0.05, 0.2, 0.4, 0.6, 0.8, 1];
  const xTicks = xTickSteps.map(f => (f * totalDist).toFixed(1));

  const elevYTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(minElev + elevRange * (1 - f)));
  const speedYTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxSpeed * (1 - f)));

  // Road gradient / slope % calculation for active scrub point
  const getGradientPercent = (idx: number | null): number | null => {
    if (idx === null || !points || points.length < 2) return null;
    const startIdx = Math.max(0, idx - 2);
    const endIdx = Math.min(points.length - 1, idx + 2);
    if (startIdx === endIdx) return null;
    const p1 = points[startIdx];
    const p2 = points[endIdx];
    if (p1.ele === null || p2.ele === null) return null;
    const deltaElevM = p2.ele - p1.ele;
    const deltaDistM = (p2.distanceFromStartKm - p1.distanceFromStartKm) * 1000;
    if (deltaDistM < 5) return null;
    const slope = (deltaElevM / deltaDistM) * 100;
    return Math.max(-35, Math.min(35, Math.round(slope * 10) / 10));
  };

  const activeGradient = getGradientPercent(scrubIndex);
  const elevMaxVal = analysis.elevMaxM !== null && analysis.elevMaxM !== undefined ? Math.round(analysis.elevMaxM) : null;
  const elevGainVal = Math.round(analysis.elevGainM ?? 0);

  // Theme-specific colors
  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#1e2a38]';
  const subText = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const gridLineColor = isLight ? '#e2e8f0' : '#141d26';
  const axisTextColor = isLight ? '#475569' : '#8f9ca8';
  const tooltipBg = isLight ? '#ffffff' : '#0d131a';
  const tooltipText = isLight ? '#0f172a' : '#ffffff';

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 telemetry-num">
      {/* 1. ELEVATION & ALTITUDE PROFILE */}
      <div className={`rounded-xl border p-4 shadow-lg space-y-3 transition-colors ${cardBg}`}>
        {/* Header */}
        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-2">
            <Mountain className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
            <span className="font-heading font-black text-xs uppercase tracking-wider">
              Elevation &amp; Altitude Profile
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
            <span>
              <strong className={`font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{elevMaxVal ?? '—'} m</strong> peak
            </span>
            <span className={subText}>•</span>
            <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>+{elevGainVal} m</span>
            {maxGradientPct !== null && (
              <>
                <span className={subText}>•</span>
                <span className={`font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`} title="Maximum sustained road climb grade">
                  {maxGradientPct}% climb
                </span>
              </>
            )}
          </div>
        </div>

        {/* Mobile touch hint */}
        <div className="flex items-center justify-between text-[11px] font-sans px-1">
          <span className={`flex items-center gap-1 ${subText}`}>
            <MoveHorizontal className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
            <span>Click or swipe anywhere to inspect route point</span>
          </span>
          {activePt && (
            <span className={`font-mono font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              {activePt.distanceFromStartKm.toFixed(1)} km mark
              {activeGradient !== null && (
                <span className={activeGradient > 0 ? (isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400 font-semibold') : activeGradient < 0 ? (isLight ? 'text-rose-700 font-semibold' : 'text-rose-400 font-semibold') : ''}>
                  {' '}({activeGradient > 0 ? `+${activeGradient}%` : `${activeGradient}%`} grade)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Interactive SVG Surface */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            ref={elevChartRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={e => handlePointerDown(e, elevChartRef)}
            onPointerMove={e => handlePointerMove(e, elevChartRef)}
            onTouchStart={e => handleTouchMove(e, elevChartRef)}
            onTouchMove={e => handleTouchMove(e, elevChartRef)}
          >
            <defs>
              <linearGradient id="chartElevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={isLight ? '0.35' : '0.45'} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
              <line
                key={idx}
                x1={padding.left}
                y1={padding.top + f * graphHeight}
                x2={padding.left + graphWidth}
                y2={padding.top + f * graphHeight}
                stroke={gridLineColor}
                strokeWidth="1"
              />
            ))}

            {/* Y Axis Label and Ticks */}
            <text
              transform="rotate(-90)"
              x={-(padding.top + graphHeight / 2)}
              y="16"
              fill={axisTextColor}
              fontSize="10"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Altitude (m)
            </text>

            {elevYTicks.map((val, idx) => {
              const y = padding.top + (idx / 4) * graphHeight;
              return (
                <text
                  key={idx}
                  x={padding.left - 8}
                  y={y + 3}
                  fill={axisTextColor}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              );
            })}

            {/* Filled Area */}
            <path d={elevAreaStr} fill="url(#chartElevGrad)" />

            {/* Glowing Stroke Line */}
            <path
              d={elevPathStr}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Highlight dots along line */}
            {keyElevDots.map((dot, idx) => (
              <circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r="3"
                fill="#38bdf8"
                stroke={isLight ? '#ffffff' : '#0d131a'}
                strokeWidth="1.5"
              />
            ))}

            {/* Interactive Scrubber Indicator */}
            {scrubX !== null && scrubElevY !== null && (
              <g>
                <line
                  x1={scrubX}
                  y1={padding.top}
                  x2={scrubX}
                  y2={padding.top + graphHeight}
                  stroke={isLight ? '#0284c7' : '#ffffff'}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={scrubX}
                  cy={scrubElevY}
                  r="6"
                  fill="#38bdf8"
                  stroke={isLight ? '#ffffff' : '#000000'}
                  strokeWidth="2.5"
                />
                {activePt && (
                  <g>
                    <rect
                      x={Math.min(svgWidth - (activeGradient !== null ? 116 : 82), Math.max(padding.left, scrubX - (activeGradient !== null ? 58 : 41)))}
                      y={padding.top - 20}
                      width={activeGradient !== null ? 116 : 82}
                      height="20"
                      rx="4"
                      fill={tooltipBg}
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.min(svgWidth - (activeGradient !== null ? 58 : 41), Math.max(padding.left + (activeGradient !== null ? 58 : 41), scrubX))}
                      y={padding.top - 6}
                      fill={tooltipText}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {activePt.ele !== null ? `${Math.round(activePt.ele)} m` : '—'}
                      {activeGradient !== null ? ` • ${activeGradient > 0 ? `+${activeGradient}%` : `${activeGradient}%`}` : ''}
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* X Axis distance ticks */}
            {xTickSteps.map((frac, idx) => {
              const x = padding.left + graphWidth * frac;
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={padding.top + graphHeight}
                    x2={x}
                    y2={padding.top + graphHeight + 4}
                    stroke={gridLineColor}
                  />
                  <text
                    x={x}
                    y={padding.top + graphHeight + 16}
                    fill={axisTextColor}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {xTicks[idx]}
                  </text>
                </g>
              );
            })}

            <text
              x={padding.left + graphWidth / 2}
              y={svgHeight - 8}
              fill={axisTextColor}
              fontSize="10"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Track Distance (KM)
            </text>
          </svg>
        </div>
      </div>

      {/* 2. SPEED & VELOCITY PROFILE */}
      <div className={`rounded-xl border p-4 shadow-lg space-y-3 transition-colors ${cardBg}`}>
        {/* Header */}
        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-500" />
            <span className="font-heading font-black text-xs uppercase tracking-wider">
              Speed &amp; Velocity Profile
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span>
              <strong className={`font-bold ${isLight ? 'text-rose-700' : 'text-rose-500'}`}>{analysis.maxSpeedKmh.toFixed(1)}</strong> km/h peak
            </span>
            <span className={subText}>•</span>
            <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{analysis.movingAvgSpeedKmh.toFixed(1)} km/h avg</span>
          </div>
        </div>

        {/* Mobile touch hint */}
        <div className="flex items-center justify-between text-[11px] font-sans px-1">
          <span className={`flex items-center gap-1 ${subText}`}>
            <MoveHorizontal className={`w-3.5 h-3.5 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
            <span>Click or swipe anywhere to inspect speed</span>
          </span>
          {activePt && (
            <span className={`font-mono font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
              {activePt.speedKmh.toFixed(1)} km/h
            </span>
          )}
        </div>

        {/* Interactive SVG Surface */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            ref={speedChartRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={e => handlePointerDown(e, speedChartRef)}
            onPointerMove={e => handlePointerMove(e, speedChartRef)}
            onTouchStart={e => handleTouchMove(e, speedChartRef)}
            onTouchMove={e => handleTouchMove(e, speedChartRef)}
          >
            <defs>
              <linearGradient id="chartSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={isLight ? '0.35' : '0.45'} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
              <line
                key={idx}
                x1={padding.left}
                y1={padding.top + f * graphHeight}
                x2={padding.left + graphWidth}
                y2={padding.top + f * graphHeight}
                stroke={gridLineColor}
                strokeWidth="1"
              />
            ))}

            {/* Y Axis Label and Ticks */}
            <text
              transform="rotate(-90)"
              x={-(padding.top + graphHeight / 2)}
              y="16"
              fill={axisTextColor}
              fontSize="10"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Speed (KM/H)
            </text>

            {speedYTicks.map((val, idx) => {
              const y = padding.top + (idx / 4) * graphHeight;
              return (
                <text
                  key={idx}
                  x={padding.left - 8}
                  y={y + 3}
                  fill={axisTextColor}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              );
            })}

            {/* Filled Area */}
            <path d={speedAreaStr} fill="url(#chartSpeedGrad)" />

            {/* Glowing Stroke Line */}
            <path
              d={speedPathStr}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Highlight dots along line */}
            {keySpeedDots.map((dot, idx) => (
              <circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r="3"
                fill="#f43f5e"
                stroke={isLight ? '#ffffff' : '#0d131a'}
                strokeWidth="1.5"
              />
            ))}

            {/* Interactive Scrubber Indicator */}
            {scrubX !== null && scrubSpeedY !== null && (
              <g>
                <line
                  x1={scrubX}
                  y1={padding.top}
                  x2={scrubX}
                  y2={padding.top + graphHeight}
                  stroke={isLight ? '#e11d48' : '#ffffff'}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={scrubX}
                  cy={scrubSpeedY}
                  r="6"
                  fill="#f43f5e"
                  stroke={isLight ? '#ffffff' : '#000000'}
                  strokeWidth="2.5"
                />
                {activePt && (
                  <g>
                    <rect
                      x={Math.min(svgWidth - 92, Math.max(padding.left, scrubX - 46))}
                      y={padding.top - 20}
                      width="92"
                      height="20"
                      rx="4"
                      fill={tooltipBg}
                      stroke="#f43f5e"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.min(svgWidth - 46, Math.max(padding.left + 46, scrubX))}
                      y={padding.top - 6}
                      fill={tooltipText}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {activePt.speedKmh.toFixed(1)} km/h
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* X Axis distance ticks */}
            {xTickSteps.map((frac, idx) => {
              const x = padding.left + graphWidth * frac;
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={padding.top + graphHeight}
                    x2={x}
                    y2={padding.top + graphHeight + 4}
                    stroke={gridLineColor}
                  />
                  <text
                    x={x}
                    y={padding.top + graphHeight + 16}
                    fill={axisTextColor}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {xTicks[idx]}
                  </text>
                </g>
              );
            })}

            <text
              x={padding.left + graphWidth / 2}
              y={svgHeight - 8}
              fill={axisTextColor}
              fontSize="10"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              Track Distance (KM)
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};
