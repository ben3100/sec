/**
 * API route to retrieve chat logs recorded by the comment listener.
 *
 * Provide a `username` query parameter to retrieve messages collected for
 * that user. Logs are stored in memory and are only available while the
 * serverless function instance remains warm. When the process restarts, the
 * logs reset. If no logs exist for the given user, an empty array is
 * returned.
 */
export default function handler(req, res) {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ error: 'Missing or invalid username' });
    return;
  }
  const user = username.replace(/^@/, '').trim();
  const logs = (global.commentLogs && global.commentLogs[user]) || [];
  res.status(200).json({ logs });
}