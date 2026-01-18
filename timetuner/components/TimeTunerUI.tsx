"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useDragControls, useMotionValue, useTransform } from "framer-motion";
import { Volume2, Share2, Radio } from "lucide-react";
import { YouTubePlayer } from "./YouTubePlayer";
import yearsData from "@/data/years.json";
import useSound from "use-sound";

const STATIC_SOUND_URL = '/sounds/static.mp3';

export default function TimeTunerUI() {
    const [year, setYear] = useState(1990);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
    const [volume, setVolume] = useState(100);
    const dragControls = useDragControls();
    const rotation = useMotionValue(0);
    const [isDragging, setIsDragging] = useState(false);

    // Sound effects
    const [playStatic, { stop: stopStatic }] = useSound(STATIC_SOUND_URL, {
        volume: 0.5,
        loop: true
    });

    // Map rotation (0-360) to Years (1970-2024)
    const mapRotationToYear = (degrees: number) => {
        const normalized = (degrees % 360 + 360) % 360;
        const yearRange = 2024 - 1970;
        const mappedYear = Math.round(1970 + (normalized / 360) * yearRange);
        return Math.min(Math.max(mappedYear, 1970), 2024);
    };

    // Handle drag/rotation audio
    useEffect(() => {
        if (isDragging) {
            playStatic();
            setVolume(20); // Lower music volume while tuning
        } else {
            stopStatic();
            setVolume(100); // Restore music volume
        }
    }, [isDragging, playStatic, stopStatic]);

    // Select video when year changes (debounced)
    useEffect(() => {
        if (isDragging) return;

        const timer = setTimeout(() => {
            const yearKey = year.toString() as keyof typeof yearsData;
            const videos = yearsData[yearKey as keyof typeof yearsData];

            if (videos && videos.length > 0) {
                // Pick a random video from the list
                const randomVideo = videos[Math.floor(Math.random() * videos.length)];
                setCurrentVideoId(randomVideo);
                setIsPlaying(true);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [year, isDragging]);

    return (
        <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 font-mono text-gray-200 overflow-hidden">

            {/* --- MAIN UNIT CHASSIS --- */}
            <div className="relative w-full max-w-4xl aspect-[16/9] md:aspect-[2.2/1] bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border-t border-[#333] border-b-4 border-black">

                {/* =======================
            LEFT: SPEAKER GRILLE 
           ======================= */}
                <div className="w-full md:w-1/3 h-48 md:h-auto bg-[#222] relative border-r border-black/50 p-6 flex flex-col justify-between">
                    {/* The Grille Texture (CSS Pattern) */}
                    <div className="absolute inset-0 opacity-40 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2.5px)',
                            backgroundSize: '8px 8px'
                        }}
                    />

                    {/* Brand Badge */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-orange-500 mb-1">
                            <Radio size={16} className="animate-pulse" />
                            <span className="text-xs font-bold tracking-[0.2em] uppercase">Stereo Tuned</span>
                        </div>
                        <h1 className="text-2xl font-bold text-[#e0e0e0] tracking-tighter shadow-black drop-shadow-md">
                            TIME<span className="text-orange-600">TUNER</span>
                        </h1>
                    </div>

                    {/* Indicator Lights */}
                    <div className="flex gap-3 relative z-10 mt-auto">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.5)] ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-red-900'}`} />
                        <div className="w-3 h-3 rounded-full bg-amber-900 shadow-inner" />
                        <div className="w-3 h-3 rounded-full bg-green-900 shadow-inner" />
                    </div>
                </div>

                {/* =======================
            RIGHT: CONTROL PANEL 
           ======================= */}
                <div className="flex-1 bg-gradient-to-br from-[#1e1e1e] to-[#141414] p-8 md:p-12 relative flex flex-col items-center justify-center">

                    {/* Subtle Texture overlay */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ filter: 'contrast(120%) noise(10%)' }}></div>

                    {/* --- THE VFD DISPLAY (Top) --- */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-64 h-16 bg-black rounded md:rounded-lg border-2 border-[#333] shadow-[inset_0_2px_10px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden">
                        {/* Scanline Effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,6px_100%] pointer-events-none" />

                        {/* Glowing Text */}
                        <div className="relative z-10 flex items-baseline gap-2">
                            <span className="text-4xl text-cyan-400 font-bold tracking-widest drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" style={{ fontFamily: 'var(--font-vt323), monospace' }}>
                                {year}
                            </span>
                            <span className="text-xs text-cyan-700 uppercase">MHz</span>
                        </div>
                    </div>

                    {/* --- THE KNOB (Center) --- */}
                    <div className="relative w-64 h-64 flex items-center justify-center mt-8">
                        {/* Ticks Ring */}
                        <div className="absolute inset-0 rounded-full border border-white/5">
                            {[...Array(60)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`absolute w-[2px] h-3 bg-white/20 left-1/2 top-0 origin-[0_128px] ${i % 5 === 0 ? 'h-5 w-[3px] bg-white/40' : ''}`}
                                    style={{ transform: `translateX(-50%) rotate(${i * 6}deg)` }}
                                />
                            ))}
                        </div>

                        {/* The Physical Dial */}
                        <motion.div
                            drag="x" // We simulate rotation via X-drag for easier web control
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0}
                            dragMomentum={false}
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={() => setIsDragging(false)}
                            onDrag={(event, info) => {
                                // Convert drag X pixels to rotation degrees
                                const newRot = rotation.get() + info.delta.x * 0.5;
                                rotation.set(newRot);
                                setYear(mapRotationToYear(newRot));
                            }}
                            style={{ rotate: rotation }}
                            className="w-40 h-40 rounded-full bg-[#1a1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_2px_5px_rgba(255,255,255,0.1),inset_0_-2px_5px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing relative flex items-center justify-center z-10 border border-white/5"
                        >
                            {/* Brushed Metal Texture Gradient */}
                            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#000]" />

                            {/* Center Cap */}
                            <div className="absolute w-12 h-12 rounded-full bg-[#111] shadow-[inset_0_2px_5px_rgba(0,0,0,1)] border border-white/5" />

                            {/* The Orange Indicator Line (The Needle) */}
                            <div className="absolute top-4 w-1.5 h-8 bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.6)]" />
                        </motion.div>
                    </div>

                    {/* --- BOTTOM CONTROLS --- */}
                    <div className="absolute bottom-6 w-full px-12 flex justify-between items-center text-[#555]">
                        <button className="hover:text-white transition-colors flex flex-col items-center gap-1 group">
                            <div className="w-12 h-12 rounded bg-[#111] shadow-[inset_0_2px_5px_rgba(0,0,0,1)] flex items-center justify-center border border-[#333] group-active:translate-y-0.5 transition-transform">
                                <Volume2 size={20} />
                            </div>
                            <span className="text-[10px] tracking-widest uppercase">Vol</span>
                        </button>

                        <div className="text-[10px] tracking-[0.3em] uppercase opacity-50">High Fidelity Audio</div>

                        <button className="hover:text-white transition-colors flex flex-col items-center gap-1 group">
                            <div className="w-12 h-12 rounded bg-[#111] shadow-[inset_0_2px_5px_rgba(0,0,0,1)] flex items-center justify-center border border-[#333] group-active:translate-y-0.5 transition-transform">
                                <Share2 size={20} />
                            </div>
                            <span className="text-[10px] tracking-widest uppercase">Share</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* Background Glow behind the unit */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[50%] bg-orange-900/10 blur-[100px] -z-10" />

            <YouTubePlayer
                videoId={currentVideoId}
                isPlaying={isPlaying}
                volume={volume}
            />
        </div>
    );
}
