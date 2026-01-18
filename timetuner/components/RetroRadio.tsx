"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import YouTube, { YouTubeProps } from "react-youtube";
import { Power, Play, Pause, FastForward, Rewind, Square } from "lucide-react";
import { songData } from "../data/songs";

// --- CONSTANTS ---
const START_YEAR = 2000;
const END_YEAR = 2026;

// --- FALLBACKS (Instant play if API fails) ---
// --- FALLBACKS (Instant play if API fails) ---
const FALLBACKS: Record<string, string[]> = {
    "INTL": ["dQw4w9WgXcQ", "L_jWHffIx5E", "fJ9rUzIMcZQ", "9bZkp7q19f0"], // Rick Roll, Smash Mouth, Queen, Gangnam Style
    "IND": ["JwnZ_2h3g_w", "Bznxx12Ptl0", "xRb8hxwN5zc", "YxWlaYCA8MU"],  // Chaiyya Chaiyya, Bahubali, Naatu Naatu, Why This Kolaveri Di
};

// --- AUDIO HOOK (Static Noise) ---
const useStaticNoise = (volume: number) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Ensure /sounds/static.mp3 exists in your public folder!
        const audio = new Audio("/sounds/static.mp3");
        audio.loop = true;
        audioRef.current = audio;
        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, volume));
        }
    }, [volume]);

    const play = useCallback(() => audioRef.current?.play().catch(() => { }), []);
    const stop = useCallback(() => audioRef.current?.pause(), []);

    return { play, stop };
};

