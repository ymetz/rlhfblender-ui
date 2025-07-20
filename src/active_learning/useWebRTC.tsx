import { useEffect, useRef, useState } from 'react';

export function useWebRTC({ serverUrl = '/demo_generation/gym_offer', sessionId,  environmentId, experimentId }) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const dcIntervalRef = useRef<number | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [logs, setLogs] = useState({
    dataChannel: '',
    iceConnection: '',
    iceGathering: '',
    signaling: '',
    offerSDP: '',
    answerSDP: '',
  });

  const appendLog = (type, message) => {
    setLogs((prev) => ({
      ...prev,
      [type]: (prev[type] || '') + message + '\n',
    }));
  };

  const createPeerConnection = () => {
    const iceConfig = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
      ],
    };

    pcRef.current = new RTCPeerConnection(iceConfig); 
    const pc = pcRef.current;

    pc.addEventListener('icegatheringstatechange', () => {
      appendLog('iceGathering', ` -> ${pc.iceGatheringState}`);
    });
    appendLog('iceGathering', pc.iceGatheringState);

    pc.addEventListener('iceconnectionstatechange', () => {
      // console.log('ICE connection state:', pc.iceConnectionState);
      appendLog('iceConnection', ` -> ${pc.iceConnectionState}`);
    });

    pc.addEventListener('signalingstatechange', () => {
      appendLog('signaling', ` -> ${pc.signalingState}`);
    });
    appendLog('signaling', pc.signalingState);

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        console.log(">>> Stream details:", {
          id: stream.id,
          active: stream.active,
          tracks: stream.getTracks().map(t => ({ kind: t.kind, id: t.id }))
        });
        setRemoteStream(stream);
      }
    };

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        console.log('WebRTC connected');
      }
    });

    return pc;
  };

  const start = async ({ useDataChannel }) => {
    const pc = createPeerConnection();

    pc.addTransceiver('video', { direction: 'recvonly' });

    if (useDataChannel) {
      const dc = pc.createDataChannel('chat');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel opened');
        appendLog('dataChannel', '- open');
        
        // Send a test ping to confirm channel is working
        try {
          dc.send('ping test_connection');
        } catch (error) {
          console.error('Error sending ping test:', error);
        }
      };

      dc.onclose = () => {
        console.log('>>> Data channel closed');
        appendLog('dataChannel', '- close');
        if (dcIntervalRef.current) clearInterval(dcIntervalRef.current);
      };

      dc.onmessage = (evt) => {
        let messageStr = '';
        if (typeof evt.data === 'string') {
          messageStr = evt.data;
        } else if (evt.data instanceof ArrayBuffer) {
          messageStr = new TextDecoder().decode(evt.data);
        } else {
          messageStr = String(evt.data);
        }
        
        appendLog('dataChannel', '< ' + messageStr);
      };

      dc.onerror = (error) => {
        console.error('>>> Data channel error:', error);
        appendLog('dataChannel', '! error: ' + error);
      };
    }

    await negotiate();
  };

  const negotiate = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
      }
    });

    const finalOffer = pc.localDescription;
    if (!finalOffer) return;
    setLogs((prev) => ({ ...prev, offerSDP: finalOffer.sdp }));

    const requestBody = { 
      sdp: finalOffer.sdp, 
      type: finalOffer.type, 
      session_id: sessionId,
      environment_id: environmentId,
      experiment_id: experimentId,
    };
    
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const answer = await res.json();
    setLogs((prev) => ({ ...prev, answerSDP: answer.sdp }));
    
    await pc.setRemoteDescription(answer);
  };

  const sendControlMessage = (message: any) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      try {
        const messageStr = JSON.stringify(message);
        dc.send(messageStr);
      } catch (error) {
        console.error('Error sending control message:', error);
      }
    }
  };

  const sendKeyDown = (key: string) => {
    sendControlMessage({ type: 'keydown', key });
  };

  const sendKeyUp = (key: string) => {
    sendControlMessage({ type: 'keyup', key });
  };

  const sendAction = (action: any) => {
    sendControlMessage({ type: 'action', action });
  };

  const stop = () => {
    if (dcRef.current) dcRef.current.close();
    if (dcIntervalRef.current) clearInterval(dcIntervalRef.current);

    const pc = pcRef.current;
    if (pc) {
      if (pc.getTransceivers) {
        pc.getTransceivers().forEach((t) => t.stop && t.stop());
      }

      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    }
  };

  return { start, stop, logs, remoteStream, sendKeyDown, sendKeyUp, sendAction };
}
