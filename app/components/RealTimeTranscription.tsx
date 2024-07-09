// app/components/RealTimeTranscription.tsx
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { models, getTranslatedLanguageOptions } from "@/constants"; // 请根据实际路径调整

interface Transcript {
  type: string;
  text: string;
  message?: string;
}

interface RealTimeTranscriptionProps {
  dictionary: any;
}

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({ dictionary }) => {
  const translatedLanguageOptions = getTranslatedLanguageOptions(dictionary);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("Systran/faster-whisper-large-v3");
  const [language, setLanguage] = useState("zh");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);

  const largeV3LanguagesKeys = Object.keys(translatedLanguageOptions)
  const defaultLanguagesKeys = largeV3LanguagesKeys.slice(0, -1)

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    const langOptions =
      selectedModel.includes("distil") || selectedModel.endsWith(".en")
        ? ["en"]
        : selectedModel === "Systran/faster-whisper-large-v3"
        ? largeV3LanguagesKeys
        : defaultLanguagesKeys;
    setLanguage(langOptions[0]);
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    setLanguage(event.target.value);
    console.log("选中的语言", event.target.value);
  };

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (data.type === "transcription") {
        setMessages((prevMessages) => [...prevMessages, data.text]);
        setStatus(dictionary.transcriptionSuccess);
      } else if (data.type === "error") {
        setStatus(`${dictionary.error}: ${data.message}`);
      } else if (data.type === "pong") {
        setStatus(dictionary.pongReceived);
      }
    };
    ws.onopen = () => {
      setStatus(dictionary.webSocketConnected);
      socketRef.current = ws;
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 5000); // 每5秒发送一次ping
      return () => clearInterval(pingInterval);
    };
    ws.onclose = () => setStatus(dictionary.webSocketClosed);
    socketRef.current = ws;
    return () => ws.close();
  }, [dictionary]);

  const startRecording = async () => {
    setRecording(true);
    setStatus(dictionary.startRecording);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioBufferRef.current = [];
    mediaRecorder.start();
    setStatus(dictionary.recording);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioBufferRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      setRecording(false);
      const audioBlob = new Blob(audioBufferRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (base64data && socketRef.current) {
          socketRef.current.send(
            JSON.stringify({
              type: "audio",
              audio: base64data.split(",")[1],
              model: model,
              language: language,
              response_format: "json",
              temperature: "0",
            })
          );
          setStatus(dictionary.audioSent);
        }
      };
      stream.getTracks().forEach((track) => track.stop());
      setStatus(dictionary.recordingStopped);
    };
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setStatus(dictionary.stopRecording);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && socketRef.current) {
      setStatus(`${dictionary.uploadingFile}: ${file.name}`);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (base64data) {
          socketRef.current!.send(
            JSON.stringify({
              type: "upload",
              audio: base64data.split(",")[1],
              model: model,
              language: language,
              response_format: "json",
              temperature: "0",
            })
          );
          setStatus(dictionary.fileSent);
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
        {dictionary.title}
      </Typography>
      <Box mt={4} mb={4}>
        <Typography variant="h5" component="h2" gutterBottom>
          {dictionary.transcriptionText}
        </Typography>
        <Paper elevation={3} sx={{ padding: 2, backgroundColor: "#f1f1f1" }}>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {messages.join("\n")}
          </Typography>
        </Paper>
      </Box>
      <Grid container spacing={6} marginTop={2}>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <Typography variant="h6" gutterBottom>
              {dictionary.recordingStatus} {recording ? dictionary.isRecording : dictionary.isNotRecording}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={startRecording}
              disabled={recording}
              sx={{ marginRight: 2 }}
            >
              {dictionary.startRecording}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={stopRecording}
              disabled={!recording}
            >
              {dictionary.stopRecording}
            </Button>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <FormControl fullWidth>
              <InputLabel id="model-select-label">{dictionary.modelLabel}</InputLabel>
              <Select
                labelId="model-select-label"
                value={model}
                onChange={handleModelChange}
              >
                {models.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <FormControl fullWidth>
              <InputLabel id="language-select-label">{dictionary.languageLabel}</InputLabel>
              <Select
                labelId="language-select-label"
                value={language}
                onChange={handleLanguageChange}
              >
                {(model.includes("distil") || model.endsWith(".en")
                  ? ["en"]
                  : model === "Systran/faster-whisper-large-v3"
                  ? largeV3LanguagesKeys
                  : defaultLanguagesKeys
                ).map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {translatedLanguageOptions[lang]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {dictionary.uploadAudioFile}
            </Typography>
            <Button
              variant="contained"
              component="label"
              onClick={handleButtonClick}
            >
              {dictionary.uploadFile}
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
              {dictionary.state}
            </Typography>
            <Typography variant="body1">{status}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RealTimeTranscription;
