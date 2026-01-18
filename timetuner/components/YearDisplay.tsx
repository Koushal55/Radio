import React from 'react';

interface YearDisplayProps {
    year: number;
}

export const YearDisplay: React.FC<YearDisplayProps> = ({ year }) => {
    return (
        <div className="flex flex-col items-center justify-center mb-8 bg-black/80 px-8 py-4 rounded-lg border border-neutral-700 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
            <h1 className="text-7xl md:text-8xl font-mono font-bold tracking-widest text-cyan-400 select-none tabular-nums drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" style={{ fontFamily: '"Courier New", monospace' }}>
                {year}
            </h1>
            <div className="flex items-center gap-2 mt-2 opacity-60">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <p className="text-cyan-600 text-xs uppercase tracking-[0.2em]">STEREO TUNED</p>
            </div>
        </div>
    );
};
