const { WebcastPushConnection } = require('tiktok-live-connector');

/**
 * API route to start listening for chat messages on a TikTok live stream.
 *
 * When invoked with a `username` query parameter, this route will create a
 * WebcastPushConnection for the specified user (if one does not already
 * exist) and register a listener for `chat` events. Each incoming chat
 * event is pushed into a per‑user log in memory. Because this runs inside
 * a Next.js serverless function, persistent state is maintained in the
 * `global` object across invocations as long as the serverless instance
 * remains warm. If the process restarts, logs will be reset. This endpoint
 * returns immediately once the listener has been started. You can call
 * `/api/getLogs?username=<user>` to retrieve recent chat messages.
 */
export default async function handler(req, res) {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ error: 'Missing or invalid username' });
    return;
  }
  const user = username.replace(/^@/, '').trim();
  // Initialise global containers if not present.
  if (!global.commentWatchers) {
    global.commentWatchers = {};
  }
  if (!global.commentLogs) {
    global.commentLogs = {};
  }
  // If a watcher already exists for this user, do nothing.
  if (global.commentWatchers[user]) {
    res.status(200).json({ message: 'Listener already running' });
    return;
  }
  // Create an array to store logs for this user.
  global.commentLogs[user] = [];
  // Create a Webcast connection. This uses the tiktok‑live‑connector
  // library, which must be installed via npm.
  const connection = new WebcastPushConnection(user);
  try {
    await connection.connect();
  } catch (err) {
    res.status(500).json({ error: `Failed to connect: ${err.message}` });
    return;
  }
  // Listen for chat messages and push them into the log.
  connection.on('chat', (data) => {
    if (!global.commentLogs[user]) {
      global.commentLogs[user] = [];
    }
    global.commentLogs[user].push({
      timestamp: new Date().toISOString(),
      user: data.uniqueId || data.nickname,
      comment: data.comment
    });
    // Keep the log size reasonable by discarding old messages.
    if (global.commentLogs[user].length > 10000) {
      global.commentLogs[user].shift();
    }
  });
  // Store the connection so we don't create duplicates.
  global.commentWatchers[user] = connection;
  res.status(200).json({ message: 'Comment listener started' });
}