import axios from "axios";

const formatDuration = (ms) => {
  if (!ms && ms !== 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Mood / feature helpers
// ---------------------------------------------------------------------------

// Simple presets mapping genre keywords -> typical energy/danceability/valence
const GENRE_PRESETS = [
  {
    keywords: ["edm", "electro", "house", "techno", "trance", "dubstep"],
    energy: 0.9,
    danceability: 0.8,
    valence: 0.6,
  },
  {
    keywords: ["dance pop", "pop", "k-pop", "electropop"],
    energy: 0.8,
    danceability: 0.85,
    valence: 0.8,
  },
  {
    keywords: ["hip hop", "rap", "trap"],
    energy: 0.8,
    danceability: 0.9,
    valence: 0.6,
  },
  {
    keywords: ["r&b", "soul"],
    energy: 0.6,
    danceability: 0.7,
    valence: 0.7,
  },
  {
    keywords: ["indie", "alt", "alternative"],
    energy: 0.55,
    danceability: 0.6,
    valence: 0.6,
  },
  {
    keywords: ["rock", "hard rock", "punk"],
    energy: 0.8,
    danceability: 0.55,
    valence: 0.55,
  },
  {
    keywords: ["metal"],
    energy: 0.95,
    danceability: 0.4,
    valence: 0.4,
  },
  {
    keywords: ["lo-fi", "chill", "ambient", "downtempo"],
    energy: 0.3,
    danceability: 0.4,
    valence: 0.6,
  },
  {
    keywords: ["acoustic", "folk", "singer-songwriter"],
    energy: 0.4,
    danceability: 0.45,
    valence: 0.7,
  },
  {
    keywords: ["classical", "soundtrack", "score"],
    energy: 0.35,
    danceability: 0.25,
    valence: 0.6,
  },
];

const DEFAULT_FEATURES = {
  energy: 0.6,
  danceability: 0.6,
  valence: 0.6,
};

// Estimate audio features using artist genres
const estimateFeaturesFromGenres = (genres) => {
  if (!genres || genres.length === 0) {
    return { ...DEFAULT_FEATURES };
  }

  const lowerGenres = genres.map((g) => g.toLowerCase());
  let totalEnergy = 0;
  let totalDance = 0;
  let totalValence = 0;
  let matches = 0;

  for (const g of lowerGenres) {
    for (const preset of GENRE_PRESETS) {
      const hit = preset.keywords.some((kw) => g.includes(kw));
      if (hit) {
        totalEnergy += preset.energy;
        totalDance += preset.danceability;
        totalValence += preset.valence;
        matches += 1;
        break; // only count each preset once per genre
      }
    }
  }

  if (matches === 0) {
    return { ...DEFAULT_FEATURES };
  }

  return {
    energy: totalEnergy / matches,
    danceability: totalDance / matches,
    valence: totalValence / matches,
  };
};

// Calculate how well a track matches the desired mood
const calculateMoodScore = (features, moodSettings) => {
  const energyDiff = Math.abs(features.energy - moodSettings.energy);
  const danceabilityDiff = Math.abs(
    features.danceability - moodSettings.danceability
  );
  const valenceDiff = Math.abs(features.valence - moodSettings.valence);

  // Lower score is better (less difference)
  return energyDiff + danceabilityDiff + valenceDiff;
};

// ---------------------------------------------------------------------------
// Main recommendation function (no /recommendations or /audio-features)
// ---------------------------------------------------------------------------
export const generateSongs = async (seedSong, moodSettings, token) => {
  if (!token) {
    return generateMockSongs(seedSong, moodSettings);
  }

  try {
    console.log("Generating songs for:", seedSong.name);
    console.log("Target mood:", moodSettings);

    const seedArtistId = seedSong.artists?.[0]?.id;
    if (!seedArtistId) {
      console.warn("No artist ID on seed track, using mock songs");
      return generateMockSongs(seedSong, moodSettings);
    }

    // 1) Fetch seed artist (for genres) and their top tracks
    const [artistRes, topTracksRes] = await Promise.all([
      axios.get(`https://api.spotify.com/v1/artists/${seedArtistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(
        `https://api.spotify.com/v1/artists/${seedArtistId}/top-tracks`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { market: "US" },
        }
      ),
    ]);

    const seedArtist = artistRes.data;
    const seedGenres = seedArtist.genres || [];
    const topTracks = topTracksRes.data?.tracks || [];

    const candidateTracks = [];
    const seenTrackIds = new Set([seedSong.id]);

    // Always include the seed artist's top tracks
    for (const t of topTracks) {
      if (!seenTrackIds.has(t.id)) {
        seenTrackIds.add(t.id);
        candidateTracks.push(t);
      }
    }

    // 2) Use one or two of the seed genres to search for more tracks
    const mainGenres = seedGenres.slice(0, 2);
    for (const g of mainGenres) {
      try {
        const searchRes = await axios.get("https://api.spotify.com/v1/search", {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            q: g,
            type: "track",
            limit: 20,
            market: "US",
          },
        });

        const found = searchRes.data?.tracks?.items || [];
        for (const t of found) {
          if (!seenTrackIds.has(t.id)) {
            seenTrackIds.add(t.id);
            candidateTracks.push(t);
          }
          if (candidateTracks.length >= 40) break;
        }
      } catch (err) {
        console.warn("Error searching by genre", g, err);
      }
      if (candidateTracks.length >= 40) break;
    }

    if (candidateTracks.length === 0) {
      console.warn("No candidate tracks, using mock songs");
      return generateMockSongs(seedSong, moodSettings);
    }

    // 3) Fetch artist info in bulk for all candidate tracks
    const artistIdSet = new Set();
    for (const t of candidateTracks) {
      if (t.artists && t.artists[0]?.id) {
        artistIdSet.add(t.artists[0].id);
      }
    }

    const artistIds = Array.from(artistIdSet);
    let artistMap = {};

    if (artistIds.length > 0) {
      // Spotify allows up to 50 IDs per request
      const batches = [];
      for (let i = 0; i < artistIds.length; i += 50) {
        batches.push(artistIds.slice(i, i + 50));
      }

      for (const batch of batches) {
        try {
          const res = await axios.get("https://api.spotify.com/v1/artists", {
            headers: { Authorization: `Bearer ${token}` },
            params: { ids: batch.join(",") },
          });
          const artists = res.data?.artists || [];
          for (const a of artists) {
            artistMap[a.id] = a;
          }
        } catch (err) {
          console.warn("Error fetching artist batch", err);
        }
      }
    }

    // 4) Estimate features for each track using its (primary) artist's genres
    const tracksWithScores = candidateTracks
      .map((track) => {
        const primaryArtistId = track.artists?.[0]?.id;
        const artist = primaryArtistId ? artistMap[primaryArtistId] : null;
        const genres = artist?.genres || seedGenres;

        const features = estimateFeaturesFromGenres(genres);
        const moodScore = calculateMoodScore(features, moodSettings);

        return { track, features, moodScore };
      })
      .sort((a, b) => a.moodScore - b.moodScore);

    const seedArtistName = seedSong.artists?.[0]?.name || "";

    console.log(
      "Top mood matches (estimated):",
      tracksWithScores.slice(0, 3).map((t) => ({
        title: t.track.name,
        score: t.moodScore.toFixed(3),
        features: t.features,
      }))
    );

    // 5) Map to UI shape
    const topMatches = tracksWithScores.slice(0, 10);

    return topMatches.map(({ track, features }) => {
      const energyMatch = Math.round(
        (1 - Math.abs(features.energy - moodSettings.energy)) * 100
      );
      const danceMatch = Math.round(
        (1 - Math.abs(features.danceability - moodSettings.danceability)) * 100
      );
      const valenceMatch = Math.round(
        (1 - Math.abs(features.valence - moodSettings.valence)) * 100
      );

      return {
        id: track.id,
        title: track.name,
        artist: track.artists?.map((a) => a.name).join(", ") || "",
        album: track.album?.name || "",
        duration: formatDuration(track.duration_ms),
        imageUrl: track.album?.images?.[0]?.url || "",
        reason: `${energyMatch}% energy match, ${danceMatch}% danceability match, ${valenceMatch}% mood match (estimated from genres similar to ${seedArtistName})`,
      };
    });
  } catch (error) {
    console.error("Spotify API error:", error);
    console.error("Error response data:", error.response?.data);
    console.warn("Falling back to mock data due to error");
    return generateMockSongs(seedSong, moodSettings);
  }
};