export default function RetroRadio() {
    // --- STATE ---
    const [power, setPower] = useState(true);
    const [year, setYear] = useState(2010);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(80);
    const [tone, setTone] = useState(50);

    // Logic States
    const [isDragging, setIsDragging] = useState(false);
    const [isTuning, setIsTuning] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [isIndianMode, setIsIndianMode] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
    const [nextVideoId, setNextVideoId] = useState<string | null>(null);
    const playerRef = useRef<any>(null);
    const [songCache, setSongCache] = useState<Record<string, string[]>>({});

    const rotation = useMotionValue(0);
    const needlePercent = useTransform(rotation, [0, 360], ["0%", "100%"]);

    const { play: playStatic, stop: stopStatic } = useStaticNoise(volume / 200);

    // --- 1. INITIALIZE ---
    useEffect(() => {
        const range = END_YEAR - START_YEAR;
        const percent = (2010 - START_YEAR) / range;
        rotation.set(percent * 360);
    }, [rotation]);

    // --- 1.5 CLEAR PRELOAD ON CHANGE ---
    useEffect(() => {
        setNextVideoId(null); // Clear preload when year/mode changes
    }, [year, isIndianMode]);

    // --- 2. VOLUME SYNC ---
    useEffect(() => {
        if (playerRef.current) playerRef.current.setVolume(volume);
    }, [volume]);

    // --- 2.5 POWER SYNC ---
    useEffect(() => {
        if (!power) {
            if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                playerRef.current.stopVideo();
            }
            setIsPlaying(false);
            setIsTuning(false);
            stopStatic();
        }
    }, [power, stopStatic]);

    // --- 3. ROBUST FETCH LOGIC ---
    const fetchSong = useCallback(async (isPreload: boolean = false) => {
        if (!power) return;

        if (!isPreload) {
            setIsTuning(true);
            setIsPlaying(false);
        }

        // SAFETY VALVE: Force stop static after 8 seconds if nothing happens (only for main fetch)
        let safetyTimer: NodeJS.Timeout;
        if (!isPreload) {
            safetyTimer = setTimeout(() => {
                if (!isPlaying) setIsTuning(false);
            }, 8000);
        }

        try {
            const cacheKey = `${year}-${isIndianMode ? 'IND' : 'INTL'}`;

            // A. Try Cache
            if (songCache[cacheKey] && songCache[cacheKey].length > 0) {
                const cachedList = songCache[cacheKey];

                // If we have enough songs to choose from, or if we haven't played the only one yet
                if (cachedList.length > 1 || (cachedList.length === 1 && cachedList[0] !== currentVideoId)) {
                    let nextVid = cachedList[Math.floor(Math.random() * cachedList.length)];
                    // Try to find a different song
                    if (nextVid === currentVideoId && cachedList.length > 1) {
                        nextVid = cachedList.find(v => v !== currentVideoId) || nextVid;
                    }
                    if (isPreload) {
                        if (nextVid !== currentVideoId) setNextVideoId(nextVid);
                    } else {
                        setCurrentVideoId(nextVid);
                        clearTimeout(safetyTimer!);
                    }
                    return;
                }
                // If we are here, cache is too small or exhausted. Fall through to fetch more.
            }

            // B. API Fetch
            let query = "";

            if (isIndianMode) {
                const rand = Math.random();
                // Aggressive negatives to prevent "New Year Party Mixes" or International Mashups
                const negatives = "-mashup -remix -cover -english -hollywood -party -club -mix -jukebox -nonstop -dj";

                if (rand < 0.75) {
                    // 75% Telugu
                    query = `best telugu movie songs ${year} hit ${negatives}`;
                } else if (rand < 0.875) {
                    // 12.5% Hindi
                    query = `top bollywood songs ${year} hit ${negatives}`;
                } else {
                    // 12.5% Tamil
                    query = `top tamil movie songs ${year} hit ${negatives}`;
                }
            } else {
                // International
                query = `top billboard hits ${year} -mashup -remix -cover -jukebox -nonstop`;
            }

            const modifiers = ["official video", "full video song", "original audio"];
            const randomMod = modifiers[Math.floor(Math.random() * modifiers.length)];
            query = `${query} ${randomMod}`;

            // Set a 3-second timeout for the API call itself
            const controller = new AbortController();
            const fetchTimeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&year=${year}`, { signal: controller.signal });
            clearTimeout(fetchTimeout);

            const data = await res.json();

            if (data.items && data.items.length > 0) {
                const videoIds = data.items.map((item: any) => item.id.videoId);

                // --- SMART DB EXPANSION ---
                // Check which of these are NOT in our static DB
                const staticYearData = songData[year];
                const existingList = staticYearData ? (isIndianMode ? staticYearData.indian : staticYearData.global) : [];

                // Filter out songs we already have
                const newDiscoveries = videoIds.filter((vid: string) => !existingList.includes(vid));

                let vidToPlay = "";
                let shouldSave = false;

                if (newDiscoveries.length > 0) {
                    // Found new songs! Play one of them.
                    vidToPlay = newDiscoveries[Math.floor(Math.random() * newDiscoveries.length)];
                    shouldSave = true;
                } else {
                    // All songs are already in DB. Just play one from the API list.
                    vidToPlay = videoIds[Math.floor(Math.random() * videoIds.length)];
                }

                // Merge with existing cache to build a playlist
                setSongCache(prev => {
                    const existing = prev[cacheKey] || [];
                    const merged = Array.from(new Set([...existing, ...videoIds]));
                    return { ...prev, [cacheKey]: merged };
                });

                if (isPreload) {
                    if (vidToPlay !== currentVideoId) setNextVideoId(vidToPlay);
                } else {
                    setCurrentVideoId(vidToPlay);
                }

                // Save to DB if it's a new discovery
                if (shouldSave) {
                    fetch('/api/save-song', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            year,
                            mode: isIndianMode ? 'indian' : 'global',
                            videoId: vidToPlay
                        })
                    }).catch(err => console.error("Failed to save song:", err));
                }
            } else {
                // C. Fallback if API returns empty (or Quota Exceeded)
                // The Static DB is ONLY used when the live API fails to return songs.
                console.warn("API returned no results (likely Quota Exceeded), switching to Static DB");

                let fallbackVid = "";
                // Ensure year is string for lookup
                const yearStr = year.toString();
                const staticYearData = songData[yearStr];

                if (staticYearData) {
                    const list = isIndianMode ? staticYearData.indian : staticYearData.global;
                    if (list && list.length > 0) {
                        // Filter out placeholder IDs (like "9-0_0-0_0-0")
                        const validIds = list.filter(id => !id.includes('-0_0-0_0-0') && id.length >= 11);

                        if (validIds.length > 0) {
                            fallbackVid = validIds[Math.floor(Math.random() * validIds.length)];
                            console.log(`[StaticDB] Found valid song for ${yearStr} (${isIndianMode ? 'IND' : 'INTL'}): ${fallbackVid}`);
                        } else {
                            console.warn(`[StaticDB] Only placeholder IDs found for ${yearStr}, using generic fallback`);
                        }
                    } else {
                        console.warn(`[StaticDB] No songs found for ${yearStr} in mode ${isIndianMode ? 'IND' : 'INTL'}`);
                    }
                } else {
                    console.warn(`[StaticDB] No data found for year ${yearStr}`);
                }

                if (!fallbackVid) {
                    const list = isIndianMode ? FALLBACKS["IND"] : FALLBACKS["INTL"];
                    fallbackVid = list[Math.floor(Math.random() * list.length)];
                }

                if (isPreload) {
                    setNextVideoId(fallbackVid);
                } else {
                    setCurrentVideoId(fallbackVid);
                }
            }

        } catch (error) {
            console.error("Fetch failed, using static DB", error);
            // D. Fallback on Network Error
            let fallbackVid = "";
            const staticYearData = songData[year];
            if (staticYearData) {
                const list = isIndianMode ? staticYearData.indian : staticYearData.global;
                if (list && list.length > 0) {
                    fallbackVid = list[Math.floor(Math.random() * list.length)];
                }
            }

            if (!fallbackVid) {
                const list = isIndianMode ? FALLBACKS["IND"] : FALLBACKS["INTL"];
                fallbackVid = list[Math.floor(Math.random() * list.length)];
            }

            if (isPreload) {
                setNextVideoId(fallbackVid);
            } else {
                setCurrentVideoId(fallbackVid);
            }
        } finally {
            if (!isPreload) clearTimeout(safetyTimer!);
        }
    }, [year, isIndianMode, power, currentVideoId, songCache, isPlaying]);

    // --- 4. TRIGGER FETCH (Debounced for Tuning) ---
    useEffect(() => {
        if (isDragging || !power) return;
        // Debounce only when tuning/dragging
        const timeout = setTimeout(() => fetchSong(false), 500);
        return () => clearTimeout(timeout);
    }, [year, isDragging, isIndianMode, power]);

    // --- 4.5 TRIGGER FETCH (Immediate for Next/Skip) ---
    useEffect(() => {
        if (!power) return;
        // Immediate fetch for button clicks
        fetchSong(false);
    }, [refreshTrigger]);

    // --- 4.6 PRELOAD NEXT SONG ---
    useEffect(() => {
        if (currentVideoId && power) {
            // Wait a bit after current song starts, then preload next
            const timer = setTimeout(() => {
                fetchSong(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [currentVideoId, power]);

    // --- 5. STATIC MANAGER ---
    useEffect(() => {
        // Only play static if dragging OR tuning, but NEVER if playing
        if (power && (isDragging || isTuning) && !isPlaying) {
            playStatic();
        } else {
            stopStatic();
        }
    }, [isDragging, isTuning, power, isPlaying, playStatic, stopStatic]);


    // --- CONTROLS ---
    const handleNext = () => {
        console.log("[DEBUG] handleNext called, power:", power);
        if (!power) return;
        // Immediate feedback: Pause and start static
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
        }
        setIsTuning(true);
        setIsPlaying(false);

        if (nextVideoId) {
            // Use preloaded song immediately!
            setCurrentVideoId(nextVideoId);
            setNextVideoId(null); // Clear used preload
        } else {
            // Fallback to fetch if no preload ready
            setRefreshTrigger(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        console.log("[DEBUG] handlePrev called, power:", power);
        if (!power || !playerRef.current || typeof playerRef.current.seekTo !== 'function') return;
        // distinct behavior: Restart current song
        try {
            playerRef.current.seekTo(0);
            playerRef.current.playVideo();
            setIsPlaying(true);
        } catch (e) {
            console.error("Player control error:", e);
        }
    };

    const handlePlayPause = () => {
        console.log("[DEBUG] handlePlayPause called, power:", power);
        if (!power || !playerRef.current || typeof playerRef.current.playVideo !== 'function') return;
        try {
            isPlaying ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
        } catch (e) {
            console.error("Player control error:", e);
        }
    };

    const handleStop = () => {
        console.log("[DEBUG] handleStop called");
        if (!playerRef.current) return;
        playerRef.current.stopVideo();
        setIsPlaying(false);
    };

    // --- YOUTUBE EVENTS ---
    const onPlayerReady: YouTubeProps['onReady'] = (event) => {
        playerRef.current = event.target;
        event.target.setVolume(volume);
        if (power) event.target.playVideo();
    };

    const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
        try {
            if (event.data === 1) { // PLAYING
                setIsPlaying(true);
                setIsTuning(false);
                stopStatic();
            }
            else if (event.data === 2) { // PAUSED
                setIsPlaying(false);
            }
            else if (event.data === 3) { // BUFFERING
                setIsTuning(true);
            }
            else if (event.data === 0) { // ENDED
                // Use timeout to break call stack and avoid cross-origin bubbling issues
                setTimeout(() => handleNext(), 0);
            }
        } catch (e) {
            console.error("Player state error:", e);
        }
    };

    const onPlayerError = () => {
        console.warn("Video failed to load, skipping...");
        setIsTuning(false);
        // Use timeout to break call stack
        setTimeout(() => handleNext(), 0);
    };

    const updateYearFromRotation = (deg: number) => {
        const range = END_YEAR - START_YEAR;
        const percent = deg / 360;
        const newYear = Math.round(START_YEAR + (percent * range));
        setYear(Math.max(START_YEAR, Math.min(END_YEAR, newYear)));
    };

    return (
        <div className="min-h-screen bg-[#cbbfae] flex items-center justify-center p-4 selection:bg-orange-500 overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[length:20px_20px] pointer-events-none" />

            {/* CHASSIS */}
            <div className={`relative w-full max-w-5xl flex flex-col md:flex-row rounded-[2.5rem] bg-[#e6e6e6] shadow-2xl border-b-8 border-[#d4d4d4] transition-all duration-500 ${!power ? 'brightness-90 grayscale-[0.5]' : ''}`}>

                {/* LEFT: SPEAKER */}
                <div className="w-full md:w-[35%] bg-[#3e2723] rounded-t-[2.5rem] md:rounded-l-[2.5rem] md:rounded-tr-none p-6 md:p-8 relative flex flex-col justify-between border-b-4 md:border-b-0 md:border-r-4 border-[#2d1c19]">
                    <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(45deg,#2d1c19,#2d1c19_10px,#3e2723_10px,#3e2723_20px)] mix-blend-overlay pointer-events-none" />

                    <div className="relative w-full aspect-square max-w-[280px] mx-auto bg-[#1a1a1a] rounded-full shadow-[inset_0_5px_15px_black] opacity-90 grid place-items-center border-4 border-[#2d1c19]">
                        <div className="w-full h-full opacity-50 bg-[radial-gradient(circle,#333_1.5px,transparent_1.5px)] bg-[length:4px_4px] rounded-full" />
                        <motion.div
                            className="absolute w-2/3 h-2/3 rounded-full bg-black shadow-[inset_0_0_30px_rgba(0,0,0,1)] border border-[#333]"
                            animate={{ scale: isPlaying && power ? [1, 1.02, 1] : 1 }}
                            transition={{ repeat: Infinity, duration: 0.1 }}
                        />
                    </div>

                    <div className="relative z-10 mt-8 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${power ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-red-900'}`} />
                            <span className="text-[10px] text-[#ccb] font-bold tracking-widest uppercase">Power</span>
                        </div>
                        <div className="text-orange-500 font-black tracking-tighter text-2xl drop-shadow-md">
                            TIME<span className="text-[#ccb]">TUNER</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT: CONTROLS */}
                <div className="flex-1 bg-[#222] rounded-b-[2.5rem] md:rounded-r-[2.5rem] md:rounded-bl-none p-6 md:p-10 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,#222_0%,#2c2c2c_20%,#222_40%,#222_100%)] opacity-100 pointer-events-none" />

                    {/* TUNER */}
                    <div className="relative z-10 w-[85%] mx-auto h-24 bg-[#0a0a0a] rounded-t-xl border-4 border-[#444] border-b-0 shadow-[inset_0_10px_30px_black] overflow-hidden">
                        <div className="absolute inset-0 z-30 bg-gradient-to-tr from-white/5 via-white/10 to-transparent pointer-events-none" />
                        <div className="absolute inset-0 flex items-end justify-between px-6 pb-2 z-10">
                            {[2000, 2005, 2010, 2015, 2020, 2026].map(y => (
                                <div key={y} className="flex flex-col items-center gap-1 opacity-60">
                                    <div className="w-[1px] h-3 bg-[#ccc]" />
                                    <span className="text-[9px] text-[#ccc] font-mono">{y}</span>
                                </div>
                            ))}
                        </div>
                        <motion.div className="absolute top-0 bottom-0 w-[2px] bg-orange-500 z-20 shadow-[0_0_15px_orange]" style={{ left: needlePercent }} />
                        <div className="absolute top-3 right-4 text-3xl font-mono font-bold text-[#151515] drop-shadow-[0_1px_0_rgba(255,255,255,0.1)] select-none">
                            {year}
                        </div>
                    </div>

                    {/* INTERFACE */}
                    <div className="relative z-10 w-full flex-1 bg-[#333] rounded-b-xl border-4 border-[#444] border-t-0 shadow-[inset_0_-10px_20px_black] p-6 flex flex-col items-center gap-6">
                        <div className="w-full bg-[#1a1a1a] rounded-lg p-2 border border-[#444] flex justify-between gap-2 shadow-inner">
                            <button onClick={handlePrev} className="flex-1 h-12 bg-[#e0e0e0] rounded hover:bg-white active:scale-95 transition-all flex items-center justify-center shadow-[0_2px_0_#999] active:shadow-none active:translate-y-[2px]"><Rewind size={20} className="fill-black" /></button>
                            <button onClick={handlePlayPause} className="flex-1 h-12 bg-[#e0e0e0] rounded hover:bg-white active:scale-95 transition-all flex items-center justify-center shadow-[0_2px_0_#999] active:shadow-none active:translate-y-[2px]">{isPlaying ? <Pause size={20} className="fill-black" /> : <Play size={20} className="fill-black" />}</button>
                            <button onClick={handleStop} className="flex-1 h-12 bg-[#e0e0e0] rounded hover:bg-white active:scale-95 transition-all flex items-center justify-center shadow-[0_2px_0_#999] active:shadow-none active:translate-y-[2px]"><Square size={18} className="fill-black" /></button>
                            <button onClick={handleNext} className="flex-1 h-12 bg-[#e0e0e0] rounded hover:bg-white active:scale-95 transition-all flex items-center justify-center shadow-[0_2px_0_#999] active:shadow-none active:translate-y-[2px]"><FastForward size={20} className="fill-black" /></button>
                        </div>

                        <div className="w-full flex justify-between items-end">
                            <div className="flex flex-col gap-4 items-center">
                                <div className="flex gap-3 mb-2">
                                    <button onClick={() => setPower(!power)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${power ? 'border-red-600 bg-red-500 text-white shadow-[0_0_15px_red]' : 'border-[#555] text-[#555] bg-[#222]'}`}><Power size={16} /></button>
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => setIsIndianMode(false)} className={`text-[8px] font-bold px-2 py-0.5 rounded ${!isIndianMode && power ? 'bg-orange-600 text-white' : 'text-[#666] bg-[#222]'}`}>INTL</button>
                                        <button onClick={() => setIsIndianMode(true)} className={`text-[8px] font-bold px-2 py-0.5 rounded ${isIndianMode && power ? 'bg-orange-600 text-white' : 'text-[#666] bg-[#222]'}`}>IND</button>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <MiniKnob label="VOL" value={volume} onChange={setVolume} disabled={!power} />
                                    <MiniKnob label="TONE" value={tone} onChange={setTone} disabled={!power} />
                                </div>
                            </div>

                            <div className="flex flex-col items-center">
                                <Knob
                                    rotation={rotation}
                                    setRotation={(val: number) => {
                                        rotation.set(val);
                                        updateYearFromRotation(val);
                                    }}
                                    setIsDragging={setIsDragging}
                                    disabled={!power}
                                />
                                <div className="mt-2 text-[10px] text-orange-500 font-mono tracking-widest">{isTuning && power ? "TUNING..." : `${year} MHZ`}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed opacity-0 pointer-events-none">
                {currentVideoId && (
                    <YouTube
                        videoId={currentVideoId}
                        opts={{ playerVars: { autoplay: 1, controls: 0 } }}
                        onReady={onPlayerReady}
                        onStateChange={onPlayerStateChange}
                        onError={onPlayerError}
                    />
                )}
            </div>
        </div>
    );
}

const Knob = ({ rotation, setRotation, setIsDragging, disabled }: any) => {
    const knobRef = useRef<HTMLDivElement>(null);
    const currentRotationRef = useRef(0);

    useEffect(() => {
        const unsubscribe = rotation.on("change", (latest: number) => { currentRotationRef.current = latest; });
        return unsubscribe;
    }, [rotation]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled || !knobRef.current) return;
        e.preventDefault();
        knobRef.current.setPointerCapture(e.pointerId);
        setIsDragging(true);

        const rect = knobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const startRotation = currentRotationRef.current;

        let lastAngle = startAngle;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            let degDelta = (currentAngle - lastAngle) * (180 / Math.PI);

            // Fix wrap-around for continuous rotation
            if (degDelta > 180) degDelta -= 360;
            if (degDelta < -180) degDelta += 360;

            const newRotation = Math.max(0, Math.min(360, currentRotationRef.current + degDelta));
            setRotation(newRotation);

            // Update refs for next frame
            lastAngle = currentAngle;
            currentRotationRef.current = newRotation;
        };

        const handlePointerUp = () => {
            setIsDragging(false);
            knobRef.current?.removeEventListener("pointermove", handlePointerMove as any);
            knobRef.current?.removeEventListener("pointerup", handlePointerUp as any);
        };

        knobRef.current.addEventListener("pointermove", handlePointerMove as any);
        knobRef.current.addEventListener("pointerup", handlePointerUp as any);
    };

    return (
        <div className="relative w-36 h-36 rounded-full bg-[#1a1a1a] shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-center justify-center">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute w-1 h-3 bg-[#444] top-2 left-1/2 -translate-x-1/2 origin-[50%_64px]" style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }} />
            ))}
            <motion.div
                ref={knobRef}
                onPointerDown={handlePointerDown}
                style={{ rotate: rotation }}
                className={`w-28 h-28 rounded-full bg-[conic-gradient(from_0deg,#e0e0e0,#999,#fff,#999,#e0e0e0)] shadow-[0_5px_15px_rgba(0,0,0,0.4)] relative z-20 touch-none ${disabled ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing'}`}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-[#ccc] to-[#999] shadow-inner border border-[#888]" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-5 bg-orange-500 rounded-full shadow-sm" />
            </motion.div>
        </div>
    );
};

const MiniKnob = ({ label, value, onChange, disabled }: { label: string, value: number, onChange: (v: number) => void, disabled: boolean }) => {
    const knobRef = useRef<HTMLDivElement>(null);
    const rotation = (value / 100) * 270 - 135;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled || !knobRef.current) return;
        e.preventDefault();
        knobRef.current.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startValue = value;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaY = startY - moveEvent.clientY;
            const newValue = Math.min(100, Math.max(0, startValue + deltaY));
            onChange(newValue);
        };

        const handlePointerUp = () => {
            knobRef.current?.removeEventListener("pointermove", handlePointerMove as any);
            knobRef.current?.removeEventListener("pointerup", handlePointerUp as any);
        };

        knobRef.current.addEventListener("pointermove", handlePointerMove as any);
        knobRef.current.addEventListener("pointerup", handlePointerUp as any);
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                ref={knobRef}
                onPointerDown={handlePointerDown}
                className={`relative w-12 h-12 rounded-full bg-[#1a1a1a] shadow-lg border border-[#444] flex items-center justify-center touch-none ${disabled ? 'opacity-50' : 'cursor-ns-resize'}`}
            >
                <div className="w-full h-full rounded-full absolute top-0 left-0" style={{ transform: `rotate(${rotation}deg)` }}>
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-white rounded-full shadow-[0_0_5px_white]" />
                </div>
            </div>
            <span className="text-[9px] font-bold text-[#666]">{label}</span>
        </div>
    );
};
