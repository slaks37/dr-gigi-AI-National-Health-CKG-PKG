'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Activity, 
  Layers, 
  Eye, 
  EyeOff, 
  Sliders, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  Maximize2,
  Download,
  Flame,
  Sparkles
} from 'lucide-react';

interface PosturalSpineHeatmapOverlayProps {
  imageUrl: string;
  imageIndex?: number;
  severityScore?: number; // 0 to 10 scale
  condition?: string; // e.g. 'Skoliosis', 'Kifosis', 'Normal', 'Asimetri Bahu'
  location?: string; // e.g. 'Thoracic', 'Lumbar', 'Thoracolumbar'
  cobbAngleEst?: string; // e.g. '15° - 20°'
  findings?: Array<{
    medis?: string;
    icd10?: string;
    confidence_score?: string;
    lokasi_sakit?: {
      ymin: number;
      xmin: number;
      ymax: number;
      xmax: number;
    };
  }>;
}

export default function PosturalSpineHeatmapOverlay({
  imageUrl,
  imageIndex = 0,
  severityScore = 0,
  condition = 'Normal',
  location = 'Thoracic / Lumbar',
  cobbAngleEst,
  findings = []
}: PosturalSpineHeatmapOverlayProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSpineCurve, setShowSpineCurve] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [selectedVertebra, setSelectedVertebra] = useState<string | null>(null);

  // Normalize score between 0 and 10
  const score = Math.max(0, Math.min(10, Number(severityScore) || 0));

  // Determine severity tier
  let severityTier: {
    label: string;
    color: string;
    bg: string;
    border: string;
    desc: string;
  };

  if (score <= 3.0) {
    severityTier = {
      label: 'Ringan / Fisiologis Normal',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      desc: 'Kelengkungan tulang belakang dalam batas normal simetris. Tidak tampak deviasi patologis bermakna.'
    };
  } else if (score <= 6.5) {
    severityTier = {
      label: 'Deviasi Sedang (Moderate)',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      desc: 'Terdapat asimetri bahu/panggul atau deviasi kurvatura tulang belakang (dugaan skoliosis/kifosis ringan-sedang). Disarankan latihan postur & evaluasi berkala.'
    };
  } else {
    severityTier = {
      label: 'Signifikan / Berat (Severe)',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      desc: 'Deviasi postural tajam terdeteksi dengan potensi dekompensasi struktural atau sudut Cobb > 20°. Dianjurkan rujukan foto Rontgen Spina AP/Lateral dan konsultasi Spesialis Ortopedi.'
    };
  }

  // Calculate spine curve points based on severity and condition
  // Standard spine levels from neck (top ~18%) down to pelvis (bottom ~82%)
  const curveDirection = condition.toLowerCase().includes('kiri') ? -1 : 1;
  const deviationMagnitude = (score / 10) * 16 * curveDirection; // percentage offset from midline (50%)

  const vertebraeNodes = [
    { id: 'C7', name: 'Cervical C7 (Pangkal Leher)', y: 18, x: 50, localScore: Math.min(10, score * 0.4) },
    { id: 'T3', name: 'Upper Thoracic T3 (Bahu Atas)', y: 30, x: 50 + deviationMagnitude * 0.6, localScore: Math.min(10, score * 0.7) },
    { id: 'T8', name: 'Mid Thoracic T8 (Punggung Tengah)', y: 45, x: 50 + deviationMagnitude * 1.0, localScore: score },
    { id: 'L1', name: 'Thoracolumbar L1 (Pinggang Atas)', y: 60, x: 50 + deviationMagnitude * 0.8, localScore: Math.min(10, score * 0.85) },
    { id: 'L4', name: 'Lumbar L4 (Pinggang Bawah)', y: 72, x: 50 + deviationMagnitude * 0.3, localScore: Math.min(10, score * 0.5) },
    { id: 'S1', name: 'Sacrum S1 (Basis Panggul)', y: 84, x: 50, localScore: Math.min(10, score * 0.3) }
  ];

  // Generate SVG bezier path for the spine
  const pathD = `M ${vertebraeNodes[0].x} ${vertebraeNodes[0].y} ` +
    `Q ${vertebraeNodes[1].x} ${vertebraeNodes[1].y}, ${vertebraeNodes[2].x} ${vertebraeNodes[2].y} ` +
    `T ${vertebraeNodes[4].x} ${vertebraeNodes[4].y} ` +
    `T ${vertebraeNodes[5].x} ${vertebraeNodes[5].y}`;

  // Helper for node color by score
  const getNodeColor = (nodeScore: number) => {
    if (nodeScore <= 3.0) return '#10b981'; // green
    if (nodeScore <= 6.5) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="text-orange-500" size={22} />
            <h3 className="font-bold text-base sm:text-lg text-slate-800">
              Visualisasi Heatmap Postur & Tulang Belakang (Spine Vision AI)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Analisis gradien warna keparahan deviasi kurvatura vertebra (C1–S1) & simetri postural
          </p>
        </div>

        {/* Severity Score Badge */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 shrink-0 ${severityTier.bg} ${severityTier.border}`}>
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Postural Severity</span>
            <span className={`text-sm font-black ${severityTier.color}`}>
              {score.toFixed(1)} <span className="text-xs font-semibold text-slate-500">/ 10</span>
            </span>
          </div>
          <div className="h-7 w-[1px] bg-slate-200" />
          <span className={`text-xs font-bold ${severityTier.color}`}>
            {condition}
          </span>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Center: Photo Viewport with Overlays */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 w-full max-w-sm shadow-xl border border-slate-800 select-none">
            
            {/* Background Patient Photo */}
            <Image 
              src={imageUrl} 
              alt="Foto Postur Pasien" 
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              className="object-contain" 
              unoptimized
            />

            {/* Layer 1: Color-Coded Heatmap Overlay (Gaussian Radial Blurs along the Spine) */}
            {showHeatmap && (
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-screen"
                style={{ opacity: opacity }}
              >
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    {/* Radial Heat Gradients for each spine segment */}
                    <radialGradient id="heatGreen" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                      <stop offset="60%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </radialGradient>

                    <radialGradient id="heatYellow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#eab308" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#f97316" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                    </radialGradient>

                    <radialGradient id="heatRed" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#dc2626" stopOpacity="0.5" />
                      <stop offset="80%" stopColor="#9333ea" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Render Heat Emission Zones centered at vertebrae nodes */}
                  {vertebraeNodes.map((node) => {
                    const grad = node.localScore <= 3.0 ? 'url(#heatGreen)' : node.localScore <= 6.5 ? 'url(#heatYellow)' : 'url(#heatRed)';
                    // Radius expands based on score
                    const rx = 10 + (node.localScore / 10) * 12;
                    const ry = 8 + (node.localScore / 10) * 8;
                    return (
                      <ellipse 
                        key={`heat-${node.id}`}
                        cx={`${node.x}%`} 
                        cy={`${node.y}%`} 
                        rx={`${rx}%`} 
                        ry={`${ry}%`} 
                        fill={grad} 
                      />
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Layer 2: Anatomical Spine Axis Line & Vertebrae Anchor Pins */}
            {showSpineCurve && (
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-auto" 
                viewBox="0 0 100 100" 
                preserveAspectRatio="none"
              >
                {/* Midline Reference Guide (Dashed Ideal Spine) */}
                <line 
                  x1="50" 
                  y1="15" 
                  x2="50" 
                  y2="88" 
                  stroke="rgba(255, 255, 255, 0.35)" 
                  strokeWidth="0.6" 
                  strokeDasharray="1.5,1.5" 
                />

                {/* Patient Actual Spine Curvature Line */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={getNodeColor(score)} 
                  strokeWidth="1.6" 
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                />

                {/* Interactive Vertebrae Pins */}
                {vertebraeNodes.map((node) => {
                  const isSelected = selectedVertebra === node.id;
                  const nodeColor = getNodeColor(node.localScore);

                  return (
                    <g 
                      key={node.id} 
                      className="cursor-pointer"
                      onClick={() => setSelectedVertebra(isSelected ? null : node.id)}
                    >
                      {/* Pulse effect if selected or high severity */}
                      {node.localScore > 5.0 && (
                        <circle 
                          cx={`${node.x}%`} 
                          cy={`${node.y}%`} 
                          r="3.5" 
                          fill="none" 
                          stroke={nodeColor} 
                          strokeWidth="0.8" 
                          className="animate-ping"
                          style={{ transformOrigin: `${node.x}% ${node.y}%` }}
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle 
                        cx={`${node.x}%`} 
                        cy={`${node.y}%`} 
                        r={isSelected ? '2.4' : '1.8'} 
                        fill={nodeColor} 
                        stroke="#ffffff" 
                        strokeWidth="0.8" 
                        className="transition-all hover:scale-125"
                      />

                      {/* Vertebrae Tag Text */}
                      <text 
                        x={`${node.x + 3}%`} 
                        y={`${node.y + 0.8}%`} 
                        fill="#ffffff" 
                        fontSize="2.8" 
                        fontWeight="bold"
                        className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none"
                      >
                        {node.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Layer 3: Clinical Bounding Boxes (if any) */}
            {showBoundingBoxes && findings.map((finding, idx) => {
              if (!finding.lokasi_sakit) return null;
              const { ymin, xmin, ymax, xmax } = finding.lokasi_sakit;
              if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) return null;

              return (
                <div 
                  key={idx}
                  className="absolute border-2 border-orange-400 bg-orange-500/10 shadow-[0_0_8px_rgba(251,146,60,0.6)] pointer-events-none rounded"
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                    {finding.medis || 'Deviasi Postur'}
                  </span>
                </div>
              );
            })}

            {/* Overlay Status Tag */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white flex items-center gap-1.5 border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Spine AI Vision
            </div>
          </div>

          {/* Opacity & View Toggle Bar below image */}
          <div className="w-full max-w-sm mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span className="font-semibold flex items-center gap-1.5">
                <Sliders size={13} className="text-slate-500" />
                Opasitas Heatmap: {Math.round(opacity * 100)}%
              </span>
              <input 
                type="range" 
                min="0.2" 
                max="1.0" 
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-28 accent-orange-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 text-[11px]">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium border flex items-center justify-center gap-1 transition-all ${
                  showHeatmap 
                    ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <Flame size={12} /> Heatmap
              </button>

              <button
                onClick={() => setShowSpineCurve(!showSpineCurve)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium border flex items-center justify-center gap-1 transition-all ${
                  showSpineCurve 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <Activity size={12} /> Kurva Spina
              </button>

              <button
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium border flex items-center justify-center gap-1 transition-all ${
                  showBoundingBoxes 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <Layers size={12} /> Bounding Box
              </button>
            </div>
          </div>
        </div>

        {/* Right: Clinical Posture & Heatmap Analysis Panel */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Heatmap Color Gradient Scale & Legend */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Info size={14} className="text-slate-500" />
              Skala Gradien Keparahan (Severity Heatmap Legend)
            </h4>

            {/* Gradient Bar */}
            <div className="h-3.5 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-red-600 shadow-inner relative">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow-md transition-all"
                style={{ left: `calc(${Math.min(95, Math.max(5, score * 10))}% - 8px)` }}
                title={`Skor Pasien: ${score.toFixed(1)}`}
              />
            </div>

            <div className="flex justify-between text-[10px] font-semibold text-slate-500 pt-0.5">
              <span className="text-emerald-700">0–3: Normal</span>
              <span className="text-amber-700">4–6: Sedang</span>
              <span className="text-red-700">7–10: Berat</span>
            </div>
          </div>

          {/* Diagnostic Interpretation Card */}
          <div className={`p-4 rounded-xl border space-y-2.5 ${severityTier.bg} ${severityTier.border}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600">Hasil Skrining Postur</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white border ${severityTier.border} ${severityTier.color}`}>
                {severityTier.label}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {severityTier.desc}
            </p>
          </div>

          {/* Anatomical Vertebrae Detail Breakdown */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Segmentasi Vertebrae & Ketegangan Kurvatura</span>
              <span className="text-[10px] text-slate-400 font-normal">Klik titik pin pada gambar</span>
            </h4>

            <div className="space-y-1.5">
              {vertebraeNodes.map((node) => {
                const isSelected = selectedVertebra === node.id;
                const nodeColor = getNodeColor(node.localScore);

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedVertebra(isSelected ? null : node.id)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-300' 
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: nodeColor }}
                      />
                      <span className="font-bold text-slate-800">{node.id}</span>
                      <span className="text-slate-500 text-[11px] truncate max-w-[140px]">{node.name.split('(')[1]?.replace(')', '') || node.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        Skor: {node.localScore.toFixed(1)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        node.localScore <= 3.0 ? 'bg-emerald-100 text-emerald-800' : node.localScore <= 6.5 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {node.localScore <= 3.0 ? 'Normal' : node.localScore <= 6.5 ? 'Defleksi' : 'Kritis'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations & Follow-Up */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles size={14} className="text-orange-500" />
              Rekomendasi Tindakan Postural
            </h5>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Lakukan latihan penguatan otot <em>core</em> dan peregangan paravertebral 3x seminggu.</li>
              <li>Pastikan posisi duduk ergonomis saat bekerja / belajar (layar sejajar mata, sandaran punggung tegak).</li>
              {score > 6.0 && (
                <li className="font-bold text-red-700">
                  Konsultasikan hasil heatmap ini ke Dokter Spesialis Kedokteran Fisik & Rehabilitasi (Sp.KFR) atau Ortopedi.
                </li>
              )}
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
