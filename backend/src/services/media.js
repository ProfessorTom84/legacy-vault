const path = require('path');
const { execFile } = require('child_process');
const { DIRS } = require('../db');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      resolve(stdout);
    });
  });
}

async function probeDuration(filePath) {
  const out = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const dur = parseFloat(String(out).trim());
  return Number.isFinite(dur) ? dur : null;
}

/** Poster frame taken a little way into the video. */
async function videoThumbnail(filePath, baseName, duration) {
  const at = Math.min(Math.max((duration || 10) * 0.1, 0.5), 30);
  const outName = `${baseName}-thumb.jpg`;
  await run('ffmpeg', [
    '-y', '-ss', String(at), '-i', filePath,
    '-frames:v', '1',
    '-vf', 'scale=640:-2',
    '-q:v', '4',
    path.join(DIRS.thumbs, outName),
  ]);
  return outName;
}

/** Netflix-style animated hover preview: ~3s sampled from three points. */
async function videoPreviewGif(filePath, baseName, duration) {
  const outName = `${baseName}-preview.gif`;
  const d = duration || 10;
  if (d > 12) {
    const points = [d * 0.15, d * 0.45, d * 0.75];
    const select = points
      .map((t) => `between(t,${t.toFixed(2)},${(t + 1.2).toFixed(2)})`)
      .join('+');
    await run('ffmpeg', [
      '-y', '-i', filePath,
      '-vf',
      `select='${select}',setpts=N/FRAME_RATE/TB,fps=9,scale=400:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer`,
      '-loop', '0',
      path.join(DIRS.previews, outName),
    ]);
  } else {
    await run('ffmpeg', [
      '-y', '-i', filePath,
      '-t', '3.5',
      '-vf',
      'fps=9,scale=400:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer',
      '-loop', '0',
      path.join(DIRS.previews, outName),
    ]);
  }
  return outName;
}

/** Waveform card image for audio content. */
async function audioWaveform(filePath, baseName) {
  const outName = `${baseName}-wave.png`;
  await run('ffmpeg', [
    '-y', '-i', filePath,
    '-filter_complex',
    'aformat=channel_layouts=mono,showwavespic=s=640x220:colors=#d99a4e',
    '-frames:v', '1',
    path.join(DIRS.thumbs, outName),
  ]);
  return outName;
}

module.exports = { probeDuration, videoThumbnail, videoPreviewGif, audioWaveform };
