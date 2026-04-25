const STANDARD_HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160];

function buildMenu(probeInfo) {
  const rows = [];

  if (probeInfo.hasAudio) {
    rows.push([{ label: "🎵 Audio (MP3)", data: "a:mp3" }]);
  }

  if (probeInfo.hasVideo) {
    const available = Array.isArray(probeInfo.availableHeights)
      ? probeInfo.availableHeights
      : [];
    let heights;
    if (available.length > 0) {
      const standardSubset = STANDARD_HEIGHTS.filter((h) => available.includes(h));
      const max = available[available.length - 1];
      heights = [...standardSubset];
      if (!heights.includes(max)) heights.push(max);
      heights = [...new Set(heights)].sort((a, b) => a - b);
    } else if (probeInfo.maxHeight && probeInfo.maxHeight > 0) {
      heights = STANDARD_HEIGHTS.filter((h) => h <= probeInfo.maxHeight);
      if (!heights.includes(probeInfo.maxHeight)) heights.push(probeInfo.maxHeight);
    } else {
      heights = [];
    }

    if (heights.length > 0) {
      const videoButtons = heights.map((h) => ({
        label: `🎬 ${h}p`,
        data: `v:${h}`,
      }));
      while (videoButtons.length) {
        rows.push(videoButtons.splice(0, 2));
      }
    } else {
      rows.push([{ label: "🎬 Best video", data: "v:0" }]);
    }
  }

  rows.push([{ label: "❌ Cancel", data: "cancel" }]);
  return rows;
}

module.exports = { buildMenu };
