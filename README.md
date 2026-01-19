
# 📻 Time Tuner (Retro Radio)

A photorealistic, physics-based retro radio interface built with **Next.js** and **Framer Motion**. It allows users to "time travel" by tuning a dial to a specific year (2000–2026), instantly playing hit songs from that era via a hidden YouTube player.

Live at [https://timetuner.vercel.app/](https://timetuner.vercel.app/)

## ✨ Features

-   **Physics-Based Controls:** Realistic rotary knobs for tuning and volume using Framer Motion (drag-to-rotate logic).
-   **Dual Modes:** Switch between **International (Billboard)** and **Indian (Bollywood/Tollywood)** hits.
-   **Smart Buffering:** Automatically pre-fetches the next song for the same year to ensure gapless playback.
-   **Retro Aesthetics:** Skeuomorphic design with wood grain, brushed metal textures, and a VFD-style year display.
-   **Fail-Safe Audio:** Includes a static noise generator that plays while "tuning" and cuts off exactly when the music starts.

## 🛠️ Tech Stack

-   **Framework:** Next.js 14 (App Router)
-   **Styling:** Tailwind CSS
-   **Animation:** Framer Motion (Complex SVG paths & physics)
-   **Icons:** Lucide React
-   **Video Backend:** YouTube Data API v3 (Wrapped in a custom proxy)

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/Koushal55/Radio.git](https://github.com/Koushal55/Radio.git)
cd Radio

```

### 2. Install dependencies

```bash
npm install
# or
yarn install

```

### 3. Setup Environment Variables

Create a `.env.local` file in the root directory:

```env
# Optional: Only needed if you switch back to live API mode
YOUTUBE_API_KEY=your_youtube_api_key_here

```

### 4. Run the development server

```bash
npm run dev

```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result.


## 🔧 How It Works

1. **The Dial:** When you drag the main knob, it calculates the rotation angle and maps it to a specific year (e.g., 90° = 2010).
2. **The Fetcher:** A debounced function calls `/api/search` with the selected year.
3. **The API Route:**
* *Dev Mode:* Checks `staticSongs.ts` for a curated list of hits to save API quota.
* *Live Mode:* Queries YouTube API with filters (e.g., `-remix`, `official video`) to ensure high-quality playback.
4. **The Player:** A hidden `react-youtube` iframe handles the audio. The UI overlays static noise during buffering states.
