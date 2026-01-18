import { useEffect, useRef } from 'react';

export const useStaticNoise = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => {
        // Initialize AudioContext only on client side and user interaction if needed
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            audioContextRef.current = new AudioContext();
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.connect(audioContextRef.current.destination);
            gainNodeRef.current.gain.value = 0; // Start muted
        }

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const playStatic = (volume = 0.1) => {
        if (!audioContextRef.current || !gainNodeRef.current) return;

        // Resume context if suspended (browser policy)
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        // Create buffer if needed or recreate source
        const bufferSize = audioContextRef.current.sampleRate * 2; // 2 seconds buffer
        const buffer = audioContextRef.current.createBuffer(1, bufferSize, audioContextRef.current.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }

        // Stop previous source if any
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch (e) { }
        }

        sourceNodeRef.current = audioContextRef.current.createBufferSource();
        sourceNodeRef.current.buffer = buffer;
        sourceNodeRef.current.loop = true;
        sourceNodeRef.current.connect(gainNodeRef.current);
        sourceNodeRef.current.start();

        // Fade in
        gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        gainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + 0.1);
    };

    const stopStatic = () => {
        if (!audioContextRef.current || !gainNodeRef.current) return;

        // Fade out
        gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, audioContextRef.current.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.2);

        // Stop source after fade out
        setTimeout(() => {
            if (sourceNodeRef.current) {
                try { sourceNodeRef.current.stop(); } catch (e) { }
                sourceNodeRef.current = null;
            }
        }, 200);
    };

    return { playStatic, stopStatic };
};
