const fetch = require('node-fetch');

/**
 * API route to determine whether a given TikTok user is currently live.
 *
 * The route accepts a `username` query parameter. It fetches the user's
 * live page and parses the `SIGI_STATE` script embedded in the HTML to
 * determine the live room status. A status of 2 indicates the user is live
 * according to TikTok's internal data structure. If no `SIGI_STATE` can be
 * parsed, the endpoint returns `live: false`.
 */
export default async function handler(req, res) {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ error: 'Missing or invalid username' });
    return;
  }
  const user = username.replace(/^@/, '').trim();
  try {
    const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(user)}/live`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/1.0;)',
        'Accept-Language': 'en-US,en;q=0.8'
      }
    });
    const html = await response.text();
    let live = false;
    let status = null;
    let roomId = null;
    const match = html.match(/<script id="SIGI_STATE"[^>]*>(.*?)<\/script>/);
    if (match && match[1]) {
      try {
        const data = JSON.parse(match[1]);
        status = data?.LiveRoom?.liveRoomUserInfo?.liveRoom?.status;
        live = status === 2;
        roomId = data?.LiveRoom?.liveRoomUserInfo?.liveRoom?.roomId;
      } catch (err) {
        // fall through: if JSON.parse fails, we simply return live: false
      }
    }
    res.status(200).json({ username: user, live, status, roomId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}