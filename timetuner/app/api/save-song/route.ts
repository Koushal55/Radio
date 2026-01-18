import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { year, mode, videoId } = await request.json();

        if (!year || !mode || !videoId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'data', 'songs.ts');
        let fileContent = fs.readFileSync(filePath, 'utf-8');

        // Logic to find and insert the ID
        // We look for the year key, then the mode key, then the opening bracket of the array

        // Regex explanation:
        // 1. Find the year key:  "2000":
        // 2. Find the mode key inside it:  global: [  OR  indian: [
        // We need to be careful not to match other years.

        const yearRegex = new RegExp(`"${year}"\\s*:\\s*{[^}]*${mode}\\s*:\\s*\\[`, 's');
        const match = fileContent.match(yearRegex);

        if (match) {
            // We found the start of the array.
            // Now we want to check if the ID is already there (double check)
            if (fileContent.includes(`"${videoId}"`)) {
                return NextResponse.json({ message: 'Song already exists' });
            }

            // Insert the new ID at the beginning of the array
            const insertionPoint = match.index! + match[0].length;
            const newEntry = `\n      "${videoId}", // Auto-added`;

            const newContent = fileContent.slice(0, insertionPoint) + newEntry + fileContent.slice(insertionPoint);

            fs.writeFileSync(filePath, newContent);

            return NextResponse.json({ success: true, message: `Added ${videoId} to ${year} ${mode}` });
        } else {
            return NextResponse.json({ error: 'Could not find insertion point in file' }, { status: 500 });
        }

    } catch (error) {
        console.error('Error saving song:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