// ---------------------------------------------------------------------------
// MOCK DATA (fallback when no token or errors)
// ---------------------------------------------------------------------------
const generateMockSongs = (seedSong, moodSettings) => {
  const baseEnergy = moodSettings.energy;
  const baseValence = moodSettings.valence;
  const trackName = seedSong.name || seedSong.title || "your selected track";

  return [
    {
      id: "mock-1",
      title: "Midnight Dreams",
      artist: "Luna Wave",
      album: "Nocturnal",
      duration: "3:42",
      imageUrl:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 100)}% energy match, ${Math.round(
        moodSettings.danceability * 100
      )}% danceability match, ${Math.round(baseValence * 100)}% mood match`,
    },
    {
      id: "mock-2",
      title: "Electric Horizon",
      artist: "Neon Coast",
      album: "Skywave",
      duration: "4:05",
      imageUrl:
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 95)}% energy match, ${Math.round(
        moodSettings.danceability * 90
      )}% danceability match, ${Math.round(baseValence * 90)}% mood match`,
    },
    {
      id: "mock-3",
      title: "Violet Echoes",
      artist: "Astral Bloom",
      album: "Reflections",
      duration: "2:58",
      imageUrl:
        "https://images.unsplash.com/photo-1507875703980-84f7b92febe1?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 110)}% energy match, ${Math.round(
        moodSettings.danceability * 95
      )}% danceability match, ${Math.round(baseValence * 85)}% mood match`,
    },
    {
      id: "mock-4",
      title: "Chrome Streetlights",
      artist: "Echo District",
      album: "Afterglow",
      duration: "3:21",
      imageUrl:
        "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 88)}% energy match, ${Math.round(
        moodSettings.danceability * 92
      )}% danceability match, ${Math.round(baseValence * 92)}% mood match`,
    },
    {
      id: "mock-5",
      title: "Crystal Pulse",
      artist: "Nova Circuit",
      album: "Lumina",
      duration: "3:55",
      imageUrl:
        "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 102)}% energy match, ${Math.round(
        moodSettings.danceability * 98
      )}% danceability match, ${Math.round(baseValence * 98)}% mood match`,
    },
    {
      id: "mock-6",
      title: "Silver Haze",
      artist: "Moon District",
      album: "Nebula Streets",
      duration: "4:11",
      imageUrl:
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 93)}% energy match, ${Math.round(
        moodSettings.danceability * 87
      )}% danceability match, ${Math.round(baseValence * 87)}% mood match`,
    },
    {
      id: "mock-7",
      title: "Neon Waves",
      artist: "Digital Sunset",
      album: "Cyber Dreams",
      duration: "3:33",
      imageUrl:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 91)}% energy match, ${Math.round(
        moodSettings.danceability * 89
      )}% danceability match, ${Math.round(baseValence * 94)}% mood match`,
    },
    {
      id: "mock-8",
      title: "Starlight Echo",
      artist: "Cosmic Drift",
      album: "Interstellar",
      duration: "4:20",
      imageUrl:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 97)}% energy match, ${Math.round(
        moodSettings.danceability * 85
      )}% danceability match, ${Math.round(baseValence * 88)}% mood match`,
    },
    {
      id: "mock-9",
      title: "Urban Pulse",
      artist: "City Lights",
      album: "Metropolitan",
      duration: "3:15",
      imageUrl:
        "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 94)}% energy match, ${Math.round(
        moodSettings.danceability * 96
      )}% danceability match, ${Math.round(baseValence * 91)}% mood match`,
    },
    {
      id: "mock-10",
      title: "Velvet Night",
      artist: "Smooth Operator",
      album: "After Hours",
      duration: "3:48",
      imageUrl:
        "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=400&fit=crop",
      reason: `${Math.round(baseEnergy * 86)}% energy match, ${Math.round(
        moodSettings.danceability * 83
      )}% danceability match, ${Math.round(baseValence * 89)}% mood match`,
    },
  ];
};

export { calculateMoodScore };
