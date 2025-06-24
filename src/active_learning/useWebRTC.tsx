import { useEffect, useRef, useState } from 'react';

export function useWebRTC({ serverUrl = '/data/gym_offer', sessionId, environmentId }) {
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
    console.log(">>> Creating peer connection...");

    const iceConfig = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        // You can add more STUN or TURN servers here
      ],
    };

    pcRef.current = new RTCPeerConnection(iceConfig); 

    const pc = pcRef.current;
    console.log(">>> Peer connection created:", pc);

    pc.addEventListener('icegatheringstatechange', () => {
      appendLog('iceGathering', ` -> ${pc.iceGatheringState}`);
    });
    appendLog('iceGathering', pc.iceGatheringState);

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log(">>> ICE connection state changed:", pc.iceConnectionState);
      appendLog('iceConnection', ` -> ${pc.iceConnectionState}`);
    });
    appendLog('iceConnection', pc.iceConnectionState);

    pc.addEventListener('signalingstatechange', () => {
      console.log(">>> Signaling state changed:", pc.signalingState);
      appendLog('signaling', ` -> ${pc.signalingState}`);
    });
    appendLog('signaling', pc.signalingState);

    pc.ontrack = (event) => {
      console.log(">>> ONTRACK EVENT FIRED! Stream received.", event.streams, event.track);
      console.log(">>> Track details:", {
        kind: event.track.kind,
        id: event.track.id,
        label: event.track.label,
        enabled: event.track.enabled,
        readyState: event.track.readyState
      });
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

    // Add additional event listeners for debugging
    pc.addEventListener('track', (event) => {
      console.log(">>> TRACK EVENT (addEventListener):", event);
    });

    pc.addEventListener('connectionstatechange', () => {
      console.log(">>> Connection state changed:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log(">>> Connection established! Checking for remote tracks...");
        const receivers = pc.getReceivers();
        console.log(">>> Receivers:", receivers.map(r => ({ 
          track: r.track ? { kind: r.track.kind, id: r.track.id, readyState: r.track.readyState } : null 
        })));
        const transceivers = pc.getTransceivers();
        console.log(">>> Transceivers:", transceivers.map(t => ({ 
          direction: t.direction, 
          receiver: t.receiver.track ? { kind: t.receiver.track.kind, id: t.receiver.track.id } : null 
        })));
      }
    });

    return pc;
  };

  const start = async ({ useDataChannel }) => {
    const pc = createPeerConnection();

    // Add video transceiver to indicate we want to receive video
    console.log(">>> Adding video transceiver for receiving...");
    pc.addTransceiver('video', { direction: 'recvonly' });

    if (useDataChannel) {
      const dc = pc.createDataChannel('chat');
      dcRef.current = dc;

      dc.onopen = () => {
        appendLog('dataChannel', '- open');
      };

      dc.onclose = () => {
        appendLog('dataChannel', '- close');
        if (dcIntervalRef.current) clearInterval(dcIntervalRef.current);
      };

      dc.onmessage = (evt) => {
        appendLog('dataChannel', '< ' + evt.data);
      };
    }

    await negotiate();
  };

  const negotiate = async () => {
    console.log(">>> Starting negotiation...");
    const pc = pcRef.current;
    if (!pc) return;
    
    console.log(">>> Creating offer...");
    const offer = await pc.createOffer();
    console.log(">>> Offer created:", offer);
    console.log(">>> Offer SDP contains video?", offer.sdp.includes('m=video'));
    console.log(">>> Offer SDP contains audio?", offer.sdp.includes('m=audio')); 
    await pc.setLocalDescription(offer);
    console.log(">>> Local description set");
    
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
      experiment_id: 4,
    };

    console.log(">>> Sending offer to server:", serverUrl);
    console.log(">>> Request body:", requestBody);
    
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const answer = await res.json();
    console.log(">>> Received answer from server:", answer);
    console.log(">>> Answer SDP contains video?", answer.sdp.includes('m=video'));
    console.log(">>> Answer SDP contains audio?", answer.sdp.includes('m=audio'));
    console.log(">>> Full Answer SDP:", answer.sdp);
    setLogs((prev) => ({ ...prev, answerSDP: answer.sdp }));
    
    console.log(">>> Setting remote description...");
    await pc.setRemoteDescription(answer);
    console.log(">>> Remote description set successfully");
  };

  const sendControlMessage = (message) => {
    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify(message));
    }
  };

  const sendKeyDown = (key) => {
    sendControlMessage({ type: 'keydown', key });
  };

  const sendKeyUp = (key) => {
    sendControlMessage({ type: 'keyup', key });
  };

  const sendAction = (action) => {
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
