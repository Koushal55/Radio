import React from 'react';

interface RadioChassisProps {
    children: React.ReactNode;
}

export const RadioChassis: React.FC<RadioChassisProps> = ({ children }) => {
    return (
        <div className="relative bg-[#1a1a1a] rounded-xl shadow-2xl border-4 border-[#3e2723] w-full max-w-5xl mx-auto md:aspect-[2.5/1] flex flex-col md:flex-row overflow-hidden">

            {/* Speaker Grille (Left Side) - Walnut Wood Texture */}
            <div className="w-full md:w-1/3 h-32 md:h-full bg-[#3e2723] p-6 md:p-8 flex flex-col justify-center relative overflow-hidden border-b md:border-b-0 md:border-r-4 border-[#1a1a1a]">
                {/* Wood grain pattern simulation */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] mix-blend-overlay" />

                {/* Speaker Mesh */}
                <div className="absolute inset-6 grid grid-cols-[repeat(auto-fill,minmax(6px,1fr))] gap-1.5 opacity-60">
                    {Array.from({ length: 600 }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a] shadow-inner" />
                    ))}
                </div>

                {/* Branding embedded in speaker area */}
                <div className="relative z-10 mt-auto hidden md:block">
                    <div className="text-xs font-bold tracking-[0.3em] text-[#d4af37] mb-2 drop-shadow-md">TIME TUNER</div>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_8px_rgba(255,0,0,0.8)] border border-red-800" />
                        <div className="w-3 h-3 rounded-full bg-[#d4af37] shadow-inner border border-yellow-800" />
                    </div>
                </div>
            </div>

            {/* Main Control Area (Right Side) - Brushed Metal */}
            <div className="relative z-10 flex flex-col items-center justify-center flex-grow p-8 md:p-12 w-full md:w-2/3 bg-[#222] bg-[linear-gradient(45deg,#222_25%,#2a2a2a_25%,#2a2a2a_50%,#222_50%,#222_75%,#2a2a2a_75%,#2a2a2a_100%)] bg-[length:4px_4px]">
                {children}

                {/* Vignette */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            </div>

            {/* Mobile Branding (Bottom) */}
            <div className="md:hidden absolute bottom-4 left-8 z-20">
                <div className="text-[10px] font-bold tracking-widest text-[#d4af37]">TIME TUNER</div>
            </div>
        </div>
    );
};
