// src/components/utils.js
const formatDuration = (ms) => {
  if (!ms && ms !== 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const generateSongs = async (seedSong, moodSettings, apiClient) => {
  const { energy, danceability, valence } = moodSettings;

  // REAL SPOTIFY RECS
  if (apiClient) {
    const res = await apiClient.get("/v1/recommendations", {
      params: {
        seed_tracks: seedSong.id,
        target_energy: energy,
        target_danceability: danceability,
        target_valence: valence,
        limit: 10,
      },
    });

    return (res.data.tracks || []).map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artists?.map((a) => a.name).join(", ") || "",
      album: t.album?.name || "",
      duration: formatDuration(t.duration_ms),
      imageUrl: t.album?.images?.[0]?.url || "",  // 👈 cover image
      reason: `Recommended based on "${seedSong.name || seedSong.title}".`,
    }));
  }

  // MOCK DATA
  return generateMockSongs(seedSong, moodSettings);
};

const generateMockSongs = (seedSong, moodSettings) => {
  const baseEnergy = moodSettings.energy;
  const baseValence = moodSettings.valence;
  const trackName = seedSong.name || seedSong.title || "your selected track";

  return [
    {
      id: "g1",
      title: "Midnight Dreams",
      artist: "Luna Wave",
      album: "Nocturnal",
      duration: "3:42",
      imageUrl: // 👈 use imageUrl, not thumbnail
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
      reason: `Recommended because it shares ${Math.round(
        baseEnergy * 100
      )}% energy and ${Math.round(
        baseValence * 100
      )}% valence with "${trackName}".`,
    },
    {
      id: "g2",
      title: "Electric Horizon",
      artist: "Neon Coast",
      album: "Skywave",
      duration: "4:05",
      imageUrl:
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop",
      reason: `Recommended because it shares ${Math.round(
        baseEnergy * 95
      )}% energy and ${Math.round(
        baseValence * 90
      )}% valence with "${trackName}".`,
    },
    {
      id: "g3",
      title: "Violet Echoes",
      artist: "Astral Bloom",
      album: "Reflections",
      duration: "2:58",
      imageUrl:
        "https://images.unsplash.com/photo-1507875703980-84f7b92febe1?w=400&h=400&fit=crop",
      reason: `Recommended because this track aligns with ${Math.round(
        baseEnergy * 110
      )}% of the energy profile and ${Math.round(
        baseValence * 85
      )}% of the mood of "${trackName}".`,
    },
    {
      id: "g4",
      title: "Chrome Streetlights",
      artist: "Echo District",
      album: "Afterglow",
      duration: "3:21",
      imageUrl:
        "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?w=400&h=400&fit=crop",
      reason: `Recommended because it closely matches ${Math.round(
        baseEnergy * 88
      )}% energy and ${Math.round(
        baseValence * 92
      )}% valence of "${trackName}".`,
    },
    {
      id: "g5",
      title: "Crystal Pulse",
      artist: "Nova Circuit",
      album: "Lumina",
      duration: "3:55",
      imageUrl:
        "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&h=400&fit=crop",
      reason: `Recommended because it shares ${Math.round(
        baseEnergy * 102
      )}% rhythmic energy and ${Math.round(
        baseValence * 98
      )}% emotional tone with "${trackName}".`,
    },
    {
      id: "g6",
      title: "Silver Haze",
      artist: "Moon District",
      album: "Nebula Streets",
      duration: "4:11",
      imageUrl:
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop",
      reason: `Recommended for its ${Math.round(
        baseEnergy * 93
      )}% energy match and ${Math.round(
        baseValence * 87
      )}% mood similarity with "${trackName}".`,
    },
  ];
};
