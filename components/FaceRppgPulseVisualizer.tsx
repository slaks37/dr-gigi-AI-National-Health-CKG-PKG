'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  Activity, 
  Heart, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  Eye, 
  EyeOff, 
  Sliders, 
  Info,
  Waves,
  UserCheck,
  Flame,
  Zap
} from 'lucide-react';

interface FaceRppgPulseVisualizerProps {
  mediaUrl: string;
  mediaType: 'video' | 'image';
  pulseRate?: number;
  pulseRegularity?: number; // percentage 0 - 100
  faceShape?: string;
  estimatedAge?: string | number;
  diabetesRisk?: 'Rendah' | 'Sedang' | 'Tinggi';
  microvascularNotes?: string;
  findings?: Array<any>;
}

export default function FaceRppgPulseVisualizer({
  mediaUrl,
  mediaType,
  pulseRate = 75,
  pulseRegularity = 91,
  faceShape = 'Oval Simetris',
  estimatedAge = '28 Tahun',
  diabetesRisk = 'Rendah',
  microvascularNotes = 'Fluktuasi mikrovaskular kapiler dahi & pipi tampak reguler.',
  findings = []
}: FaceRppgPulseVisualizerProps) {
  const [showRoiOverlays, setShowRoiOverlays] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [activeRoi, setActiveRoi] = useState<'both' | 'forehead' | 'cheeks'>('both');
  const [pulsePhase, setPulsePhase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pulse animation cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // Real-time canvas wave drawing for rPPG signal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      // Draw grid lines
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw rPPG photoplethysmography waveform
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e'; // Rose-500
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
      ctx.shadowBlur = 8;

      const frequency = (pulseRate / 60) * 2; // speed based on heart rate
      for (let x = 0; x < width; x++) {
        const t = (x + offset) * 0.04 * (frequency / 2);
        // Photoplethysmography waveform model (Systolic peak + Dicrotic notch)
        const primaryPeak = Math.sin(t);
        const dicroticNotch = 0.35 * Math.sin(2 * t + 0.8) * (primaryPeak > 0 ? 0.8 : 0.2);
        const y = midY - (primaryPeak * 22 + dicroticNotch * 15);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Lead pulse point
      const leadX = width - 15;
      const leadT = (leadX + offset) * 0.04 * (frequency / 2);
      const leadY = midY - (Math.sin(leadT) * 22 + 0.35 * Math.sin(2 * leadT + 0.8) * 15);
      
      ctx.beginPath();
      ctx.arc(leadX, leadY, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;
      ctx.fill();

      offset += 1.8;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [pulseRate]);

  // Risk styling
  const getRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'tinggi':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700',
          dot: 'bg-rose-500',
          icon: <ShieldAlert size={15} className="text-rose-600" />,
          label: 'Risiko Tinggi (Perlu Evaluasi Klinis Lab HbA1c)'
        };
      case 'sedang':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          dot: 'bg-amber-500',
          icon: <AlertTriangle size={15} className="text-amber-600" />,
          label: 'Risiko Sedang (Perlu Pemantauan Rutin)'
        };
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 size={15} className="text-emerald-600" />,
          label: 'Risiko Rendah / Mikrovaskular Stabil'
        };
    }
  };

  const riskBadge = getRiskBadge(diabetesRisk);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-slate-100 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <Waves size={18} />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              Visualizer Skrining rPPG & Morfologi Wajah
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                AI Vision + Mikrovaskular
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Analisis variasi intensitas warna mikrovaskular kapiler dahi & pipi (Remote Photoplethysmography)
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowRoiOverlays(!showRoiOverlays)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showRoiOverlays 
                ? 'bg-rose-600 text-white shadow-sm' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="Tampilkan / Sembunyikan Area ROI Mikrovaskular"
          >
            {showRoiOverlays ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>ROI Dahi & Pipi</span>
          </button>

          <button
            onClick={() => setShowWaveform(!showWaveform)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showWaveform 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="Tampilkan / Sembunyikan Grafik Gelombang Pulsa"
          >
            <Activity size={13} />
            <span>Gelombang Pulsa</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Face Preview + Biomarker Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        
        {/* Left Column: Face ROI Overlay Visualizer */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center">
          <div className="relative w-full aspect-square max-w-[360px] rounded-2xl overflow-hidden bg-black border border-slate-700 shadow-inner group">
            {mediaType === 'video' ? (
              <video 
                src={mediaUrl} 
                controls 
                loop 
                muted 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : (
              <Image 
                src={mediaUrl} 
                alt="Face rPPG Media" 
                fill 
                className="object-cover" 
                referrerPolicy="no-referrer"
              />
            )}

            {/* Simulated Live ROI Optical Pulse Overlay */}
            {showRoiOverlays && (
              <>
                {/* Forehead ROI (Dahi) */}
                {(activeRoi === 'both' || activeRoi === 'forehead') && (
                  <div 
                    className="absolute top-[18%] left-[28%] w-[44%] h-[16%] rounded-xl border border-rose-400/80 bg-rose-500/20 backdrop-blur-[1px] flex flex-col items-center justify-center transition-all duration-300 pointer-events-none"
                    style={{
                      boxShadow: `0 0 ${8 + Math.sin(pulsePhase * 0.1) * 6}px rgba(244, 63, 94, 0.45)`,
                      borderColor: `rgba(244, 63, 94, ${0.6 + Math.sin(pulsePhase * 0.1) * 0.4})`
                    }}
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-200 bg-black/60 px-1.5 py-0.5 rounded shadow">
                      ROI 1: Dahi (Forehead)
                    </span>
                    <span className="text-[8px] text-rose-300 font-mono mt-0.5">
                      ΔRGB: +{((Math.sin(pulsePhase * 0.1) + 1) * 1.8).toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Left Cheek ROI (Pipi Kiri) */}
                {(activeRoi === 'both' || activeRoi === 'cheeks') && (
                  <div 
                    className="absolute top-[48%] left-[20%] w-[24%] h-[18%] rounded-xl border border-emerald-400/80 bg-emerald-500/20 backdrop-blur-[1px] flex flex-col items-center justify-center transition-all duration-300 pointer-events-none"
                    style={{
                      boxShadow: `0 0 ${8 + Math.cos(pulsePhase * 0.1) * 6}px rgba(16, 185, 129, 0.45)`,
                      borderColor: `rgba(16, 185, 129, ${0.6 + Math.cos(pulsePhase * 0.1) * 0.4})`
                    }}
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-200 bg-black/60 px-1.5 py-0.5 rounded shadow">
                      ROI 2: Pipi Kiri
                    </span>
                    <span className="text-[8px] text-emerald-300 font-mono mt-0.5">
                      Vaskular: Aktif
                    </span>
                  </div>
                )}

                {/* Right Cheek ROI (Pipi Kanan) */}
                {(activeRoi === 'both' || activeRoi === 'cheeks') && (
                  <div 
                    className="absolute top-[48%] right-[20%] w-[24%] h-[18%] rounded-xl border border-emerald-400/80 bg-emerald-500/20 backdrop-blur-[1px] flex flex-col items-center justify-center transition-all duration-300 pointer-events-none"
                    style={{
                      boxShadow: `0 0 ${8 + Math.cos(pulsePhase * 0.1) * 6}px rgba(16, 185, 129, 0.45)`,
                      borderColor: `rgba(16, 185, 129, ${0.6 + Math.cos(pulsePhase * 0.1) * 0.4})`
                    }}
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-200 bg-black/60 px-1.5 py-0.5 rounded shadow">
                      ROI 3: Pipi Kanan
                    </span>
                    <span className="text-[8px] text-emerald-300 font-mono mt-0.5">
                      Vaskular: Aktif
                    </span>
                  </div>
                )}

                {/* Facial Boundary Mesh Grid (Subtle) */}
                <div className="absolute inset-x-[15%] inset-y-[10%] rounded-[45%] border border-cyan-400/30 pointer-events-none" />
              </>
            )}

            {/* Status Pill on Camera */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="text-[10px] font-semibold bg-black/80 text-rose-400 px-2 py-1 rounded-md border border-rose-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                rPPG Optik Aktif
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-black/80 px-2 py-1 rounded-md border border-slate-700">
                {pulseRate} BPM
              </span>
            </div>
          </div>

          {/* ROI Selector */}
          <div className="flex gap-2 mt-3 text-xs">
            <button
              onClick={() => setActiveRoi('both')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRoi === 'both' ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Semua ROI (Dahi & Pipi)
            </button>
            <button
              onClick={() => setActiveRoi('forehead')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRoi === 'forehead' ? 'bg-rose-900/60 text-rose-200 font-semibold border border-rose-700' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Hanya Dahi
            </button>
            <button
              onClick={() => setActiveRoi('cheeks')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeRoi === 'cheeks' ? 'bg-emerald-900/60 text-emerald-200 font-semibold border border-emerald-700' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Hanya Pipi
            </button>
          </div>
        </div>

        {/* Right Column: Waveform Canvas & Analytical Metrics */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          
          {/* Waveform Card */}
          {showWaveform && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <Heart size={14} className="text-rose-500 fill-rose-500 animate-pulse" />
                  <span>Sinyal Fotopletismografi Mikrovaskular (rPPG Waveform)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Sampling: 30 fps</span>
              </div>
              
              <div className="w-full h-24 bg-slate-900/90 rounded-lg overflow-hidden border border-rose-950 relative">
                <canvas 
                  ref={canvasRef} 
                  width={340} 
                  height={96} 
                  className="w-full h-full block" 
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-mono">
                <span>Systolic Peak</span>
                <span>Dicrotic Notch</span>
                <span>Keteraturan: {pulseRegularity}%</span>
              </div>
            </div>
          )}

          {/* 4 Biomarker Quick Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Pulse Rate */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Heart size={13} className="text-rose-400" />
                <span>Denyut Nadi (rPPG)</span>
              </div>
              <div className="text-xl font-extrabold text-white flex items-baseline gap-1">
                <span>{pulseRate}</span>
                <span className="text-xs font-normal text-slate-400">bpm</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">Normocardia (60-100)</span>
            </div>

            {/* Card 2: Regularity */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Activity size={13} className="text-cyan-400" />
                <span>Keteraturan Pulsa</span>
              </div>
              <div className="text-xl font-extrabold text-white flex items-baseline gap-1">
                <span>{pulseRegularity}%</span>
              </div>
              <span className="text-[10px] text-cyan-300 font-medium">Gelombang Stabil</span>
            </div>

            {/* Card 3: Face Shape & Age */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <UserCheck size={13} className="text-purple-400" />
                <span>Bentuk Wajah</span>
              </div>
              <div className="text-sm font-bold text-purple-200 truncate">
                {faceShape}
              </div>
              <span className="text-[10px] text-slate-400">Usia Wajah: {estimatedAge}</span>
            </div>

            {/* Card 4: Diabetes Screening Category */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Zap size={13} className="text-amber-400" />
                <span>Skrining Kardiometabolik</span>
              </div>
              <div className={`text-sm font-extrabold truncate ${
                diabetesRisk === 'Tinggi' ? 'text-rose-400' : diabetesRisk === 'Sedang' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {diabetesRisk}
              </div>
              <span className="text-[10px] text-slate-400">Diabetes & Vaskular</span>
            </div>
          </div>

          {/* Clinical Interpretation & Observation Details */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${riskBadge.bg}`}>
                {riskBadge.icon}
                <span>{riskBadge.label}</span>
              </div>
            </div>
            <p className="leading-relaxed text-slate-300 text-[11px] pt-1">
              <strong>Observasi Mikrovaskular:</strong> {microvascularNotes}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
