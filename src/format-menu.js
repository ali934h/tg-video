const STANDARD_HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160];
const MP3_BITRATES = [128, 192, 320];

function humanSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `~${n.toFixed(n >= 10 ? 0 : 1)}${units[i]}`;
}

function estimateMp3Bytes(durationSec, bitrateKbps) {
  if (!durationSec || !bitrateKbps) return 0;
  return Math.round((bitrateKbps * 1000 * durationSec) / 8);
}

function buildMainMenu(probeInfo) {
  const rows = [];

  rows.push([{ label: "🎵 Audio (MP3)", data: "a:mp3" }]);

  if (probeInfo.hasVideo) {
    const videoHeights = Array.isArray(probeInfo.videoHeights)
      ? probeInfo.videoHeights
      : [];
    const available = videoHeights.map((v) => v.height);
    let selected;
    if (available.length > 0) {
      const standardSubset = STANDARD_HEIGHTS.filter((h) =>
        available.includes(h),
      );
      const max = available[available.length - 1];
      selected = [...standardSubset];
      if (!selected.includes(max)) selected.push(max);
      selected = [...new Set(selected)].sort((a, b) => a - b);
    } else if (probeInfo.maxHeight && probeInfo.maxHeight > 0) {
      selected = STANDARD_HEIGHTS.filter((h) => h <= probeInfo.maxHeight);
      if (!selected.includes(probeInfo.maxHeight))
        selected.push(probeInfo.maxHeight);
    } else {
      selected = [];
    }

    if (selected.length > 0) {
      const videoButtons = selected.map((h) => ({
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

  rows.push([
    { label: "📂 All Video", data: "all_v" },
    { label: "📂 All Audio", data: "all_a" },
  ]);
  rows.push([{ label: "❌ Cancel", data: "cancel" }]);
  return rows;
}

function buildAllVideoMenu(probeInfo) {
  const rows = [];
  const videoHeights = Array.isArray(probeInfo.videoHeights)
    ? probeInfo.videoHeights
    : [];

  if (videoHeights.length === 0) {
    rows.push([{ label: "🎬 Best video", data: "v:0" }]);
  } else {
    const buttons = videoHeights.map((v) => {
      const size = humanSize(v.sizeBytes);
      return {
        label: size ? `🎬 ${v.height}p  ${size}` : `🎬 ${v.height}p`,
        data: `v:${v.height}`,
      };
    });
    while (buttons.length) {
      rows.push(buttons.splice(0, 2));
    }
  }

  rows.push([
    { label: "⬅️ Back", data: "back" },
    { label: "❌ Cancel", data: "cancel" },
  ]);
  return rows;
}

function buildAllAudioMenu(probeInfo) {
  const rows = [];
  const duration = probeInfo.duration || 0;

  for (const br of MP3_BITRATES) {
    const size = humanSize(estimateMp3Bytes(duration, br));
    rows.push([
      {
        label: size ? `🎵 MP3 ${br}k  ${size}` : `🎵 MP3 ${br}k`,
        data: `a:mp3:${br}`,
      },
    ]);
  }

  // MP3 Best (~LAME V0, roughly 245 kbps avg for estimation)
  const bestMp3Size = humanSize(estimateMp3Bytes(duration, 245));
  rows.push([
    {
      label: bestMp3Size ? `🎵 MP3 Best  ${bestMp3Size}` : "🎵 MP3 Best",
      data: "a:mp3",
    },
  ]);

  const best = probeInfo.bestAudio;
  if (best) {
    const sizeStr = humanSize(best.sizeBytes);
    const label =
      `🎧 Original (${best.ext || "audio"})` +
      (sizeStr ? `  ${sizeStr}` : "");
    rows.push([{ label, data: "a:orig" }]);
  }

  rows.push([
    { label: "⬅️ Back", data: "back" },
    { label: "❌ Cancel", data: "cancel" },
  ]);
  return rows;
}

module.exports = {
  buildMenu: buildMainMenu,
  buildMainMenu,
  buildAllVideoMenu,
  buildAllAudioMenu,
};
