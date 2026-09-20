import React, { useRef, useEffect, useState } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { X, Download, Share2, Sparkles } from 'lucide-react';

interface RideStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: RideAnalysis;
  theme?: AppTheme;
}

export const RideStoryModal: React.FC<RideStoryModalProps> = ({
  isOpen,
  onClose,
  analysis,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !analysis) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-resolution Canvas for Instagram Story / WhatsApp (1080 x 1350 - 4:5 portrait)
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // 1. Deep Dark Racing Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#060a0f');
    bgGrad.addColorStop(0.5, '#0c131c');
    bgGrad.addColorStop(1, '#05080c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle ambient neon glows
    const radialCyan = ctx.createRadialGradient(200, 200, 50, 200, 200, 600);
    radialCyan.addColorStop(0, 'rgba(14, 165, 233, 0.18)');
    radialCyan.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = radialCyan;
    ctx.fillRect(0, 0, W, H);

    const radialEmerald = ctx.createRadialGradient(W - 200, H - 300, 50, W - 200, H - 300, 600);
    radialEmerald.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
    radialEmerald.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = radialEmerald;
    ctx.fillRect(0, 0, W, H);

    // Subtle Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 60; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Outer Decorative Frame
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, W - 100, H - 100);

    // Top Header Badge
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.roundRect(80, 80, 360, 48, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🏍️ SASTA TRACKER • RIDE LOG', 105, 112);

    // Bike Model Tag (if any)
    const bikeLabel = (analysis.bikeModel || 'MOTORCYCLE').toUpperCase();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.beginPath();
    ctx.roundRect(W - 440, 80, 360, 48, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`⚡ ${bikeLabel}`, W - 105, 112);

    // Ride Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'left';
    const displayTitle = (analysis.name || 'Weekend Ride').toUpperCase();
    ctx.fillText(displayTitle.length > 30 ? displayTitle.slice(0, 30) + '...' : displayTitle, 80, 200);

    // Date & Time subtitle
    const dateStr = analysis.startTime
      ? new Date(analysis.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : 'Weekend Tour';
    const stopsStr = `${analysis.pitStops?.length || 0} Pit-Stops`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px monospace';
    ctx.fillText(`${dateStr}  •  ${stopsStr}`, 80, 240);

    // 2. Draw GPS Route Silhouette in the middle
    const pts = analysis.points;
    if (pts && pts.length > 10) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;
      pts.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lon < minLon) minLon = p.lon;
        if (p.lon > maxLon) maxLon = p.lon;
      });

      const routeBoxX = 100;
      const routeBoxY = 280;
      const routeBoxW = W - 200;
      const routeBoxH = 460;

      // Silhouette Background card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.beginPath();
      ctx.roundRect(routeBoxX, routeBoxY, routeBoxW, routeBoxH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.stroke();

      const latSpan = Math.max(0.0001, maxLat - minLat);
      const lonSpan = Math.max(0.0001, maxLon - minLon);
      const padding = 50;
      const drawW = routeBoxW - padding * 2;
      const drawH = routeBoxH - padding * 2;
      const scale = Math.min(drawW / lonSpan, drawH / latSpan);

      const offsetX = routeBoxX + (routeBoxW - lonSpan * scale) / 2;
      const offsetY = routeBoxY + (routeBoxH - latSpan * scale) / 2;

      // Glow Underline
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = offsetX + (p.lon - minLon) * scale;
        const y = offsetY + (maxLat - p.lat) * scale;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Main Speed-gradient Route Line
      const routeGrad = ctx.createLinearGradient(routeBoxX, routeBoxY, routeBoxX + routeBoxW, routeBoxY + routeBoxH);
      routeGrad.addColorStop(0, '#38bdf8');
      routeGrad.addColorStop(0.5, '#22c55e');
      routeGrad.addColorStop(1, '#f43f5e');

      ctx.strokeStyle = routeGrad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = offsetX + (p.lon - minLon) * scale;
        const y = offsetY + (maxLat - p.lat) * scale;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Start & Finish Dots
      const startX = offsetX + (pts[0].lon - minLon) * scale;
      const startY = offsetY + (maxLat - pts[0].lat) * scale;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(startX, startY, 10, 0, Math.PI * 2);
      ctx.fill();

      const endX = offsetX + (pts[pts.length - 1].lon - minLon) * scale;
      const endY = offsetY + (maxLat - pts[pts.length - 1].lat) * scale;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(endX, endY, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Four Big Telemetry Badges (2 x 2 Grid)
    const metricsY = 780;
    const cardW = (W - 240) / 2;
    const cardH = 170;

    const movingHrs = Math.floor(analysis.movingTimeSeconds / 3600);
    const movingMins = Math.floor((analysis.movingTimeSeconds % 3600) / 60);
    const movingTimeStr = movingHrs > 0 ? `${movingHrs}h ${movingMins}m` : `${movingMins}m`;

    const metrics = [
      {
        label: 'TOTAL RUN',
        val: `${analysis.totalDistanceKm.toFixed(1)}`,
        unit: 'KM',
        color: '#38bdf8',
        sub: `${analysis.segments?.length || 1} segments`,
        x: 80,
        y: metricsY,
      },
      {
        label: 'SADDLE TIME',
        val: movingTimeStr,
        unit: 'MOVING',
        color: '#34d399',
        sub: `${Math.round((analysis.movingTimeSeconds / Math.max(1, analysis.totalDurationSeconds)) * 100)}% saddle pace`,
        x: 80 + cardW + 40,
        y: metricsY,
      },
      {
        label: 'TOP VELOCITY',
        val: `${analysis.maxSpeedKmh.toFixed(0)}`,
        unit: 'KM/H',
        color: '#f43f5e',
        sub: `Avg: ${analysis.movingAvgSpeedKmh.toFixed(1)} km/h`,
        x: 80,
        y: metricsY + cardH + 30,
      },
      {
        label: 'MAX LEAN ANGLE',
        val: `${Math.round(analysis.maxEstimatedLean || 38)}°`,
        unit: 'ROLL',
        color: '#fbbf24',
        sub: 'Apex cornering tilt',
        x: 80 + cardW + 40,
        y: metricsY + cardH + 30,
      },
    ];

    metrics.forEach(m => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(m.x, m.y, cardW, cardH, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Metric Header
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, m.x + 24, m.y + 38);

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 52px sans-serif';
      ctx.fillText(m.val, m.x + 24, m.y + 105);

      // Unit
      ctx.fillStyle = m.color;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(` ${m.unit}`, m.x + 24 + ctx.measureText(m.val).width + 8, m.y + 98);

      // Subtext
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 18px monospace';
      ctx.fillText(m.sub, m.x + 24, m.y + 142);
    });

    // 4. Bottom Footer Watermark & Branding
    const footerY = H - 120;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ TRACKED WITH SASTA TRACKER • 100% FREE & PRIVATE MOTORCYCLE GPS', W / 2, footerY);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('sasta-tracker.vercel.app', W / 2, footerY + 32);

    setDataUrl(canvas.toDataURL('image/png'));
  }, [isOpen, analysis]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(analysis.name || 'ride_story').replace(/\s+/g, '_')}_story.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${(analysis.name || 'ride').replace(/\s+/g, '_')}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: analysis.name || 'My Motorcycle Ride',
          text: `Check out my ride stats on Sasta Tracker: ${analysis.totalDistanceKm.toFixed(1)} km, Max ${analysis.maxSpeedKmh.toFixed(0)} km/h!`,
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f14] border border-[#1e2a38] text-white rounded-2xl w-full max-w-lg max-h-[92dvh] overscroll-contain flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e2a38] flex items-center justify-between bg-[#111922]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h3 className="font-heading font-black text-sm uppercase tracking-wider">
              Share Ride Story
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Preview */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center space-y-3">
          <canvas ref={canvasRef} className="hidden" />
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Ride Story Card"
              className="rounded-xl shadow-2xl border border-slate-700/60 max-h-[60vh] w-auto object-contain"
            />
          ) : (
            <div className="py-20 text-slate-500 font-mono text-xs">Generating story badge...</div>
          )}
          <p className="text-[11px] font-mono text-slate-400 text-center">
            Ready to post on Instagram Stories, WhatsApp Status, or send to riding groups!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-3.5 border-t border-[#1e2a38] bg-[#111922] flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Save Image</span>
          </button>

          <button
            onClick={handleShare}
            className="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share to App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
