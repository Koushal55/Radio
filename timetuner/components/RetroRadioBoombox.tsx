"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, Square } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";
import { useStaticNoise } from "@/hooks/useStaticNoise";

export default function RetroRadioBoombox() {
    // --- STATE ---
    const [year, setYear] = useState(1990);
    const [isIndianMode, setIsIndianMode] = useState(true);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolume] = useState(70);
    const [tone, setTone] = useState(50);
    const [isPowerOn, setIsPowerOn] = useState(true);

    // Logic State
    const [cache, setCache] = useState<Record<string, string[]>>({});
    const playerRef = useRef<any>(null);
    const { playStatic, stopStatic } = useStaticNoise();

    const START_YEAR = 1970;
    const END_YEAR = 2025;
    const TOTAL_YEARS = END_YEAR - START_YEAR;

    // --- LOGIC: TUNING & FETCHING ---

    // Debounced Tuning Effect
    useEffect(() => {
        if (!year || !isPowerOn) return;

        // Visual feedback & Sound immediately
        setIsLoading(true);
        playStatic(0.15);

        const t = setTimeout(() => {
            playMusicForYear(year);
        }, 800);

        return () => clearTimeout(t);
    }, [year, isIndianMode, isPowerOn]);

    // Stop static when loading finishes
    useEffect(() => {
        if (!isLoading) {
            stopStatic();
        }
    }, [isLoading]);

    // Volume control effect
    useEffect(() => {
        if (playerRef.current && isPowerOn) {
            try {
                playerRef.current.setVolume(volume);
            } catch (e) {
                console.warn("Player error:", e);
            }
        }
    }, [volume, isPowerOn]);

    const playMusicForYear = async (selectedYear: number) => {
        const cacheKey = `${selectedYear}-${isIndianMode ? 'in' : 'gl'}`;

        try {
            // 1. Check Cache
            if (cache[cacheKey]?.length > 0) {
                playRandomFromList(cache[cacheKey]);
                return;
            }

            // 2. Fetch from API (Server-side)
            // Improved Query Logic
            const terms = isIndianMode
                ? ["bollywood hits", "hindi songs", "superhit songs", "top songs"]
                : ["billboard top 100", "greatest hits", "pop hits", "rock hits"];

            const randomTerm = terms[Math.floor(Math.random() * terms.length)];

            const baseQuery = isIndianMode
                ? `${randomTerm} ${selectedYear} full audio`
                : `${randomTerm} ${selectedYear} official audio`;

            const strictFilters = "-remix -cover -lofi -live -instrumental";
            const fullQuery = `${baseQuery} ${strictFilters}`;

            const res = await fetch(`/api/search?q=${encodeURIComponent(fullQuery)}`);
            const data = await res.json();

            if (data.items?.length > 0) {
                const ids = data.items.map((i: any) => i.id.videoId);
                setCache(prev => ({ ...prev, [cacheKey]: ids }));
                playRandomFromList(ids);
            } else {
                console.warn("No songs found");
                setIsLoading(false);
            }
        } catch (e) {
            console.error("API Error", e);
            setIsLoading(false);
        }
    };

    const playRandomFromList = (list: string[]) => {
        if (!list.length) return;
        // Avoid repeating the exact same song immediately if possible
        let newId = list[Math.floor(Math.random() * list.length)];
        if (list.length > 1 && newId === videoId) {
            newId = list.find(id => id !== videoId) || newId;
        }
        setVideoId(newId);
    };

    // --- PLAYER EVENT HANDLERS ---
    const onPlayerReady: YouTubeProps["onReady"] = (event) => {
        playerRef.current = event.target;
        try {
            event.target.setVolume(volume);
            if (isPowerOn) {
                event.target.playVideo();
            }
        } catch (e) {
            console.warn("Player ready error:", e);
        }
    };

    const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
        // 1 = Playing, 2 = Paused, 3 = Buffering
        if (event.data === 1) { setIsPlaying(true); setIsLoading(false); }
        else if (event.data === 3) { setIsLoading(true); }
        else if (event.data === 2) { setIsPlaying(false); }
        else if (event.data === 0) { handleNext(); } // Auto-play next on end
    };

    const onPlayerError = () => {
        console.warn("Video unavailable, skipping...");
        handleNext(); // Skip if video fails
    };

    const handlePlayPause = () => {
        if (!playerRef.current || !isPowerOn) return;
        try {
            isPlaying ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
        } catch (e) {
            console.warn("Play/Pause error:", e);
        }
    };

    const handleStop = () => {
        if (!playerRef.current || !isPowerOn) return;
        try {
            playerRef.current.stopVideo();
        } catch (e) {
            console.warn("Stop error:", e);
        }
        setIsPlaying(false);
    };

    const handleNext = () => {
        if (!isPowerOn) return;
        // Re-roll from current cache
        const cacheKey = `${year}-${isIndianMode ? 'in' : 'gl'}`;
        if (cache[cacheKey]) playRandomFromList(cache[cacheKey]);
        else playMusicForYear(year);
    };

    const togglePower = () => {
        const newPowerState = !isPowerOn;
        setIsPowerOn(newPowerState);

        if (!newPowerState && playerRef.current) {
            try {
                playerRef.current.stopVideo();
            } catch (e) {
                console.warn("Power off error:", e);
            }
            setIsPlaying(false);
        }
    };

    // --- UI HELPERS ---
    // Calculate needle position percentage
    const needlePos = ((year - START_YEAR) / TOTAL_YEARS) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 font-sans selection:bg-orange-500 selection:text-white overflow-hidden relative">

            {/* Animated Background */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,100,0,0.1),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.15),transparent_50%)]" />
            </div>

            {/* Floating Particles */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
                    initial={{
                        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000)
                    }}
                    animate={{
                        y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000)],
                        x: [null, Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000)],
                    }}
                    transition={{
                        duration: Math.random() * 20 + 10,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            ))}

            {/* --- MAIN BOOMBOX UNIT --- */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="
                w-full 
                max-w-5xl 
                max-h-[90vh]
                aspect-[16/9]
                md:aspect-[1.8/1]
                scale-[0.95]
                md:scale-100
                bg-gradient-to-br from-[#e8d9c4] via-[#d6cbb6] to-[#c4b5a0]
                rounded-3xl 
                shadow-[0_50px_100px_rgba(0,0,0,0.8),0_0_80px_rgba(234,88,12,0.3),inset_0_2px_5px_rgba(255,255,255,0.4)] 
                border-4 border-[#b0a38e] 
                flex flex-col 
                relative
                overflow-hidden
            "
                style={{
                    filter: isPowerOn ? 'none' : 'grayscale(0.5) brightness(0.7)'
                }}
            >

                {/* 1. TOP SECTION: TUNER WINDOW & DIAL */}
                <div className="relative h-[28%] bg-gradient-to-b from-[#1a1a1a] to-[#222] border-b-8 border-[#0a0a0a] flex items-center px-6 md:px-12 shadow-[0_10px_30px_rgba(0,0,0,0.9)]">

                    {/* Power LED */}
                    <motion.div
                        className="absolute top-4 right-4 flex items-center gap-2"
                        animate={{ opacity: isPowerOn ? 1 : 0.3 }}
                    >
                        <div className={`w-3 h-3 rounded-full ${isPowerOn ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]' : 'bg-red-900'} transition-all duration-300`} />
                        <span className="text-[10px] text-stone-500 font-mono">PWR</span>
                    </motion.div>

                    {/* Glass Tuner Window */}
                    <div className="relative w-full h-[70%] bg-gradient-to-b from-[#0a0a0a] to-[#111] rounded-lg border-2 border-[#444] shadow-[inset_0_10px_30px_rgba(0,0,0,1),0_0_20px_rgba(234,88,12,0.2)] overflow-hidden">
                        {/* Glass Reflection */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-20" />
                        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-20" />

                        {/* Frequency Lines */}
                        <div className="absolute inset-0 flex justify-between items-end px-4 md:px-12 pb-2 z-10">
                            {[1970, 1980, 1990, 2000, 2010, 2020, 2025].map((y) => (
                                <motion.div
                                    key={y}
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={() => isPowerOn && setYear(y)}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <motion.div
                                        className="w-[2px] h-4 bg-orange-700/50 group-hover:bg-orange-500 transition-colors"
                                        animate={{
                                            height: year === y ? 20 : 16,
                                            boxShadow: year === y ? '0 0 10px rgba(234,88,12,0.8)' : 'none'
                                        }}
                                    />
                                    <span className={`text-[10px] md:text-xs font-mono font-bold transition-colors ${year === y ? 'text-orange-500' : 'text-stone-600'}`}>{y}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* The Moving Needle */}
                        <motion.div
                            className="absolute top-0 bottom-0 w-[3px] z-10"
                            animate={{
                                left: `${needlePos}%`,
                                background: isPowerOn ? 'linear-gradient(to bottom, rgba(234,88,12,1), rgba(234,88,12,0.5))' : 'rgba(100,100,100,0.3)',
                                boxShadow: isPowerOn ? '0 0 20px rgba(234,88,12,0.9), 0 0 40px rgba(234,88,12,0.5)' : 'none'
                            }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        />

                        {/* Scanning Line Effect */}
                        {isPowerOn && (
                            <motion.div
                                className="absolute top-0 bottom-0 w-[100px] pointer-events-none z-[5]"
                                style={{
                                    background: 'linear-gradient(to right, transparent, rgba(234,88,12,0.1), transparent)'
                                }}
                                animate={{
                                    left: ['0%', '100%'],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />
                        )}

                        {/* Digital Year Display (Center) */}
                        <motion.div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl md:text-6xl font-mono font-bold pointer-events-none select-none"
                            animate={{
                                color: isPowerOn ? 'rgba(234,88,12,0.3)' : 'rgba(100,100,100,0.2)',
                                textShadow: isPowerOn ? '0 0 30px rgba(234,88,12,0.5)' : 'none'
                            }}
                        >
                            {year}
                        </motion.div>
                    </div>
                </div>


                {/* 2. MIDDLE SECTION: CONTROLS & TAPE DECK */}
                <div className="flex-1 bg-[#4b4338] border-b-4 border-[#3a332a] flex p-4 md:p-6 gap-4 md:gap-8 shadow-inner">

                    {/* Left: Audio Controls */}
                    <div className="w-[25%] flex flex-col justify-between py-2">
                        {/* VU Meter */}
                        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#222] rounded-lg border border-[#555] p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                            <div className="text-[8px] text-[#888] text-center tracking-widest mb-1.5 font-mono">VU LEVEL</div>
                            <div className="flex gap-2 h-14 justify-center items-end">
                                {/* Left Channel */}
                                <div className="flex flex-col gap-[2px] h-full justify-end">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div key={`l-${i}`}
                                            className={`w-4 h-[8%] rounded-sm ${i > 7 ? 'bg-red-600' : i > 4 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                            animate={{
                                                opacity: isPlaying && isPowerOn ? (Math.random() > 0.3 ? 1 : 0.2) : 0.15,
                                                boxShadow: isPlaying && isPowerOn && Math.random() > 0.5
                                                    ? `0 0 8px ${i > 7 ? 'rgba(220,38,38,0.8)' : i > 4 ? 'rgba(234,179,8,0.8)' : 'rgba(34,197,94,0.8)'}`
                                                    : 'none'
                                            }}
                                            transition={{ duration: 0.05 }}
                                        />
                                    ))}
                                </div>
                                {/* Right Channel */}
                                <div className="flex flex-col gap-[2px] h-full justify-end">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div key={`r-${i}`}
                                            className={`w-4 h-[8%] rounded-sm ${i > 7 ? 'bg-red-600' : i > 4 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                            animate={{
                                                opacity: isPlaying && isPowerOn ? (Math.random() > 0.3 ? 1 : 0.2) : 0.15,
                                                boxShadow: isPlaying && isPowerOn && Math.random() > 0.5
                                                    ? `0 0 8px ${i > 7 ? 'rgba(220,38,38,0.8)' : i > 4 ? 'rgba(234,179,8,0.8)' : 'rgba(34,197,94,0.8)'}`
                                                    : 'none'
                                            }}
                                            transition={{ duration: 0.05 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Knobs Row */}
                        <div className="flex justify-around mt-4 gap-2">
                            <Knob label="VOL" value={volume} onChange={setVolume} disabled={!isPowerOn} sensitivity={1} />
                            <Knob label="TONE" value={tone} onChange={setTone} disabled={!isPowerOn} />
                        </div>
                    </div>

                    {/* Center: Cassette Deck */}
                    <div className="flex-1 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl shadow-[inset_0_3px_15px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.5)] border-2 border-[#3a3a3a] p-4 md:p-5 flex flex-col relative overflow-hidden">

                        {/* Tape Window */}
                        <div className="flex-1 bg-gradient-to-b from-[#0a0a0a] to-[#111] rounded-lg border-2 border-[#333] relative flex items-center justify-center gap-6 md:gap-10 mb-4 overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,1)]">
                            {/* Tape Background Texture */}
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,#444_1px,transparent_1px)] bg-[length:5px_5px]" />

                            <TapeReel spinning={isPlaying && isPowerOn} />

                            {/* Cassette Center Label */}
                            <div className="absolute w-[35%] md:w-[30%] h-[50%] bg-gradient-to-br from-[#d4c5a9] to-[#c0b090] rounded-sm z-0 flex items-center justify-center flex-col shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-[#a89677]">
                                {/* Text removed */}
                            </div>

                            <TapeReel spinning={isPlaying && isPowerOn} />
                        </div>

                        {/* Tape Controls */}
                        <div className="flex justify-center gap-2 md:gap-4 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] p-3 rounded-lg border-t-2 border-[#444] shadow-[inset_0_3px_10px_rgba(0,0,0,0.9)]">
                            <TransportBtn onClick={handleNext} icon={<SkipBack size={16} fill="currentColor" />} disabled={!isPowerOn} label="PREV" />
                            <TransportBtn onClick={handlePlayPause} icon={isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />} active={isPlaying} disabled={!isPowerOn} label={isPlaying ? "PAUSE" : "PLAY"} />
                            <TransportBtn onClick={handleStop} icon={<Square size={16} fill="currentColor" />} disabled={!isPowerOn} label="STOP" />
                            <TransportBtn onClick={handleNext} icon={<SkipForward size={16} fill="currentColor" />} disabled={!isPowerOn} label="NEXT" />
                        </div>
                    </div>

                    {/* Right: Mode & Tuner */}
                    <div className="w-[25%] flex flex-col justify-between py-2">
                        {/* Power Button */}
                        {/* Power Button */}
                        <div className="flex flex-col items-center mb-2">
                            <span className="text-[9px] font-bold text-[#555] mb-1 tracking-widest">POWER</span>
                            <motion.button
                                onClick={togglePower}
                                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 ${isPowerOn
                                    ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                                    : 'bg-gradient-to-br from-[#333] to-[#222] border-[#444]'
                                    }`}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Play size={14} className={`ml-0.5 ${isPowerOn ? 'text-white fill-white' : 'text-[#111] fill-[#111]'}`} style={{ rotate: '270deg' }} />
                            </motion.button>
                        </div>

                        {/* Mode Switches */}
                        <div className="bg-gradient-to-b from-[#444] to-[#333] rounded-lg p-1 flex shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.1)] border border-[#222]">
                            <button
                                onClick={() => isPowerOn && setIsIndianMode(false)}
                                disabled={!isPowerOn}
                                className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${!isIndianMode && isPowerOn
                                    ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5),0_0_15px_rgba(234,88,12,0.5)]'
                                    : 'text-stone-400 hover:text-white'
                                    }`}
                            >
                                INTL
                            </button>
                            <button
                                onClick={() => isPowerOn && setIsIndianMode(true)}
                                disabled={!isPowerOn}
                                className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${isIndianMode && isPowerOn
                                    ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5),0_0_15px_rgba(234,88,12,0.5)]'
                                    : 'text-stone-400 hover:text-white'
                                    }`}
                            >
                                IND
                            </button>
                        </div>

                        {/* Tuning Knob (Slider) */}
                        <div className="flex-1 flex flex-col justify-end gap-2">
                            <label className="text-[9px] text-stone-400 font-bold uppercase text-center w-full">Fine Tuning</label>
                            <div className="relative h-10 w-full bg-gradient-to-b from-[#1a1a1a] to-[#222] rounded-full shadow-[inset_0_3px_10px_rgba(0,0,0,1),0_1px_2px_rgba(255,255,255,0.1)] border border-[#444] flex items-center px-2">
                                <input
                                    type="range"
                                    min={START_YEAR} max={END_YEAR}
                                    step={1}
                                    value={year}
                                    onChange={(e) => isPowerOn && setYear(Number(e.target.value))}
                                    disabled={!isPowerOn}
                                    className="w-full h-full opacity-0 absolute inset-0 z-20 cursor-pointer disabled:cursor-not-allowed"
                                />
                                {/* Visual Thumb */}
                                <motion.div
                                    className="absolute w-8 h-8 bg-gradient-to-b from-[#999] to-[#555] rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.3)] border-2 border-[#aaa] z-10 pointer-events-none transition-all duration-75 ease-out"
                                    style={{ left: `calc(${needlePos}% - 16px)` }}
                                    animate={{
                                        boxShadow: isPowerOn
                                            ? '0 3px 8px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.3), 0 0 15px rgba(234,88,12,0.3)'
                                            : '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2)'
                                    }}
                                >
                                    <motion.div
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                                        animate={{
                                            backgroundColor: isPowerOn ? '#f97316' : '#666',
                                            boxShadow: isPowerOn ? '0 0 10px rgba(234,88,12,0.8)' : 'none'
                                        }}
                                    />
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* 3. BOTTOM SECTION: SPEAKERS */}
                <div className="h-[35%] bg-gradient-to-br from-[#e8d9c4] via-[#d6cbb6] to-[#c4b5a0] flex items-center relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-transparent pointer-events-none" />

                    {/* Left Speaker */}
                    <div className="w-[35%] h-full flex items-center justify-center p-4">
                        <SpeakerMesh isPlaying={isPlaying && isPowerOn} />
                    </div>

                    {/* Center Branding */}
                    <div className="flex-1 flex flex-col items-center justify-center z-10">
                        <motion.div
                            className="bg-gradient-to-br from-[#d4c5a9] to-[#bdae93] px-8 py-3 rounded-lg border-2 border-[#a39276] shadow-[0_5px_15px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] mb-3"
                            animate={{
                                boxShadow: isPowerOn && isPlaying
                                    ? '0 5px 15px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3), 0 0 30px rgba(234,88,12,0.2)'
                                    : '0 5px 15px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
                            }}
                        >
                            <span className="text-3xl md:text-4xl font-black text-[#5e503f] tracking-widest drop-shadow-[2px_2px_0px_rgba(0,0,0,0.2)]">
                                SONIC<span className="text-orange-600">BOOM</span>
                            </span>
                        </motion.div>
                        <div className="flex gap-3 items-center bg-[#333]/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
                            <motion.div
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300`}
                                animate={{
                                    backgroundColor: isLoading ? '#f59e0b' : isPlaying && isPowerOn ? '#22c55e' : '#7f1d1d',
                                    boxShadow: isLoading
                                        ? '0 0 20px rgba(245,158,11,0.8)'
                                        : isPlaying && isPowerOn
                                            ? '0 0 20px rgba(34,197,94,0.8)'
                                            : 'none',
                                    scale: isLoading ? [1, 1.2, 1] : 1
                                }}
                                transition={{ duration: 0.6, repeat: isLoading ? Infinity : 0 }}
                            />
                            <span className="text-[11px] font-bold text-[#555] tracking-wider">
                                {isLoading ? 'TUNING...' : isPlaying && isPowerOn ? 'STEREO' : isPowerOn ? 'READY' : 'OFF'}
                            </span>
                        </div>
                    </div>

                    {/* Right Speaker */}
                    <div className="w-[35%] h-full flex items-center justify-center p-4">
                        <SpeakerMesh isPlaying={isPlaying && isPowerOn} />
                    </div>
                </div>

            </motion.div>

            {/* HIDDEN YOUTUBE PLAYER */}
            <div className="fixed opacity-0 pointer-events-none left-0 top-0">
                {videoId && (
                    <YouTube
                        videoId={videoId}
                        opts={{
                            playerVars: {
                                autoplay: 1,
                                mute: 0,
                                rel: 0,
                                modestbranding: 1
                            }
                        }}
                        onReady={onPlayerReady}
                        onStateChange={onPlayerStateChange}
                        onError={onPlayerError}
                    />
                )}
            </div>
        </div>
    );
}

// === SUB-COMPONENTS ===

const SpeakerMesh = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="relative w-full aspect-square max-w-[200px] rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] shadow-[inset_0_8px_25px_rgba(0,0,0,0.8),0_5px_15px_rgba(0,0,0,0.5)] border-8 border-[#c0b49d] flex items-center justify-center overflow-hidden group">
        {/* The Mesh Pattern */}
        <div className="absolute inset-0 opacity-90"
            style={{
                backgroundImage: 'radial-gradient(circle, #111 2.5px, transparent 3px)',
                backgroundSize: '7px 7px',
                backgroundColor: '#222'
            }}
        />
        {/* Pulsing Effect */}
        <motion.div
            className="w-[85%] h-[85%] rounded-full shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]"
            animate={{
                scale: isPlaying ? [1, 1.03, 1] : 1,
                boxShadow: isPlaying
                    ? [
                        'inset 0 0 30px rgba(0,0,0,0.8)',
                        'inset 0 0 30px rgba(234,88,12,0.1)',
                        'inset 0 0 30px rgba(0,0,0,0.8)'
                    ]
                    : 'inset 0 0 30px rgba(0,0,0,0.8)'
            }}
            transition={{
                repeat: Infinity,
                duration: 0.3,
                ease: "easeInOut"
            }}
        >
            {/* Inner Rings */}
            {[0.3, 0.5, 0.7, 0.9].map((scale, i) => (
                <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-orange-900/20"
                    style={{
                        transform: `scale(${scale})`,
                        top: '50%',
                        left: '50%',
                        marginTop: `-${scale * 50}%`,
                        marginLeft: `-${scale * 50}%`,
                        width: `${scale * 100}%`,
                        height: `${scale * 100}%`
                    }}
                    animate={{
                        borderColor: isPlaying
                            ? ['rgba(120,40,0,0.2)', 'rgba(234,88,12,0.3)', 'rgba(120,40,0,0.2)']
                            : 'rgba(120,40,0,0.2)'
                    }}
                    transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.1
                    }}
                />
            ))}
        </motion.div>
        {/* Chrome Ring Reflection */}
        <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none" />
        <div className="absolute inset-4 rounded-full border border-white/10 pointer-events-none" />
    </div>
);

const TapeReel = ({ spinning }: { spinning: boolean }) => {
    const [rotation, setRotation] = React.useState(0);

    React.useEffect(() => {
        if (!spinning) return;

        const interval = setInterval(() => {
            setRotation(prev => (prev + 1) % 360);
        }, 1000 / 180); // 360 degrees in 2 seconds = 180 steps per second

        return () => clearInterval(interval);
    }, [spinning]);

    return (
        <div
            className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#e0e0e0] to-[#ccc] border-4 border-[#333] relative shadow-lg z-10 flex items-center justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            {/* Teeth */}
            {[0, 60, 120, 180, 240, 300].map((deg) => (
                <div key={deg} className="absolute w-1.5 h-3 bg-[#333] rounded-sm" style={{ transform: `rotate(${deg}deg) translate(0, -18px)` }} />
            ))}
            {/* Center Hole */}
            <div className="w-4 h-4 bg-[#111] rounded-full shadow-inner" />
        </div>
    );
};

const Knob = ({ label, value, onChange, disabled = false, sensitivity = 0.5 }: { label: string, value: number, onChange: (v: number) => void, disabled?: boolean, sensitivity?: number }) => {
    const [isDragging, setIsDragging] = useState(false);
    const knobRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        updateKnob(e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && !disabled) {
            updateKnob(e.clientY);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const updateKnob = (clientY: number) => {
        if (!knobRef.current) return;
        const rect = knobRef.current.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const deltaY = centerY - clientY;
        const newValue = Math.max(0, Math.min(100, value + deltaY * sensitivity));
        onChange(Math.round(newValue));
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, value]);

    const rotation = (value / 100) * 270 - 135; // -135° to +135°

    return (
        <div className="flex flex-col items-center gap-1">
            <motion.div
                ref={knobRef}
                className={`w-12 h-12 rounded-full bg-gradient-to-br from-[#555] via-[#333] to-[#222] shadow-[0_5px_10px_rgba(0,0,0,0.5),inset_0_2px_3px_rgba(255,255,255,0.1)] border-2 border-[#444] relative ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                style={{ rotate: rotation }}
                onMouseDown={handleMouseDown}
                whileTap={{ scale: disabled ? 1 : 0.95 }}
                animate={{
                    boxShadow: !disabled && isDragging
                        ? '0 5px 10px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.1), 0 0 20px rgba(234,88,12,0.3)'
                        : '0 5px 10px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.1)'
                }}
            >
                {/* Indicator Line */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full shadow-[0_0_5px_rgba(234,88,12,0.8)]" />
                {/* Center Dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-[#666] to-[#333] rounded-full border border-[#222]" />
            </motion.div>
            <span className="text-[8px] text-[#999] font-bold uppercase tracking-wider">{label}</span>
            <span className="text-[7px] text-orange-500/70 font-mono">{value}</span>
        </div>
    );
};

const TransportBtn = ({ icon, onClick, active = false, disabled = false }: any) => (
    <motion.button
        onClick={onClick}
        disabled={disabled}
        className={`
            w-10 h-10 md:w-12 md:h-10 rounded-lg flex items-center justify-center transition-all duration-100 border-b-4 active:border-b-0 active:translate-y-1
            ${disabled
                ? 'bg-gray-600 text-gray-400 border-gray-800 opacity-50 cursor-not-allowed'
                : active
                    ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white border-orange-900 shadow-[0_0_20px_rgba(234,88,12,0.6),inset_0_2px_5px_rgba(0,0,0,0.3)]'
                    : 'bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] text-[#333] border-[#999] shadow-[0_4px_8px_rgba(0,0,0,0.3)] hover:from-white hover:to-[#e0e0e0]'}
        `}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
    >
        {icon}
    </motion.button>
);
