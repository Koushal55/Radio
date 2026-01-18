import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { DEGREES_PER_YEAR, TOTAL_YEARS } from '@/utils/yearMapper';

interface DialProps {
    rotation: number;
    onRotate: (rotation: number) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
}

export const Dial: React.FC<DialProps> = ({ rotation, onRotate, onDragStart, onDragEnd }) => {
    const dialRef = useRef<HTMLDivElement>(null);

    // Create ticks array
    const ticks = Array.from({ length: TOTAL_YEARS }, (_, i) => i);

    return (
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
            {/* Static outer ring/marker */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-6 bg-red-500 z-20 rounded-full shadow-[0_0_15px_rgba(255,0,0,0.6)]" />

            {/* Rotatable Dial */}
            <motion.div
                ref={dialRef}
                className="w-full h-full rounded-full shadow-2xl relative cursor-grab active:cursor-grabbing flex items-center justify-center"
                style={{
                    rotate: rotation,
                    background: "conic-gradient(from 0deg, #2c2c2c, #4a4a4a, #2c2c2c)" // Brushed metal look
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0}
                dragMomentum={false}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDrag={(event, info) => {
                    // High sensitivity for easy rotation
                    const sensitivity = 2.0;
                    const newRotation = rotation + info.delta.x * sensitivity;
                    onRotate(newRotation);
                }}
            >
                {/* Gold/Brass Ring */}
                <div className="absolute inset-2 rounded-full border-4 border-yellow-600/30" />

                {/* Inner texture/grooves */}
                <div className="absolute inset-8 rounded-full border border-neutral-700 opacity-40" />
                <div className="absolute inset-16 rounded-full border border-neutral-700 opacity-30" />

                {/* Tick marks on the dial itself */}
                {ticks.map((tick) => {
                    const deg = tick * DEGREES_PER_YEAR;
                    const isMajor = tick % 10 === 0;
                    return (
                        <div
                            key={tick}
                            className={`absolute top-4 left-1/2 origin-bottom ${isMajor ? 'w-1 h-4 bg-yellow-500/80' : 'w-0.5 h-2 bg-neutral-500'}`}
                            style={{
                                transform: `translateX(-50%) rotate(${deg}deg)`,
                                transformOrigin: '50% 128px' // Adjust based on radius (half of w-64 is 128)
                            }}
                        />
                    );
                })}

                {/* Center cap - Gold/Brass finish */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-700 to-yellow-900 shadow-lg flex items-center justify-center border-4 border-yellow-800">
                    <div className="w-2 h-2 rounded-full bg-yellow-200/50 shadow-[0_0_10px_rgba(255,255,0,0.5)]" />
                </div>
            </motion.div>
        </div>
    );
};
