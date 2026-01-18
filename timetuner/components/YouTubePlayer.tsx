import React, { useEffect, useState, useRef } from 'react';
import YouTube, { YouTubeEvent } from 'react-youtube';

interface YouTubePlayerProps {
    videoId: string | null;
    isPlaying: boolean;
    volume: number; // 0-100
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, isPlaying, volume }) => {
    const playerRef = useRef<any>(null);

    const opts = {
        height: '0',
        width: '0',
        playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
        },
    };

    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function' && typeof playerRef.current.pauseVideo === 'function') {
            if (isPlaying) {
                playerRef.current.playVideo();
            } else {
                playerRef.current.pauseVideo();
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
            try {
                playerRef.current.setVolume(volume);
            } catch (e) {
                // Ignore errors if player is in invalid state
            }
        }
    }, [volume]);

    const onReady = (event: YouTubeEvent) => {
        playerRef.current = event.target;
        event.target.setVolume(volume);
        if (isPlaying) {
            event.target.playVideo();
        }
    };

    const onStateChange = (event: YouTubeEvent) => {
        // Handle state changes (e.g. loop if ended)
        if (event.data === YouTube.PlayerState.ENDED) {
            event.target.playVideo(); // Loop
        }
    };

    if (!videoId) return null;

    return (
        <div className="hidden">
            <YouTube videoId={videoId} opts={opts} onReady={onReady} onStateChange={onStateChange} />
        </div>
    );
};
