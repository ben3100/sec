const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * API route to download and record a TikTok live stream.
 *
 * This endpoint expects a POST request with a `username` query parameter.
 * It fetches the user's live page, extracts the FLV stream URL from the
 * embedded `SIGI_STATE` data, and then spawns `ffmpeg` to download the
 * stream into an MP4 file. After the download completes, it extracts the
 * audio into a WAV file. Both files are saved under the project's
 * `recordings` and `audio` directories, which are created if they do not
 * exist. The endpoint returns basic information about the recording or
 * an error if something fails. Note: `ffmpeg` must be installed on the
 * host for this to succeed.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { username } = req.query;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ error: 'Missing or invalid username' });
    return;
  }
  const user = username.replace(/^@/, '').trim();

  // Base directories relative to the project root (process.cwd()).
  const recordingsDir = path.join(process.cwd(), 'recordings');
  const audioDir = path.join(process.cwd(), 'audio');
  // Create directories if they do not exist.
  [recordingsDir, audioDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  try {
    // Fetch the live page and parse the embedded SIGI_STATE.
    const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(user)}/live`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/1.0;)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await response.text();
    const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>(.*?)<\/script>/);
    if (!sigiMatch || !sigiMatch[1]) {
      res.status(500).json({ error: 'SIGI_STATE missing' });
      return;
    }
    let data;
    try {
      data = JSON.parse(sigiMatch[1]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse SIGI_STATE' });
      return;
    }
    const raw = data?.LiveRoom?.liveRoomUserInfo?.liveRoom?.streamData?.pull_data?.stream_data;
    if (!raw) {
      res.status(500).json({ error: 'No stream data found' });
      return;
    }
    let streams;
    try {
      streams = JSON.parse(raw).data;
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse stream data' });
      return;
    }
    let flvUrl = null;
    for (const quality of ['uhd', 'hd', 'sd', 'ld']) {
      if (streams[quality] && streams[quality].main && streams[quality].main.flv) {
        flvUrl = streams[quality].main.flv;
        break;
      }
    }
    if (!flvUrl) {
      res.status(500).json({ error: 'No FLV stream available' });
      return;
    }
    const timestamp = Date.now();
    const videoPath = path.join(recordingsDir, `${user}_${timestamp}.mp4`);
    const audioPath = path.join(audioDir, `${user}_${timestamp}.wav`);

    // Helper to execute an ffmpeg command and await its completion.
    const runFfmpeg = (args) => {
      return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args);
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });
    };
    // Download the live stream to disk.
    try {
      await runFfmpeg(['-y', '-i', flvUrl, '-c', 'copy', videoPath]);
    } catch (err) {
      res.status(500).json({ error: `Download failed: ${err.message}` });
      return;
    }
    // Extract the audio track to a WAV file.
    try {
      await runFfmpeg(['-y', '-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', audioPath]);
    } catch (err) {
      res.status(500).json({ error: `Audio extraction failed: ${err.message}` });
      return;
    }
    res.status(200).json({ message: 'Recording complete', flvUrl, videoPath, audioPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}