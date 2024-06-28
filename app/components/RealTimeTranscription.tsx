"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Typography,
  Container,
  Paper,
  Box,
  Grid,
  CssBaseline,
} from "@mui/material";

interface Transcript {
  type: string;
  text: string;
  message?: string;
}

const RealTimeTranscription: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket("wss://whisper.ganxing.fun");
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (data.type === "transcription") {
        setTranscript(data.text);
        setStatus("转录成功");
      } else if (data.type === "error") {
        setStatus(`错误: ${data.message}`);
      }
    };
    ws.onopen = () => setStatus("WebSocket 连接已建立");
    ws.onclose = () => setStatus("WebSocket 连接已关闭");
    socketRef.current = ws;
    return () => ws.close();
  }, []);

  const startRecording = async () => {
    setRecording(true);
    setStatus("开始录音...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setStatus("录音中");

    mediaRecorder.ondataavailable = (event) => {
      if (socketRef.current) {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (base64data) {
            socketRef.current!.send(
              JSON.stringify({ type: "audio", audio: base64data.split(",")[1] })
            );
            setStatus("音频数据已发送到服务器");
          }
        };
      }
    };

    mediaRecorder.onstop = () => {
      setRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      setStatus("录音已停止");
    };
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setStatus("停止录音...");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && socketRef.current) {
      setStatus(`上传文件: ${file.name}`);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (base64data) {
          socketRef.current!.send(
            JSON.stringify({ type: "upload", audio: base64data.split(",")[1] })
          );
          setStatus("文件数据已发送到服务器");
        }
      };
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Container maxWidth="md">
      <CssBaseline />
      <Typography
        marginTop={2}
        variant="h3"
        component="h1"
        align="center"
        gutterBottom
      >
        语音识别
      </Typography>
      <Box mt={4} mb={4}>
        <Typography variant="h5" component="h2" gutterBottom>
          识别文本:
        </Typography>
        <Paper elevation={3} sx={{ padding: 2, backgroundColor: "#f1f1f1" }}>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {transcript}
          </Typography>
        </Paper>
      </Box>
      <Grid container spacing={6} marginTop={2}>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <Typography variant="h6" gutterBottom>
              录音状态: {recording ? "是" : "否"}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={startRecording}
              disabled={recording}
              sx={{ marginRight: 2 }}
            >
              开始录音
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={stopRecording}
              disabled={!recording}
            >
              停止录音
            </Button>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <Typography variant="h5" component="h2" gutterBottom>
              上传音频文件:
            </Typography>
            <Button
              variant="contained"
              component="label"
              onClick={handleButtonClick}
            >
              上传文件
            </Button>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              ref={fileInputRef}
              style={{ display: "none" }}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box mb={4}>
            <Typography variant="h5" component="h2" gutterBottom>
              状态:
            </Typography>
            <Typography variant="body1">{status}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RealTimeTranscription;
