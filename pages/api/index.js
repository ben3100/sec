import { useState } from 'react';

/**
 * Simple front‑end for interacting with the TikTok live analyser.
 *
 * This page provides a form to enter a TikTok username and buttons to
 * 1) check if the account is currently live,
 * 2) record the live stream (requires ffmpeg on the server),
 * 3) start listening for chat messages via WebSocket and store them in memory,
 * 4) retrieve the most recent chat messages logged so far.
 */
export default function Home() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState(null);
  const [recordResult, setRecordResult] = useState(null);
  const [logs, setLogs] = useState([]);

  /**
   * Query the /api/checkLive endpoint to determine if a user is live.
   */
  const checkLive = async () => {
    setStatus(null);
    if (!username) return;
    try {
      const res = await fetch(`/api/checkLive?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus({ error: err.message });
    }
  };

  /**
   * Call the /api/record endpoint to download a live stream and extract audio.
   */
  const recordStream = async () => {
    setRecordResult(null);
    if (!username) return;
    try {
      const res = await fetch(`/api/record?username=${encodeURIComponent(username)}`, {
        method: 'POST'
      });
      const data = await res.json();
      setRecordResult(data);
    } catch (err) {
      setRecordResult({ error: err.message });
    }
  };

  /**
   * Start a background WebSocket connection to receive chat events for the given user.
   */
  const startComments = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/startComments?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      window.alert(data.message || 'Background listener started');
    } catch (err) {
      window.alert(err.message);
    }
  };

  /**
   * Fetch any recorded chat messages for the user.
   */
  const getLogs = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/getLogs?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setLogs([]);
    }
  };

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>TikTok Live Analyser</h1>
      <p>Enter a TikTok username (without the leading <code>@</code>) to check if they are live,
        record their stream, or listen for chat messages.</p>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username"
        style={{ padding: 4, marginRight: 8 }}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={checkLive} style={{ marginRight: 10 }}>Check Live Status</button>
        <button onClick={recordStream} style={{ marginRight: 10 }}>Record Stream</button>
        <button onClick={startComments} style={{ marginRight: 10 }}>Start Comments</button>
        <button onClick={getLogs}>Get Logs</button>
      </div>
      {status && (
        <div style={{ marginTop: 20 }}>
          <h2>Live Status</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(status, null, 2)}</pre>
        </div>
      )}
      {recordResult && (
        <div style={{ marginTop: 20 }}>
          <h2>Recording Result</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(recordResult, null, 2)}</pre>
        </div>
      )}
      {logs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>Recent Chat Messages</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 4 }}>Timestamp</th>
                <th style={{ border: '1px solid #ccc', padding: 4 }}>User</th>
                <th style={{ border: '1px solid #ccc', padding: 4 }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(-50).map((log, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: 4 }}>{log.timestamp}</td>
                  <td style={{ border: '1px solid #ccc', padding: 4 }}>{log.user}</td>
                  <td style={{ border: '1px solid #ccc', padding: 4 }}>{log.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}