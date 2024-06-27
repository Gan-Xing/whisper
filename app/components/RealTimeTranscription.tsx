// app/components/RealTimeTranscription.tsx
"use client";
import React, { useState, useEffect, useRef } from "react";

interface Transcript {
  type: string;
  text: string;
}

const RealTimeTranscription: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (data.type === "transcription") {
        setTranscript(data.text);
      }
    };
    socketRef.current = ws;

    const startRecording = async () => {
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      mediaRecorder.ondataavailable = (event) => {
        if (socketRef.current) {
          const reader = new FileReader();
          reader.readAsDataURL(event.data);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            if (base64data) {
              socketRef.current!.send(
                JSON.stringify({
                  type: "audio",
                  audio: base64data.split(",")[1],
                })
              );
            }
          };
        }
      };

      mediaRecorder.onstop = () => {
        setRecording(false);
        if (socketRef.current) {
          socketRef.current.send(JSON.stringify({ type: "stop" }));
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      // Set timeout to stop recording after 15 seconds
      timeoutRef.current = setTimeout(() => {
        mediaRecorder.stop();
      }, 15000);
    };

    startRecording();

    return () => {
      ws.close();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Real-Time Transcription</h1>
      <div>
        <p>Recording: {recording ? "Yes" : "No"}</p>
        <button onClick={stopRecording} disabled={!recording}>
          Stop Recording
        </button>
      </div>
      <div style={{ marginTop: "20px" }}>
        <h2>Transcribed Text:</h2>
        <p
          style={{
            whiteSpace: "pre-wrap",
            backgroundColor: "#f1f1f1",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          {transcript}
        </p>
      </div>
    </div>
  );
};

export default RealTimeTranscription;
