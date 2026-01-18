"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { YouTubePlayer } from "./YouTubePlayer";
import { songData } from "@/data/songs";
import useSound from "use-sound";

const STATIC_SOUND_URL = '/sounds/static.mp3';

export default function RetroRadio3D() {
    // --- Logic State ---
    const [year, setYear] = useState(1990);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
    const [volume, setVolume] = useState(100);
    const [isDragging, setIsDragging] = useState(false);
    const [isIndianMode, setIsIndianMode] = useState(false); // New State for Indian Mode

    const rotation = useMotionValue(0);
    const knobRef = useRef<HTMLDivElement>(null);

    // Sound effects
    const [playStatic, { stop: stopStatic }] = useSound(STATIC_SOUND_URL, {
        volume: 0.1, // Reduced from 0.5 to be subtle
        loop: true
    });

    // Map rotation (0-360) to Years (1970-2026)
    const mapRotationToYear = (degrees: number) => {
        // Linear mapping: 0deg = 1970, 360deg = 2026
        const yearRange = 2026 - 1970;
        const mappedYear = Math.round(1970 + (degrees / 360) * yearRange);
        return Math.min(Math.max(mappedYear, 1970), 2026);
    };

    // Initialize rotation to match start year (1990)
    useEffect(() => {
        const startYear = 1990;
        const initialDegrees = ((startYear - 1970) / (2026 - 1970)) * 360;
        rotation.set(initialDegrees);
    }, []);

    // Transform rotation to knob visuals showing rotation
    const knobRotate = useTransform(rotation, (r) => `rotate(${r}deg)`);

    // Transform rotation to needle position (0-100%)
    const needlePosition = useTransform(rotation, [0, 360], ["0%", "100%"]);

    // Handle drag/rotation audio
    useEffect(() => {
        if (isDragging) {
            playStatic();
            setVolume(60); // Keep music audible (was 20)
        } else {
            stopStatic();
            setVolume(100); // Restore music volume
        }
    }, [isDragging, playStatic, stopStatic]);

    // Select video when year changes (debounced)
    useEffect(() => {
        if (isDragging) return;

        const timer = setTimeout(() => {
            const yearData = songData[year];

            if (yearData) {
                const listToUse = isIndianMode ? yearData.indian : yearData.global;

                if (listToUse && listToUse.length > 0) {
                    const randomVideo = listToUse[Math.floor(Math.random() * listToUse.length)];
                    setCurrentVideoId(randomVideo);
                    setIsPlaying(true);
                }
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [year, isDragging, isIndianMode]); // Re-run when mode changes

    return (
        // MAIN CONTAINER - Warm vintage background
        <div className="min-h-screen bg-[#cbbfae] flex items-center justify-center p-8 overflow-hidden relative">
            {/* Background texture noise */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay" style={{ filter: 'noise(100%)' }}></div>

            {/* ==========================================
          THE PHYSICAL RADIO UNIT (Outer Shell)
      ========================================== */}
            <div className="relative w-full max-w-3xl aspect-[16/10] rounded-[3rem] bg-[#e6e6e6] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.8),inset_0_-5px_10px_rgba(0,0,0,0.2)] border-b-8 border-[#d4d4d4]">

                {/* Brushed Metal Texture Overlay */}
                <div className="absolute inset-0 rounded-[3rem] opacity-30 mix-blend-multiply pointer-events-none bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,0,0,0.05)_3px,transparent_4px)]" />

                {/* --- Inner Black Faceplate --- */}
                <div className="w-full h-full bg-[#222] rounded-[2.5rem] p-8 flex relative overflow-hidden shadow-[inset_0_10px_20px_rgba(0,0,0,0.8),inset_0_-2px_5px_rgba(255,255,255,0.1)] border-t-2 border-black">

                    {/* Subtle Speaker Mesh Pattern on the whole black area */}
                    <div className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at center, #000 1.5px, transparent 1.5px)', backgroundSize: '4px 4px' }}
                    />

                    {/* --- LEFT SIDE: Speaker & Brand --- */}
                    <div className="w-1/3 relative z-10 flex flex-col justify-between border-r border-white/10 pr-8">
                        <div>
                            <div className="flex gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.8)] ${isPlaying ? 'bg-red-600 animate-pulse' : 'bg-red-900'}`} />
                                <div className="text-[10px] text-[#888] uppercase tracking-widest font-bold">Stereo L-Band</div>
                            </div>
                            <h1 className="text-3xl font-black text-[#e6e6e6] tracking-tight leading-none">
                                CHRONO<br />MASTER
                            </h1>
                            <div className="text-xs text-orange-500 font-bold tracking-[0.4em] mt-2 uppercase">Model T-70</div>
                        </div>

                        {/* --- BAND SELECTOR (Global vs Indian) --- */}
                        <div className="flex gap-4 mt-auto">

                            {/* GLOBAL Button (AM/FM equivalent) */}
                            <button
                                onClick={() => setIsIndianMode(false)}
                                className={`group relative w-12 h-16 rounded-sm shadow-[0_5px_10px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] border-b-4 border-[#ccc] transition-all
                            ${!isIndianMode ? 'bg-[#dcdcdc] border-b-0 translate-y-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)]' : 'bg-[#e6e6e6]'}
                            `}
                            >
                                <div className="absolute inset-1 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-[#555]">INTL</span>
                                </div>
                            </button>

                            {/* THE "IN" BUTTON (Indian Mode) */}
                            <button
                                onClick={() => setIsIndianMode(true)}
                                className={`group relative w-12 h-16 rounded-sm shadow-[0_5px_10px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] border-b-4 border-[#ccc] transition-all
                            ${isIndianMode ? 'bg-[#dcdcdc] border-b-0 translate-y-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)]' : 'bg-[#e6e6e6]'}
                            `}
                            >
                                {/* Amber LED Indicator (Only lights up when Indian Mode is ON) */}
                                {isIndianMode && (
                                    <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-4 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] z-20" />
                                )}

                                <div className="absolute inset-1 flex items-center justify-center">
                                    <span className={`text-[10px] font-bold ${isIndianMode ? 'text-amber-700' : 'text-[#555]'}`}>IN</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* --- RIGHT SIDE: The Controls --- */}
                    <div className="flex-1 relative z-10 flex flex-col items-center pl-8">

                        {/* THE TUNING WINDOW (Recessed Glass) */}
                        <div className="relative w-full h-24 bg-[#111] rounded-t-2xl border-4 border-[#444] border-b-0 shadow-[inset_0_10px_30px_rgba(0,0,0,1)] overflow-hidden">
                            {/* Glass Reflection overlay */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none z-20" />

                            {/* The Dial Scale */}
                            <div className="absolute inset-0 flex items-center px-8 z-10">
                                <div className="w-full h-1 bg-orange-600/30 relative">
                                    {/* The Needle Indicator */}
                                    <motion.div
                                        className="absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 shadow-[0_0_10px_orange]"
                                        // Smooth visual mapping based on rotation
                                        style={{
                                            left: needlePosition
                                        }}
                                    />
                                </div>
                            </div>
                            {/* Digital Readout Backup */}
                            <div className="absolute top-2 right-4 font-mono text-orange-500 text-xl drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                                {year}
                            </div>
                        </div>

                        {/* === THE REALISTIC KNOB (Centerpiece) === */}
                        <div className="relative flex-1 w-full flex items-center justify-center bg-[#333] rounded-b-2xl border-4 border-[#444] border-t-0 shadow-[inset_0_-10px_30px_rgba(0,0,0,0.8)]">

                            {/* Knob Housing Well */}
                            <div className="w-56 h-56 rounded-full bg-[#222] shadow-[inset_0_10px_20px_rgba(0,0,0,0.8),0_2px_5px_rgba(255,255,255,0.05)] flex items-center justify-center border border-white/5">

                                {/* The Physical Aluminum Dial */}
                                <motion.div
                                    ref={knobRef}
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        setIsDragging(true);
                                        const element = knobRef.current;
                                        if (!element) return;

                                        const rect = element.getBoundingClientRect();
                                        const centerX = rect.left + rect.width / 2;
                                        const centerY = rect.top + rect.height / 2;

                                        let lastAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

                                        const onPointerMove = (moveEvent: PointerEvent) => {
                                            const newAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
                                            let delta = newAngle - lastAngle;

                                            // Normalize delta to handle wrap-around (e.g. crossing 180/-180)
                                            if (delta > Math.PI) delta -= 2 * Math.PI;
                                            if (delta < -Math.PI) delta += 2 * Math.PI;

                                            const deltaDegrees = delta * (180 / Math.PI);
                                            const currentRot = rotation.get();

                                            // Clamp between 0 and 360
                                            const newRot = Math.max(0, Math.min(360, currentRot + deltaDegrees));

                                            rotation.set(newRot);
                                            setYear(mapRotationToYear(newRot));

                                            lastAngle = newAngle;
                                        };

                                        const onPointerUp = () => {
                                            setIsDragging(false);
                                            window.removeEventListener('pointermove', onPointerMove);
                                            window.removeEventListener('pointerup', onPointerUp);
                                        };

                                        window.addEventListener('pointermove', onPointerMove);
                                        window.addEventListener('pointerup', onPointerUp);
                                    }}
                                    style={{ rotate: knobRotate }}
                                    // This gradient creates the "spun metal" look
                                    className="w-44 h-44 rounded-full bg-[conic-gradient(from_0deg_at_50%_50%,#e6e6e6_0deg,#999_90deg,#ffffff_180deg,#999_270deg,#e6e6e6_360deg)] shadow-[0_15px_30px_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.3),inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-5px_10px_rgba(0,0,0,0.6)] cursor-grab active:cursor-grabbing relative z-20"
                                >
                                    {/* Side ridges for grip */}
                                    <div className="absolute inset-0 rounded-full border-[4px] border-dashed border-[#888] opacity-30" />

                                    {/* Center Cap (Finger indent) */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[conic-gradient(#ccc,#eee,#ccc)] shadow-[inset_0_5px_10px_rgba(0,0,0,0.6),0_2px_2px_rgba(255,255,255,1)]" />

                                    {/* The Position Indicator notch */}
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-6 bg-orange-600 rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.4)]" />
                                </motion.div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            <YouTubePlayer
                videoId={currentVideoId}
                isPlaying={isPlaying}
                volume={volume}
            />
        </div>
    );
}
