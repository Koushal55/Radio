import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = "AIzaSyAzW1J-twpr-jLE-0vzx-KhwB5iCgF5zwQ";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    try {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&videoDuration=medium&key=${YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch from YouTube' }, { status: 500 });
    }
}
