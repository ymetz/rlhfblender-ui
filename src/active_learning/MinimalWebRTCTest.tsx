import React, { useEffect, useRef, useState } from 'react';
import { useWebRTC } from './useWebRTC';

export default function MinimalWebRTCTest() {
  const [started, setStarted] = useState(false);
  const videoRef = useRef(null);

  const [sessionId] = useState(`session_${Date.now()}`); 
  const environmentId = 'test-env-id';

  const { start, stop, logs, remoteStream, sendKeyDown, sendKeyUp, sendAction } = useWebRTC({
    sessionId,
    environmentId,
    serverUrl: '/data/gym_offer'
  });


  // FIX: This useEffect now correctly depends on the remoteStream state
  useEffect(() => {
    if (remoteStream && videoRef.current) {

      console.log(">>> REMOTE STREAM! Stream received MIN.");
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Keyboard controls for gym environment
  useEffect(() => {
    if (!started) return;

    const handleKeyDown = (event) => {
      event.preventDefault();
      sendKeyDown(event.key.toLowerCase());
    };

    const handleKeyUp = (event) => {
      event.preventDefault();
      sendKeyUp(event.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [started, sendKeyDown, sendKeyUp]);

  const handleStart = () => {
    start({ useDataChannel: true });
    setStarted(true);
  };

  const handleStop = () => {
    stop();
    setStarted(false);
  };

  const handleDirectAction = (action) => {
    sendAction(action);
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleStart} disabled={started} style={{ marginRight: '10px' }}>
          Start Gym Environment
        </button>
        <button onClick={handleStop} disabled={!started}>
          Stop
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>Session ID:</strong> {sessionId}</p>
        <p><strong>Environment ID:</strong> {environmentId}</p>
        {started && (
          <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '4px' }}>
            <strong>Controls:</strong> Use WASD keys, Q/E for up/down, Space for action, Enter for done
          </div>
        )}
      </div>

      <h3>Gym Environment Video Stream</h3>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          border: '2px solid #ccc',
          borderRadius: '8px',
          maxWidth: '100%',
          height: 'auto'
        }}
      />

      {started && (
        <div style={{ marginTop: '20px' }}>
          <h4>Direct Actions</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => handleDirectAction(0)}>Action 0</button>
            <button onClick={() => handleDirectAction(1)}>Action 1</button>
            <button onClick={() => handleDirectAction(2)}>Action 2</button>
            <button onClick={() => handleDirectAction(3)}>Action 3</button>
          </div>
        </div>
      )}

      <details style={{ marginTop: '20px' }}>
        <summary><strong>Debug Logs</strong></summary>
        <div style={{ background: '#f8f8f8', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
          <pre><strong>Signaling:</strong> {logs.signaling}</pre>
          <pre><strong>ICE Gathering:</strong> {logs.iceGathering}</pre>
          <pre><strong>ICE Connection:</strong> {logs.iceConnection}</pre>
          <pre><strong>Data Channel:</strong> {logs.dataChannel}</pre>
          <details>
            <summary>SDP Offer</summary>
            <pre style={{ fontSize: '10px', overflow: 'auto' }}>{logs.offerSDP}</pre>
          </details>
          <details>
            <summary>SDP Answer</summary>
            <pre style={{ fontSize: '10px', overflow: 'auto' }}>{logs.answerSDP}</pre>
          </details>
        </div>
      </details>
    </div>
  );
}
