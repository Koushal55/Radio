"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, Square, Power } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";
import { useStaticNoise } from "@/hooks/useStaticNoise";
import { songData } from "@/data/songs";
import yearsData from "@/data/years.json";

export default function RetroRadioBoombox() {
    // --- STATE ---
    const [year, setYear] = useState(2010);
    const [isIndianMode, setIsIndianMode] = useState(true);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolume] = useState(70);
    const [tone, setTone] = useState(50);
    const [isPowerOn, setIsPowerOn] = useState(true);
    const [theme, setTheme] = useState<'classic' | 'midnight'>('classic');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isTuning, setIsTuning] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Logic State
    const [cache, setCache] = useState<Record<string, string[]>>({});
    const playerRef = useRef<any>(null);
    const { playStatic, stopStatic } = useStaticNoise();

    const START_YEAR = 2000;
    const END_YEAR = 2026;
    const TOTAL_YEARS = END_YEAR - START_YEAR;

    // --- HELPER FUNCTIONS ---

    const getFallbackSongs = useCallback((selectedYear: number, mode: 'indian' | 'global'): string[] => {
        if (songData[selectedYear]) {
            const modeKey = mode === 'indian' ? 'indian' : 'global';
            const songs = songData[selectedYear][modeKey];
            if (songs && songs.length > 0) {
                return songs;
            }
        }

        const yearKey = selectedYear.toString();
        const staticSongs = (yearsData as Record<string, string[]>)[yearKey];
        return staticSongs && staticSongs.length > 0 ? staticSongs : [];
    }, []);

    const playRandomFromList = useCallback((list: string[]) => {
        if (!list || !list.length) {
            console.warn("Empty song list provided");
            setIsLoading(false);
            stopStatic();
            return;
        }
        let newId = list[Math.floor(Math.random() * list.length)];
        if (list.length > 1 && newId === videoId) {
            newId = list.find(id => id !== videoId) || newId;
        }
        setVideoId(newId);
    }, [videoId, stopStatic]);

    const playMusicForYear = useCallback(async (selectedYear: number) => {
        const cacheKey = `${selectedYear}-${isIndianMode ? 'in' : 'gl'}`;

        try {
            if (cache[cacheKey]?.length > 0) {
                const cachedList = cache[cacheKey];
                let nextVid = cachedList[Math.floor(Math.random() * cachedList.length)];
                if (cachedList.length > 1 && nextVid === videoId) {
                    nextVid = cachedList.find(v => v !== videoId) || nextVid;
                }
                setVideoId(nextVid);
                return;
            }

            setVideoId(null);

            const modifiers = ["best", "hit", "popular", "chartbuster", "playlist", "official", "original"];
            const randomMod = modifiers[Math.floor(Math.random() * modifiers.length)];

            const baseQuery = isIndianMode
                ? `top bollywood songs ${selectedYear} hit`
                : `top billboard hits ${selectedYear}`;

            const fullQuery = `${baseQuery} ${randomMod}`;

            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(fullQuery)}&year=${selectedYear}`);

                if (!res.ok) {
                    throw new Error(`API returned status ${res.status}`);
                }

                const data = await res.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.items?.length > 0) {
                    const ids = data.items.map((item: any) => item.id?.videoId).filter((id: string) => id);

                    if (ids.length > 0) {
                        setCache(prev => ({ ...prev, [cacheKey]: ids }));
                        setVideoId(ids[0]);
                        return;
                    }
                }
            } catch (apiError) {
                console.warn("API fetch failed, trying fallback:", apiError);
            }

            const fallbackSongs = getFallbackSongs(selectedYear, isIndianMode ? 'indian' : 'global');
            if (fallbackSongs.length > 0) {
                console.log(`Using fallback songs for year ${selectedYear} (${isIndianMode ? 'Indian' : 'Global'} mode)`);
                setCache(prev => ({ ...prev, [cacheKey]: fallbackSongs }));
                playRandomFromList(fallbackSongs);
                return;
            }

            console.warn(`No songs found for year ${selectedYear} in ${isIndianMode ? 'Indian' : 'International'} mode`);
            setIsLoading(false);
        } catch (e) {
            console.error("Error in playMusicForYear:", e);
            setIsLoading(false);
            stopStatic();
        }
    }, [isIndianMode, cache, videoId, playRandomFromList, getFallbackSongs, stopStatic]);

    // --- LOGIC: TUNING & FETCHING ---

    useEffect(() => {
        if (!year || !isPowerOn || isDragging) return;

        setIsTuning(true);
        setIsLoading(true);
        playStatic(0.15);

        const t = setTimeout(() => {
            playMusicForYear(year);
        }, 1000);

        return () => {
            clearTimeout(t);
        };
    }, [year, isIndianMode, isPowerOn, isDragging, refreshTrigger, playMusicForYear, playStatic]);

    useEffect(() => {
        if (!isTuning && isPlaying) {
            stopStatic();
        } else if (isTuning && isPowerOn) {
            playStatic(0.15);
        } else if (!isPowerOn) {
            stopStatic();
        }
    }, [isTuning, isPlaying, isPowerOn, stopStatic, playStatic]);

    useEffect(() => {
        if (playerRef.current && isPowerOn) {
            try {
                playerRef.current.setVolume(volume);
            } catch (e) {
                console.warn("Player error:", e);
            }
        }
    }, [volume, isPowerOn]);

    // --- PLAYER EVENT HANDLERS ---

    const handleNext = useCallback(() => {
        if (!isPowerOn) return;

        if (playerRef.current) {
            try {
                playerRef.current.stopVideo();
            } catch (e) {
                console.warn("Could not stop video:", e);
            }
        }

        setIsTuning(true);
        setIsLoading(true);
        setIsPlaying(false);
        playStatic(0.15);
        setRefreshTrigger(prev => prev + 1);
    }, [isPowerOn, playStatic]);

    const handlePlayPause = () => {
        if (!isPowerOn) return;

        if (!videoId) {
            setIsLoading(true);
            playStatic(0.15);
            playMusicForYear(year);
            return;
        }

        if (!playerRef.current) {
            return;
        }

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
            playerRef.current.pauseVideo();
        } catch (e) {
            console.warn("Stop error:", e);
        }
        setIsPlaying(false);
        setIsLoading(false);
        stopStatic();
    };

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

    const onPlayerStateChange: YouTubeProps["onStateChange"] = useCallback((event: { data: number; }) => {
        if (event.data === 1) {
            setIsPlaying(true);
            setIsLoading(false);
            setIsTuning(false);
            stopStatic();
        }
        else if (event.data === 3) {
            if (!isPlaying) {
                setIsTuning(true);
                setIsLoading(true);
                playStatic(0.1);
            }
        }
        else if (event.data === 2) {
            setIsPlaying(false);
            setIsLoading(false);
        }
        else if (event.data === 0) {
            setIsPlaying(false);
            setIsTuning(true);
            setIsLoading(true);
            playStatic(0.15);
            handleNext();
        }
    }, [handleNext, stopStatic, playStatic, isPlaying]);

    const onPlayerError = useCallback((event: any) => {
        console.warn("Video unavailable, skipping...", event?.data);
        const cacheKey = `${year}-${isIndianMode ? 'in' : 'gl'}`;
        if (cache[cacheKey]?.length > 1) {
            const failedVideoId = videoId;
            const filteredCache = cache[cacheKey].filter(id => id !== failedVideoId);
            if (filteredCache.length > 0) {
                setCache(prev => ({ ...prev, [cacheKey]: filteredCache }));
                playRandomFromList(filteredCache);
                return;
            }
        }
        handleNext();
    }, [handleNext, year, isIndianMode, cache, videoId, playRandomFromList]);

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

    const needlePos = ((year - START_YEAR) / TOTAL_YEARS) * 100;

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 font-sans selection:bg-orange-500 selection:text-white overflow-hidden relative transition-colors duration-1000 ${theme === 'classic'
            ? 'bg-[radial-gradient(circle_at_center,#2c241b,#0f0f0f)]'
            : 'bg-[radial-gradient(circle_at_center,#1a1a2e,#000000)]'
            }`}>

            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className={`absolute inset-0 ${theme === 'classic' ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(255,100,0,0.05),transparent_60%)]' : 'bg-[radial-gradient(circle_at_50%_50%,rgba(100,100,255,0.05),transparent_60%)]'}`} />
            </div>

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

            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`
                w-[85%] 
                max-w-4xl 
                aspect-auto
                md:aspect-[1.8/1]
                transition-all duration-700
                rounded-3xl 
                shadow-[0_50px_100px_rgba(0,0,0,0.8),0_0_80px_rgba(0,0,0,0.3),inset_0_2px_5px_rgba(255,255,255,0.2)] 
                border-4 
                flex flex-col 
                relative
                overflow-hidden
                ${theme === 'classic'
                        ? 'bg-gradient-to-br from-[#e8d9c4] via-[#d6cbb6] to-[#c4b5a0] border-[#b0a38e]'
                        : 'bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#0a0a0a] border-[#333]'
                    }
            `}
                style={{
                    filter: isPowerOn ? 'none' : 'grayscale(0.8) brightness(0.6)'
                }}
            >

                {/* 1. TOP SECTION: TUNER WINDOW & DIAL */}
                <div className="relative h-[28%] bg-gradient-to-b from-[#1a1a1a] to-[#222] border-b-8 border-[#0a0a0a] flex items-center px-6 md:px-12 shadow-[0_10px_30px_rgba(0,0,0,0.9)]">

                    <motion.div
                        className="absolute top-4 right-4"
                        animate={{ opacity: isPowerOn ? 1 : 0.3 }}
                    >
                        <div className={`w-3 h-3 rounded-full ${isPowerOn ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'bg-stone-800'} transition-all duration-300`} />
                    </motion.div>

                    <div className="relative w-full h-[70%] bg-gradient-to-b from-[#0a0a0a] to-[#111] rounded-lg border-2 border-[#444] shadow-[inset_0_10px_30px_rgba(0,0,0,1),0_0_20px_rgba(234,88,12,0.2)] overflow-hidden">
                        {/* Glass Reflection (Z-Index: 30) */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-30" />
                        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-30" />

                        {/* Frequency Lines (Z-Index: 10) */}
                        <div className="absolute inset-0 flex justify-between items-end px-4 md:px-12 pb-2 z-10">
                            {[2000, 2005, 2010, 2015, 2020, 2026].map((y) => (
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

                        {/* The Moving Needle (Z-Index: 20) */}
                        <motion.div
                            className="absolute top-0 bottom-0 w-[3px] z-20"
                            animate={{
                                left: `${needlePos}%`,
                                background: isPowerOn ? 'linear-gradient(to bottom, rgba(234,88,12,1), rgba(234,88,12,0.5))' : 'rgba(100,100,100,0.3)',
                                boxShadow: isPowerOn ? '0 0 20px rgba(234,88,12,0.9), 0 0 40px rgba(234,88,12,0.5)' : 'none'
                            }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        />

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

                        {/* Tuning Progress Bar (Replacing Digital Year) */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[60%] h-1.5 bg-stone-900 rounded-full overflow-hidden border border-white/5 z-20">
                            <motion.div
                                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(234,88,12,0.5)]"
                                animate={{ width: `${needlePos}%` }}
                                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            />
                        </div>

                        {/* Interactive Slider Overlay */}
                        <input
                            type="range"
                            min={START_YEAR}
                            max={END_YEAR}
                            step={1}
                            value={year}
                            onChange={(e) => isPowerOn && setYear(Number(e.target.value))}
                            disabled={!isPowerOn}
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-full opacity-0 cursor-pointer disabled:cursor-not-allowed active:cursor-grabbing z-25"
                        />
                    </div>
                </div>


                {/* 2. MIDDLE SECTION: CONTROLS & TAPE DECK */}
                <div className={`flex-1 border-b-4 flex flex-col md:grid md:grid-cols-12 p-4 md:p-6 gap-4 md:gap-6 shadow-inner transition-colors duration-700 ${theme === 'classic' ? 'bg-[#4b4338] border-[#3a332a]' : 'bg-[#111] border-[#000]'
                    }`}>

                    {/* Left: Audio Controls (3 cols) */}
                    <div className="md:col-span-3 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-4">
                        <div className="hidden sm:block bg-gradient-to-b from-[#1a1a1a] to-[#222] rounded-lg border border-[#555] p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                            <div className="text-[8px] text-[#888] text-center tracking-widest mb-1.5 font-mono">VU LEVEL</div>
                            <div className="flex gap-2 h-14 justify-center items-end">
                                <div className="flex flex-col gap-[2px] h-full justify-end">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div key={`l-${i}`}
                                            className={`w-3 md:w-4 h-[8%] rounded-sm ${i > 7 ? 'bg-red-600' : i > 4 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                            animate={{
                                                opacity: isPlaying && isPowerOn ? (Math.random() > 0.3 ? 1 : 0.2) : 0.15,
                                            }}
                                            transition={{ duration: 0.05 }}
                                        />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-[2px] h-full justify-end">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div key={`r-${i}`}
                                            className={`w-3 md:w-4 h-[8%] rounded-sm ${i > 7 ? 'bg-red-600' : i > 4 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                            animate={{
                                                opacity: isPlaying && isPowerOn ? (Math.random() > 0.3 ? 1 : 0.2) : 0.15,
                                            }}
                                            transition={{ duration: 0.05 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-around flex-1 items-center gap-4">
                            <Knob label="VOL" value={volume} onChange={setVolume} disabled={!isPowerOn} sensitivity={0.5} theme={theme} setIsDragging={setIsDragging} />
                            <Knob
                                label="TUNE"
                                value={Math.round(((year - START_YEAR) / TOTAL_YEARS) * 100)}
                                onChange={(val) => {
                                    const newYear = Math.round(START_YEAR + (val / 100) * TOTAL_YEARS);
                                    setYear(newYear);
                                }}
                                disabled={!isPowerOn}
                                sensitivity={0.3}
                                theme={theme}
                                setIsDragging={setIsDragging}
                            />
                        </div>
                    </div>

                    {/* Center: Cassette Deck (6 cols) */}
                    <div className="md:col-span-6 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl shadow-[inset_0_3px_15px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.5)] border-2 border-[#3a3a3a] p-3 md:p-4 flex flex-col relative overflow-hidden group">

                        <div className="flex-1 bg-gradient-to-b from-[#0a0a0a] to-[#111] rounded-lg border-2 border-[#333] relative flex items-center justify-center gap-4 md:gap-8 mb-3 overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,1)]">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,#444_1px,transparent_1px)] bg-[length:5px_5px]" />

                            {isPlaying && isPowerOn && <WaveformVisualizer />}

                            <TapeReel spinning={isPlaying && isPowerOn} />

                            <div className={`absolute w-[30%] h-[50%] rounded-sm z-0 flex items-center justify-center flex-col shadow-[0_2px_8px_rgba(0,0,0,0.5)] border transition-colors duration-500 ${theme === 'classic'
                                ? 'bg-gradient-to-br from-[#d4c5a9] to-[#c0b090] border-[#a89677]'
                                : 'bg-gradient-to-br from-[#333] to-[#222] border-[#444]'
                                }`}>
                            </div>

                            <TapeReel spinning={isPlaying && isPowerOn} />
                        </div>

                        <div className="flex justify-center gap-3 md:gap-6 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] p-2 rounded-lg border-t-2 border-[#444] shadow-[inset_0_3px_10px_rgba(0,0,0,0.9)]">
                            <TransportBtn onClick={handleNext} icon={<SkipBack size={20} fill="currentColor" />} disabled={!isPowerOn} label="PREV" />
                            <TransportBtn onClick={handlePlayPause} icon={isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />} active={isPlaying} disabled={!isPowerOn} label={isPlaying ? "PAUSE" : "PLAY"} />
                            <TransportBtn onClick={handleStop} icon={<Square size={20} fill="currentColor" />} disabled={!isPowerOn} label="STOP" />
                            <TransportBtn onClick={handleNext} icon={<SkipForward size={20} fill="currentColor" />} disabled={!isPowerOn} label="NEXT" />
                        </div>
                    </div>

                    {/* Right: Mode & Tuner (3 cols) */}
                    <div className="md:col-span-3 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-4">
                        <div className="flex justify-between items-center w-full px-2">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#555] mb-1 tracking-widest">POWER</span>
                                <motion.button
                                    onClick={togglePower}
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 ${isPowerOn
                                        ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                                        : 'bg-gradient-to-br from-[#333] to-[#222] border-[#444]'
                                        }`}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Power size={18} className={`${isPowerOn ? 'text-white' : 'text-[#555]'}`} />
                                </motion.button>
                            </div>

                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#555] mb-1 tracking-widest">THEME</span>
                                <motion.button
                                    onClick={() => setTheme(prev => prev === 'classic' ? 'midnight' : 'classic')}
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-md transition-all duration-300 ${theme === 'classic'
                                        ? 'bg-amber-100 border-amber-300'
                                        : 'bg-slate-800 border-slate-600'
                                        }`}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <div className={`w-4 h-4 rounded-full ${theme === 'classic' ? 'bg-orange-500' : 'bg-slate-400'}`} />
                                </motion.button>
                            </div>
                        </div>

                        <div className="w-full bg-gradient-to-b from-[#444] to-[#333] rounded-lg p-1 flex shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.1)] border border-[#222]">
                            <button
                                onClick={() => isPowerOn && setIsIndianMode(false)}
                                disabled={!isPowerOn}
                                className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${!isIndianMode && isPowerOn
                                    ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5),0_0_15px_rgba(234,88,12,0.5)]'
                                    : 'text-stone-400 hover:text-white'
                                    }`}
                            >
                                INTL
                            </button>
                            <button
                                onClick={() => isPowerOn && setIsIndianMode(true)}
                                disabled={!isPowerOn}
                                className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${isIndianMode && isPowerOn
                                    ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5),0_0_15px_rgba(234,88,12,0.5)]'
                                    : 'text-stone-400 hover:text-white'
                                    }`}
                            >
                                IND
                            </button>
                        </div>

                        <div className="flex-1 w-full flex flex-col justify-end gap-2 overflow-visible">
                            <label className="text-[10px] text-orange-400 font-bold uppercase text-center w-full tracking-wider">
                                {isPowerOn ? `TUNE TO ${year}` : 'FINE TUNING'}
                            </label>
                            <div className="relative h-10 w-full bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#222] rounded-xl shadow-[inset_0_4px_15px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.5)] border-2 border-[#333] flex items-center px-2 overflow-visible">
                                <div className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none">
                                    {[START_YEAR, Math.floor((START_YEAR + END_YEAR) / 2), END_YEAR].map((y) => (
                                        <div key={y} className="flex flex-col items-center gap-1">
                                            <div className={`w-1 h-1.5 ${year === y && isPowerOn ? 'bg-orange-500' : 'bg-[#444]'}`} />
                                            <span className={`text-[6px] font-mono ${year === y && isPowerOn ? 'text-orange-500' : 'text-[#666]'}`}>{y}</span>
                                        </div>
                                    ))}
                                </div>

                                <motion.div
                                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-900/30 via-orange-800/20 to-transparent pointer-events-none"
                                    style={{ width: `${needlePos}%` }}
                                    animate={{
                                        opacity: isPowerOn ? [0.3, 0.5, 0.3] : 0,
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />

                                <input
                                    type="range"
                                    min={START_YEAR}
                                    max={END_YEAR}
                                    step={1}
                                    value={year}
                                    onChange={(e) => isPowerOn && setYear(Number(e.target.value))}
                                    disabled={!isPowerOn}
                                    className="w-full h-full opacity-0 absolute inset-0 z-30 cursor-pointer disabled:cursor-not-allowed active:cursor-grabbing"
                                />

                                <motion.div
                                    className="absolute w-8 h-8 rounded-full z-20 pointer-events-none"
                                    style={{ left: `calc(${needlePos}% - 16px)` }}
                                    animate={{
                                        scale: isPowerOn ? 1 : 0.9,
                                    }}
                                >
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-600 to-orange-800 shadow-[0_0_20px_rgba(234,88,12,0.8)] border-2 border-orange-400"
                                        animate={{
                                            boxShadow: isPowerOn
                                                ? ['0 0 15px rgba(234,88,12,0.6)', '0 0 25px rgba(234,88,12,0.8)', '0 0 15px rgba(234,88,12,0.6)']
                                                : '0 0 5px rgba(100,100,100,0.3)',
                                            opacity: isPowerOn ? 1 : 0.5
                                        }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />

                                    <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[#fff] via-[#ccc] to-[#888] shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-2px_5px_rgba(0,0,0,0.5)] border border-[#aaa]" />

                                    <motion.div
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
                                        animate={{
                                            backgroundColor: isPowerOn ? '#f97316' : '#666',
                                            boxShadow: isPowerOn ? '0 0 12px rgba(234,88,12,1), inset 0 1px 3px rgba(0,0,0,0.8)' : 'inset 0 1px 3px rgba(0,0,0,0.8)'
                                        }}
                                    />
                                </motion.div>
                            </div>
                        </div>


                    </div>
                </div>


                {/* 3. BOTTOM SECTION: SPEAKERS */}
                <div className={`h-[35%] flex items-center relative transition-colors duration-700 ${theme === 'classic' ? 'bg-gradient-to-br from-[#e8d9c4] via-[#d6cbb6] to-[#c4b5a0]' : 'bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#0a0a0a]'
                    }`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-transparent pointer-events-none" />

                    <div className="w-[30%] h-full flex items-center justify-center p-2">
                        <SpeakerMesh isPlaying={isPlaying && isPowerOn} />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center z-10">
                        <motion.div
                            className={`px-8 py-3 rounded-lg border-2 shadow-[0_5px_15px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] mb-3 transition-colors duration-700 ${theme === 'classic'
                                ? 'bg-gradient-to-br from-[#d4c5a9] to-[#bdae93] border-[#a39276]'
                                : 'bg-gradient-to-br from-[#333] to-[#222] border-[#444]'
                                }`}
                            animate={{
                                boxShadow: isPowerOn && isPlaying
                                    ? '0 5px 15px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3), 0 0 30px rgba(234,88,12,0.2)'
                                    : '0 5px 15px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
                            }}
                        >
                            <span className={`text-3xl md:text-4xl font-black tracking-widest ${theme === 'classic' ? 'text-[#3d342b]' : 'text-[#888]'
                                }`}>
                                SONIC<span className="text-orange-600">BOOM</span>
                            </span>
                        </motion.div>
                        <div className="flex gap-3 items-center bg-[#222]/80 px-6 py-2 rounded-full border border-white/10">
                            <motion.div
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300`}
                                animate={{
                                    backgroundColor: isLoading ? '#f59e0b' : isPlaying && isPowerOn ? '#22c55e' : '#7f1d1d',
                                    boxShadow: isLoading
                                        ? '0 0 10px #f59e0b'
                                        : isPlaying && isPowerOn
                                            ? '0 0 10px #22c55e'
                                            : 'none',
                                }}
                            />
                            <span className="text-xs font-mono text-white/80 uppercase tracking-wider font-bold">
                                {isLoading ? 'Searching...' : isPlaying ? 'Playing' : 'Stopped'}
                            </span>
                        </div>
                    </div>

                    <div className="w-[30%] h-full flex items-center justify-center p-2">
                        <SpeakerMesh isPlaying={isPlaying && isPowerOn} />
                    </div>
                </div>

            </motion.div>

            <div className="fixed opacity-0 pointer-events-none -z-50">
                {videoId && (
                    <YouTube
                        videoId={videoId}
                        opts={{
                            height: '0',
                            width: '0',
                            playerVars: {
                                autoplay: 1,
                                controls: 0,
                                modestbranding: 1,
                            },
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

// === SUB COMPONENTS ===

const SpeakerMesh = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="relative w-full aspect-square max-w-[200px] rounded-full overflow-hidden">
        <motion.div
            className="w-full h-full rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-4 border-[#222] relative shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]"
            style={{
                backgroundImage: `
                    radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%),
                    radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%),
                    radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%),
                    radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%)
                `,
                backgroundSize: '8px 8px, 8px 8px, 8px 8px, 8px 8px',
                backgroundPosition: '0 0, 4px 0, 4px 4px, 0 4px',
                backgroundColor: '#2a2a2a'
            }}
        >
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full border border-[#444]"
                    style={{
                        inset: `${15 + i * 12}%`,
                        opacity: 0.2 + (i * 0.1)
                    }}
                    animate={{
                        scale: isPlaying ? [1, 1.02, 1] : 1,
                    }}
                    transition={{
                        duration: 0.3,
                        repeat: isPlaying ? Infinity : 0,
                        delay: i * 0.05
                    }}
                />
            ))}
        </motion.div>
    </div>
);

const TapeReel = ({ spinning }: { spinning: boolean }) => {
    const [rotation, setRotation] = React.useState(0);

    React.useEffect(() => {
        if (!spinning) return;

        const interval = setInterval(() => {
            setRotation(prev => (prev + 1) % 360);
        }, 1000 / 180);

        return () => clearInterval(interval);
    }, [spinning]);

    return (
        <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#e0e0e0] to-[#ccc] border-4 border-[#333] relative shadow-lg z-10 flex items-center justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            {[0, 60, 120, 180, 240, 300].map((deg) => (
                <div key={deg} className="absolute w-1.5 h-3 bg-[#333] rounded-sm" style={{ transform: `rotate(${deg}deg) translate(0, -18px)` }} />
            ))}
            <div className="w-4 h-4 bg-[#111] rounded-full shadow-inner" />
        </div>
    );
};

const WaveformVisualizer = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-50 z-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    className="w-1.5 bg-orange-500/60 rounded-full"
                    animate={{
                        height: ['10%', '60%', '10%'],
                    }}
                    transition={{
                        duration: 0.5 + Math.random() * 0.5,
                        repeat: Infinity,
                        delay: Math.random() * 0.5,
                        ease: "easeInOut"
                    }}
                />
            ))}
        </div>
    );
};

const Knob = ({ label, value, onChange, disabled = false, sensitivity = 0.5, theme = 'classic', setIsDragging }: { label: string, value: number, onChange: (v: number) => void, disabled?: boolean, sensitivity?: number, theme?: 'classic' | 'midnight', setIsDragging?: (d: boolean) => void }) => {
    const knobRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        const target = e.currentTarget as HTMLDivElement;
        target.setPointerCapture(e.pointerId);
        // Store initial Y position and value
        (target as any)._startY = e.clientY;
        (target as any)._startValue = value;
        if (setIsDragging) setIsDragging(true);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (setIsDragging) setIsDragging(false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;

        const target = e.currentTarget as any;
        const deltaY = target._startY - e.clientY; // Up is positive
        const newValue = Math.max(0, Math.min(100, target._startValue + deltaY * sensitivity));

        if (Math.round(newValue) !== value) {
            onChange(Math.round(newValue));
        }
    };

    const rotation = (value / 100) * 270 - 135;

    return (
        <div className="flex flex-col items-center gap-1">
            <motion.div
                ref={knobRef}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full shadow-[0_5px_10px_rgba(0,0,0,0.5),inset_0_2px_3px_rgba(255,255,255,0.1)] border-2 border-[#444] relative touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-ns-resize'} ${theme === 'classic'
                    ? 'bg-gradient-to-br from-[#555] via-[#333] to-[#222]'
                    : 'bg-gradient-to-br from-[#333] via-[#111] to-[#000]'
                    }`}
                style={{ rotate: rotation }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                whileTap={{ scale: disabled ? 1 : 0.95 }}
            >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 md:h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full shadow-[0_0_5px_rgba(234,88,12,0.8)]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 md:w-4 h-3 md:h-4 bg-gradient-to-br from-[#666] to-[#333] rounded-full border border-[#222]" />
            </motion.div>
            <span className="text-[8px] text-[#999] font-bold uppercase tracking-wider">{label}</span>
            <span className="text-[7px] text-orange-500/70 font-mono">{value}</span>
        </div>
    );
};

const TransportBtn = ({ icon, onClick, active = false, disabled = false, label }: any) => (
    <div className="flex flex-col items-center gap-1">
        <motion.button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-100 border-b-4 active:border-b-0 active:translate-y-1
                ${disabled
                    ? 'bg-gray-600 text-gray-400 border-gray-800 opacity-50 cursor-not-allowed'
                    : active
                        ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white border-orange-900 shadow-[0_0_20px_rgba(234,88,12,0.6),inset_0_2px_5px_rgba(0,0,0,0.3)]'
                        : 'bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] text-[#333] border-[#999] shadow-[0_2px_4px_rgba(0,0,0,0.2)] hover:from-white hover:to-[#e0e0e0]'}
            `}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
        >
            {icon}
        </motion.button>
        <span className="text-[7px] font-bold text-[#666] tracking-wider">{label}</span>
    </div>
);
