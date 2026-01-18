"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, Square } from "lucide-react";
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
    const [theme, setTheme] = useState<'classic' | 'midnight'>('classic'); // New Theme State

    // Logic State
    const [cache, setCache] = useState<Record<string, string[]>>({});
    const playerRef = useRef<any>(null);
    const { playStatic, stopStatic } = useStaticNoise();

    const START_YEAR = 2000;
    const END_YEAR = 2026;
    const TOTAL_YEARS = END_YEAR - START_YEAR;

    // --- HELPER FUNCTIONS ---

    // Get fallback songs from static data
    const getFallbackSongs = useCallback((selectedYear: number, mode: 'indian' | 'global'): string[] => {
        // First try songs.ts (has Indian/Global separation)
        if (songData[selectedYear]) {
            const modeKey = mode === 'indian' ? 'indian' : 'global';
            const songs = songData[selectedYear][modeKey];
            if (songs && songs.length > 0) {
                return songs;
            }
        }

        // Fallback to years.json (simple array)
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
        // Avoid repeating the exact same song immediately if possible
        let newId = list[Math.floor(Math.random() * list.length)];
        if (list.length > 1 && newId === videoId) {
            newId = list.find(id => id !== videoId) || newId;
        }
        setVideoId(newId);
        // Don't clear loading here - let onPlayerReady handle it
    }, [videoId]);

    const playMusicForYear = useCallback(async (selectedYear: number) => {
        const cacheKey = `${selectedYear}-${isIndianMode ? 'in' : 'gl'}`;

        try {
            // 1. Check Cache first
            if (cache[cacheKey]?.length > 0) {
                playRandomFromList(cache[cacheKey]);
                return;
            }

            // Reset video ID to force player refresh if we are fetching new data
            // This prevents the old song from playing while we search
            setVideoId(null);

            // 2. Try to fetch from API with strict year matching
            // Use multiple search strategies and try the best one
            const searchQueries = isIndianMode
                ? [
                    `bollywood hits ${selectedYear} original audio official`,
                    `hindi songs ${selectedYear} official video original`,
                    `superhit songs ${selectedYear} full audio original`,
                    `top bollywood ${selectedYear} official music video`,
                    `bollywood music ${selectedYear} original song`
                ]
                : [
                    `billboard hot 100 ${selectedYear} full song`,
                    `top hits ${selectedYear} official audio`,
                    `best songs ${selectedYear} official music video`,
                    `popular songs ${selectedYear} original`,
                    `chart toppers ${selectedYear} official video`
                ];

            // Try the first query (most relevant)
            const bestQuery = searchQueries[0];

            // Very strict filters to exclude remixes, mashups, covers, etc.
            const strictFilters = `-remix -mashup -cover -lofi -live -instrumental -acoustic -rework -bootleg -edit -extended -dub -karaoke -reimagined -reprise -remaster -medley -parody -meme -nightcore -slowed -reverb`;

            const fullQuery = `${bestQuery} ${strictFilters}`;

            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(fullQuery)}&year=${selectedYear}`);

                if (!res.ok) {
                    throw new Error(`API returned status ${res.status}`);
                }

                const data = await res.json();

                // Check for API errors
                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.items?.length > 0) {
                    // Additional client-side filtering for extra strictness
                    const yearStr = selectedYear.toString();
                    const prevYear = (selectedYear - 1).toString();
                    const nextYear = (selectedYear + 1).toString();

                    const filteredItems = data.items.filter((item: any) => {
                        if (!item.id?.videoId || !item.snippet) return false;

                        const title = (item.snippet.title || '').toLowerCase();
                        const description = (item.snippet.description || '').toLowerCase();
                        const channelTitle = (item.snippet.channelTitle || '').toLowerCase();

                        // Precise year matching - must have exact year in title for better accuracy
                        const titleHasYear = title.includes(yearStr);
                        const descHasYear = description.includes(yearStr);
                        const hasYear = titleHasYear || descHasYear;

                        // Check for year ranges (e.g., "1990-1995" or "1990s")
                        const hasYearRange = /\d{4}[\s-]\d{4}/.test(title) || title.includes(yearStr.slice(0, 3) + 's');
                        const hasYearRangeMatch = hasYearRange && (title.includes(yearStr) || description.includes(yearStr));

                        // Avoid adjacent years (e.g., don't match 1991 when searching for 1990)
                        const hasPrevYear = title.includes(prevYear) || description.includes(prevYear);
                        const hasNextYear = title.includes(nextYear) || description.includes(nextYear);
                        const isCompilation = title.includes('compilation') ||
                            title.includes('playlist') ||
                            title.includes('best of') ||
                            title.includes('hits of');

                        // Exclude if has adjacent years and not a compilation/range
                        if ((hasPrevYear || hasNextYear) && !isCompilation && !hasYearRangeMatch) {
                            return false;
                        }

                        // Check for official channels (will be used later for validation)
                        const isOfficialChannel = channelTitle.includes('official') ||
                            channelTitle.includes('vevo') ||
                            channelTitle.includes('saregama') ||
                            channelTitle.includes('tseries') ||
                            channelTitle.includes('sony music') ||
                            channelTitle.includes('universal music') ||
                            channelTitle.includes('warner music') ||
                            channelTitle.includes('emi') ||
                            channelTitle.includes('yash raj films') ||
                            channelTitle.includes('eros music') ||
                            channelTitle.includes('zee music');

                        // Strict requirement: year must be in title (unless official channel)
                        if (!titleHasYear && (!descHasYear || !isOfficialChannel)) {
                            return false;
                        }

                        // Comprehensive exclusion list
                        const excludeTerms = [
                            'remix', 'remixed', 'remixes', 'remix version',
                            'mashup', 'mash-up', 'mash up', 'mash',
                            'cover', 'covers', 'covered', 'cover version',
                            'lofi', 'lo-fi', 'low fi',
                            'live', 'live version', 'live at', 'live from', 'live performance',
                            'instrumental', 'instrumental version', 'karaoke', 'no vocals',
                            'acoustic', 'acoustic version', 'unplugged',
                            'rework', 'reworked', 'reworking',
                            'bootleg', 'bootlegged',
                            'edit', 'edited', 'radio edit',
                            'extended', 'extended mix', 'extended version',
                            'dub', 'dubstep', 'dub mix',
                            'reimagined', 'reimagining', 'reimagine',
                            'reprise', 'reprised',
                            'remaster', 'remastered', 'remastering',
                            'medley', 'medleys',
                            'remake', 'remade', 'remaking',
                            'tribute', 'tribute song',
                            'parody', 'parodies',
                            'meme', 'memes',
                            'nightcore',
                            'slowed', 'slowed down', 'slowed version',
                            'reverb', 'reverb version',
                            '8d audio', '8d', 'spatial audio',
                            'chopped', 'screwed',
                            'reversed'
                        ];

                        // Use word boundaries for better matching
                        const hasExcludeTerm = excludeTerms.some(term => {
                            const regex = new RegExp(`\\b${term}\\b`, 'i');
                            return regex.test(title) || regex.test(description);
                        });

                        if (hasExcludeTerm) return false;

                        // Prefer official/original videos (isOfficialChannel already defined above)
                        const isOfficialVideo = title.includes('official') ||
                            title.includes('original') ||
                            title.includes('official video') ||
                            title.includes('official audio') ||
                            title.includes('official music video') ||
                            (title.includes('audio') && !title.includes('remix'));

                        const isOfficial = isOfficialChannel || isOfficialVideo;

                        // Must have year AND be official/original, or have very clear year match
                        if (!hasYear || (!isOfficial && !titleHasYear)) {
                            return false;
                        }

                        return true;
                    });

                    const ids = filteredItems.map((i: any) => i.id?.videoId).filter((id: string) => id);

                    if (ids.length > 0) {
                        setCache(prev => ({ ...prev, [cacheKey]: ids }));
                        playRandomFromList(ids);
                        return;
                    }
                }
            } catch (apiError) {
                console.warn("API fetch failed, trying fallback:", apiError);
            }

            // 3. Fallback to static data
            const fallbackSongs = getFallbackSongs(selectedYear, isIndianMode ? 'indian' : 'global');
            if (fallbackSongs.length > 0) {
                console.log(`Using fallback songs for year ${selectedYear} (${isIndianMode ? 'Indian' : 'Global'} mode)`);
                setCache(prev => ({ ...prev, [cacheKey]: fallbackSongs }));
                playRandomFromList(fallbackSongs);
                return;
            }

            // 4. No songs found anywhere
            console.warn(`No songs found for year ${selectedYear} in ${isIndianMode ? 'Indian' : 'International'} mode`);
            setIsLoading(false);
        } catch (e) {
            console.error("Error in playMusicForYear:", e);
            setIsLoading(false);
            stopStatic();
        }
    }, [isIndianMode, cache, playRandomFromList, getFallbackSongs, stopStatic]);

    // --- LOGIC: TUNING & FETCHING ---

    // Debounced Tuning Effect
    useEffect(() => {
        if (!year || !isPowerOn) return;

        // Visual feedback & Sound immediately when tuning
        setIsLoading(true);
        playStatic(0.15);

        const t = setTimeout(() => {
            playMusicForYear(year);
        }, 800);

        return () => {
            clearTimeout(t);
            // Stop static if component unmounts or year changes before timeout
            stopStatic();
        };
    }, [year, isIndianMode, isPowerOn, playMusicForYear, playStatic, stopStatic]);

    // Stop static when loading finishes or when song starts playing
    useEffect(() => {
        if (!isLoading && isPlaying) {
            stopStatic();
        } else if (isLoading) {
            // Ensure static is playing during loading
            playStatic(0.15);
        }
    }, [isLoading, isPlaying, stopStatic, playStatic]);

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

    // --- PLAYER EVENT HANDLERS ---

    // Define handleNext first before other handlers that use it
    const handleNext = useCallback(() => {
        if (!isPowerOn) return;

        // Force stop immediately to give instant feedback
        if (playerRef.current) {
            try {
                playerRef.current.stopVideo();
            } catch (e) {
                console.warn("Could not stop video:", e);
            }
        }

        // Start loading and static noise when switching songs
        setIsLoading(true);
        setIsPlaying(false);
        playStatic(0.15);

        // Re-roll from current cache
        const cacheKey = `${year}-${isIndianMode ? 'in' : 'gl'}`;
        if (cache[cacheKey]?.length > 0) {
            playRandomFromList(cache[cacheKey]);
        } else {
            playMusicForYear(year);
        }
    }, [isPowerOn, year, isIndianMode, cache, playRandomFromList, playMusicForYear, playStatic]);

    const handlePlayPause = () => {
        if (!isPowerOn) return;

        // If no video is loaded, try to load music
        if (!videoId) {
            setIsLoading(true);
            playStatic(0.15);
            playMusicForYear(year);
            return;
        }

        // If player isn't ready yet, just wait
        if (!playerRef.current) {
            return; // Player will be ready soon
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
            playerRef.current.pauseVideo(); // Double tap to ensure it stops
        } catch (e) {
            console.warn("Stop error:", e);
        }
        setIsPlaying(false);
        setIsLoading(false); // Ensure loading is cleared
        stopStatic();
    };

    const onPlayerReady: YouTubeProps["onReady"] = (event) => {
        playerRef.current = event.target;
        try {
            event.target.setVolume(volume);
            // Auto-play if power is on
            if (isPowerOn) {
                event.target.playVideo();
            }
        } catch (e) {
            console.warn("Player ready error:", e);
        }
    };

    const onPlayerStateChange: YouTubeProps["onStateChange"] = useCallback((event: { data: number; }) => {
        // 1 = Playing, 2 = Paused, 3 = Buffering, 0 = Ended
        if (event.data === 1) {
            // Song is playing - stop static noise
            setIsPlaying(true);
            setIsLoading(false);
            stopStatic();
        }
        else if (event.data === 3) {
            // Buffering
            // Only play static/show loading if we are NOT currently playing (i.e. initial load or seek)
            // If we were playing and hit buffer, we don't want to blast static noise
            if (!isPlaying) {
                setIsLoading(true);
                playStatic(0.1);
            }
        }
        else if (event.data === 2) {
            // Paused
            setIsPlaying(false);
            setIsLoading(false); // Clear loading if we paused (e.g. user paused while buffering)
        }
        else if (event.data === 0) {
            // Ended - auto-play next
            setIsPlaying(false);
            setIsLoading(true);
            playStatic(0.15);
            handleNext();
        }
    }, [handleNext, stopStatic, playStatic, isPlaying]);

    const onPlayerError = useCallback((event: any) => {
        console.warn("Video unavailable, skipping...", event?.data);
        // Try to play another video from cache
        const cacheKey = `${year}-${isIndianMode ? 'in' : 'gl'}`;
        if (cache[cacheKey]?.length > 1) {
            // Remove the failed video from cache for this session
            const failedVideoId = videoId;
            const filteredCache = cache[cacheKey].filter(id => id !== failedVideoId);
            if (filteredCache.length > 0) {
                setCache(prev => ({ ...prev, [cacheKey]: filteredCache }));
                playRandomFromList(filteredCache);
                return;
            }
        }
        // If no more videos in cache, try next
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

    // --- UI HELPERS ---
    // Calculate needle position percentage
    const needlePos = ((year - START_YEAR) / TOTAL_YEARS) * 100;

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 font-sans selection:bg-orange-500 selection:text-white overflow-hidden relative transition-colors duration-1000 ${theme === 'classic'
            ? 'bg-[radial-gradient(circle_at_center,#2c241b,#0f0f0f)]'
            : 'bg-[radial-gradient(circle_at_center,#1a1a2e,#000000)]'
            }`}>

            {/* Animated Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className={`absolute inset-0 ${theme === 'classic' ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(255,100,0,0.05),transparent_60%)]' : 'bg-[radial-gradient(circle_at_50%_50%,rgba(100,100,255,0.05),transparent_60%)]'}`} />
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
                className={`
                w-[90%] 
                max-w-6xl 
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
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl font-mono font-bold pointer-events-none select-none z-20"
                            animate={{
                                color: isPowerOn ? 'rgba(234,88,12,0.9)' : 'rgba(100,100,100,0.1)',
                                textShadow: isPowerOn ? '0 0 20px rgba(234,88,12,0.6)' : 'none'
                            }}
                        >
                            {year}
                        </motion.div>
                    </div>
                </div>


                {/* 2. MIDDLE SECTION: CONTROLS & TAPE DECK */}
                <div className={`flex-1 border-b-4 flex flex-col md:grid md:grid-cols-12 p-4 md:p-6 gap-4 md:gap-6 shadow-inner transition-colors duration-700 ${theme === 'classic' ? 'bg-[#4b4338] border-[#3a332a]' : 'bg-[#111] border-[#000]'
                    }`}>

                    {/* Left: Audio Controls (3 cols) */}
                    <div className="md:col-span-3 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-4">
                        {/* VU Meter - Hidden on very small screens, shown on others */}
                        <div className="hidden sm:block bg-gradient-to-b from-[#1a1a1a] to-[#222] rounded-lg border border-[#555] p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                            <div className="text-[8px] text-[#888] text-center tracking-widest mb-1.5 font-mono">VU LEVEL</div>
                            <div className="flex gap-2 h-14 justify-center items-end">
                                {/* Left Channel */}
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
                                {/* Right Channel */}
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

                        {/* Knobs Row */}
                        <div className="flex justify-around flex-1 items-center gap-4">
                            <Knob label="VOL" value={volume} onChange={setVolume} disabled={!isPowerOn} sensitivity={0.2} theme={theme} />
                            <Knob label="TONE" value={tone} onChange={setTone} disabled={!isPowerOn} sensitivity={0.2} theme={theme} />
                        </div>
                    </div>

                    {/* Center: Cassette Deck (6 cols) */}
                    <div className="md:col-span-6 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl shadow-[inset_0_3px_15px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.5)] border-2 border-[#3a3a3a] p-3 md:p-4 flex flex-col relative overflow-hidden group">

                        {/* Tape Window */}
                        <div className="flex-1 bg-gradient-to-b from-[#0a0a0a] to-[#111] rounded-lg border-2 border-[#333] relative flex items-center justify-center gap-4 md:gap-8 mb-3 overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,1)]">
                            {/* Tape Background Texture */}
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,#444_1px,transparent_1px)] bg-[length:5px_5px]" />

                            {/* Visualizer Overlay */}
                            {isPlaying && isPowerOn && <WaveformVisualizer />}

                            <TapeReel spinning={isPlaying && isPowerOn} />

                            {/* Cassette Center Label */}
                            <div className={`absolute w-[30%] h-[50%] rounded-sm z-0 flex items-center justify-center flex-col shadow-[0_2px_8px_rgba(0,0,0,0.5)] border transition-colors duration-500 ${theme === 'classic'
                                ? 'bg-gradient-to-br from-[#d4c5a9] to-[#c0b090] border-[#a89677]'
                                : 'bg-gradient-to-br from-[#333] to-[#222] border-[#444]'
                                }`}>
                                {/* Text removed */}
                            </div>

                            <TapeReel spinning={isPlaying && isPowerOn} />
                        </div>

                        {/* Tape Controls */}
                        <div className="flex justify-center gap-3 md:gap-6 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] p-2 rounded-lg border-t-2 border-[#444] shadow-[inset_0_3px_10px_rgba(0,0,0,0.9)]">
                            <TransportBtn onClick={handleNext} icon={<SkipBack size={20} fill="currentColor" />} disabled={!isPowerOn} label="PREV" />
                            <TransportBtn onClick={handlePlayPause} icon={isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />} active={isPlaying} disabled={!isPowerOn} label={isPlaying ? "PAUSE" : "PLAY"} />
                            <TransportBtn onClick={handleStop} icon={<Square size={20} fill="currentColor" />} disabled={!isPowerOn} label="STOP" />
                            <TransportBtn onClick={handleNext} icon={<SkipForward size={20} fill="currentColor" />} disabled={!isPowerOn} label="NEXT" />
                        </div>
                    </div>

                    {/* Right: Mode & Tuner (3 cols) */}
                    <div className="md:col-span-3 flex flex-row md:flex-col justify-between items-center md:items-stretch gap-4">
                        {/* Power & Theme */}
                        <div className="flex justify-between items-center w-full px-2">
                            {/* Power Button */}
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
                                    <Play size={16} className={`ml-0.5 ${isPowerOn ? 'text-white fill-white' : 'text-[#111] fill-[#111]'}`} style={{ rotate: '270deg' }} />
                                </motion.button>
                            </div>

                            {/* Theme Toggle */}
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
                                    <div className={`w-4 h-4 rounded-full ${theme === 'classic' ? 'bg-orange-500' : 'bg-blue-400'}`} />
                                </motion.button>
                            </div>
                        </div>

                        {/* Mode Switches */}
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

                        {/* Tuning Knob */}
                        <div className="flex-1 w-full flex flex-col justify-end gap-2 overflow-visible">
                            <label className="text-[10px] text-orange-400 font-bold uppercase text-center w-full tracking-wider">
                                {isPowerOn ? `TUNE TO ${year}` : 'FINE TUNING'}
                            </label>
                            <div className="relative h-12 w-full bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#222] rounded-xl shadow-[inset_0_4px_15px_rgba(0,0,0,1),0_2px_8px_rgba(0,0,0,0.5)] border-2 border-[#333] flex items-center px-2 overflow-visible">
                                {/* Background Year Markers */}
                                <div className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none">
                                    {[START_YEAR, Math.floor((START_YEAR + END_YEAR) / 2), END_YEAR].map((y) => (
                                        <div key={y} className="flex flex-col items-center gap-1">
                                            <div className={`w-1 h-1.5 ${year === y && isPowerOn ? 'bg-orange-500' : 'bg-[#444]'}`} />
                                            <span className={`text-[6px] font-mono ${year === y && isPowerOn ? 'text-orange-500' : 'text-[#666]'}`}>{y}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Track Fill Effect */}
                                <motion.div
                                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-900/30 via-orange-800/20 to-transparent pointer-events-none"
                                    style={{ width: `${needlePos}%` }}
                                    animate={{
                                        opacity: isPowerOn ? [0.3, 0.5, 0.3] : 0,
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />

                                {/* Input Slider */}
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

                                {/* Enhanced Visual Thumb */}
                                <motion.div
                                    className="absolute w-8 h-8 rounded-full z-20 pointer-events-none"
                                    style={{ left: `calc(${needlePos}% - 16px)` }}
                                    animate={{
                                        scale: isPowerOn ? 1 : 0.9,
                                    }}
                                >
                                    {/* Outer Glow Ring */}
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

                                    {/* Inner Knob */}
                                    <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[#fff] via-[#ccc] to-[#888] shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-2px_5px_rgba(0,0,0,0.5)] border border-[#aaa]" />

                                    {/* Center Dot */}
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

                    {/* Left Speaker */}
                    <div className="w-[35%] h-full flex items-center justify-center p-4">
                        <SpeakerMesh isPlaying={isPlaying && isPowerOn} />
                    </div>

                    {/* Center Branding */}
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
                            <span className={`text-3xl md:text-4xl font-black tracking-widest drop-shadow-[2px_2px_0px_rgba(0,0,0,0.2)] ${theme === 'classic' ? 'text-[#3d342b]' : 'text-[#888]'
                                }`}>
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

const Knob = ({ label, value, onChange, disabled = false, sensitivity = 0.5, theme = 'classic' }: { label: string, value: number, onChange: (v: number) => void, disabled?: boolean, sensitivity?: number, theme?: 'classic' | 'midnight' }) => {
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
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full shadow-[0_5px_10px_rgba(0,0,0,0.5),inset_0_2px_3px_rgba(255,255,255,0.1)] border-2 border-[#444] relative ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} ${theme === 'classic'
                    ? 'bg-gradient-to-br from-[#555] via-[#333] to-[#222]'
                    : 'bg-gradient-to-br from-[#333] via-[#111] to-[#000]'
                    }`}
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
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 md:h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full shadow-[0_0_5px_rgba(234,88,12,0.8)]" />
                {/* Center Dot */}
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
                w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all duration-100 border-b-4 active:border-b-0 active:translate-y-1
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
        <span className="text-[7px] font-bold text-[#666] tracking-wider">{label}</span>
    </div>
);
