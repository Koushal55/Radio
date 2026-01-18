import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyAzW1J-twpr-jLE-0vzx-KhwB5iCgF5zwQ";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const year = searchParams.get('year');

    if (!q) {
        return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    try {
        // Build search parameters with better filtering
        const params = new URLSearchParams({
            part: 'snippet',
            maxResults: '20', // Get more results to filter through
            q: q,
            type: 'video',
            videoCategoryId: '10', // Music category
            videoDuration: 'medium', // 4-20 minutes (full songs)
            videoDefinition: 'any',
            videoEmbeddable: 'true', // Ensure video can be embedded
            order: 'relevance',
            safeSearch: 'none',
            key: YOUTUBE_API_KEY
        });

        const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
        
        const res = await fetch(url);
        const data = await res.json();

        // Check for API errors in the response
        if (data.error) {
            console.error('YouTube API Error:', data.error);
            return NextResponse.json({ 
                error: data.error.message || 'YouTube API error',
                details: data.error 
            }, { status: res.status || 500 });
        }

        // Check if response is ok
        if (!res.ok) {
            return NextResponse.json({ 
                error: `YouTube API returned status ${res.status}`,
                data 
            }, { status: res.status });
        }

        // Additional filtering on server side if year is provided
        if (year && data.items && data.items.length > 0) {
            const yearNum = parseInt(year);
            const yearStr = yearNum.toString();
            const prevYear = (yearNum - 1).toString();
            const nextYear = (yearNum + 1).toString();
            
            data.items = data.items.filter((item: any) => {
                if (!item.snippet) return false;
                
                const title = (item.snippet.title || '').toLowerCase();
                const description = (item.snippet.description || '').toLowerCase();
                const channelTitle = (item.snippet.channelTitle || '').toLowerCase();
                
                // Check if year is mentioned - be precise to avoid adjacent years
                const titleHasYear = title.includes(yearStr);
                const descHasYear = description.includes(yearStr);
                const hasYear = titleHasYear || descHasYear;
                
                // Avoid adjacent years (e.g., don't match 1991 when searching for 1990)
                // But allow if it's clearly a compilation or playlist
                const hasPrevYear = title.includes(prevYear) || description.includes(prevYear);
                const hasNextYear = title.includes(nextYear) || description.includes(nextYear);
                const isCompilation = title.includes('compilation') || 
                                     title.includes('playlist') || 
                                     title.includes('mix') ||
                                     title.includes('best of');
                
                // Must have the exact year, unless it's an official compilation
                if (!hasYear || (hasPrevYear || hasNextYear) && !isCompilation) {
                    return false;
                }
                
                // Comprehensive exclusion list for remixes, covers, etc.
                const excludeTerms = [
                    'remix', 'remixed', 'remixes',
                    'mashup', 'mash-up', 'mash up', 'mash', 
                    'cover', 'covers', 'covered',
                    'lofi', 'lo-fi', 'low fi',
                    'live', 'live version', 'live at', 'live from',
                    'instrumental', 'instrumental version', 'karaoke',
                    'acoustic', 'acoustic version',
                    'rework', 'reworked',
                    'bootleg',
                    'edit', 'edited',
                    'extended', 'extended mix', 'extended version',
                    'dub', 'dubstep',
                    'reimagined', 'reimagining',
                    'reprise', 'reprised',
                    'remaster', 'remastered',
                    'medley',
                    'remake', 'remade',
                    'tribute',
                    'parody',
                    'meme',
                    'nightcore',
                    'slowed',
                    'reverb',
                    '8d audio'
                ];
                
                const hasExcludeTerm = excludeTerms.some(term => {
                    // Use word boundaries for better matching
                    const regex = new RegExp(`\\b${term}\\b`, 'i');
                    return regex.test(title) || regex.test(description);
                });
                
                if (hasExcludeTerm) return false;
                
                // Prefer official/original channels and videos
                const isOfficialChannel = channelTitle.includes('official') ||
                                        channelTitle.includes('vevo') ||
                                        channelTitle.includes('saregama') ||
                                        channelTitle.includes('tseries') ||
                                        channelTitle.includes('sony music') ||
                                        channelTitle.includes('universal music') ||
                                        channelTitle.includes('warner music') ||
                                        channelTitle.includes('emi') ||
                                        channelTitle.includes('yash raj films') ||
                                        channelTitle.includes('eros music');
                
                const isOfficialVideo = title.includes('official') ||
                                       title.includes('original') ||
                                       title.includes('official video') ||
                                       title.includes('official audio') ||
                                       title.includes('official music video') ||
                                       (title.includes('audio') && !title.includes('remix'));
                
                // Prioritize official content
                const isOfficial = isOfficialChannel || isOfficialVideo;
                
                // If no year match and not official, exclude
                if (!hasYear && !isOfficial) return false;
                
                return true;
            });
            
            // Sort by relevance: official videos first, then by year match in title
            data.items.sort((a: any, b: any) => {
                const aTitle = (a.snippet.title || '').toLowerCase();
                const bTitle = (b.snippet.title || '').toLowerCase();
                const aChannel = (a.snippet.channelTitle || '').toLowerCase();
                const bChannel = (b.snippet.channelTitle || '').toLowerCase();
                
                const aOfficial = (aTitle.includes('official') || aChannel.includes('official') || 
                                 aChannel.includes('vevo') || aChannel.includes('saregama') ||
                                 aChannel.includes('tseries')) ? 1 : 0;
                const bOfficial = (bTitle.includes('official') || bChannel.includes('official') || 
                                 bChannel.includes('vevo') || bChannel.includes('saregama') ||
                                 bChannel.includes('tseries')) ? 1 : 0;
                
                if (aOfficial !== bOfficial) return bOfficial - aOfficial;
                
                const aHasYearInTitle = aTitle.includes(yearStr) ? 1 : 0;
                const bHasYearInTitle = bTitle.includes(yearStr) ? 1 : 0;
                
                return bHasYearInTitle - aHasYearInTitle;
            });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('YouTube API fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch from YouTube',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
