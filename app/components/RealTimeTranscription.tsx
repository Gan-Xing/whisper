// app/components/RealTimeTranscription.tsx
"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Typography,
  Container,
  Box,
  Grid,
  CssBaseline,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import { models, getTranslatedLanguageOptions } from "@/constants"; // 请根据实际路径调整
import DynamicHeightList from "./DynamicHeightList";

interface Transcript {
  type: string;
  text: string;
  message?: string;
}

interface RealTimeTranscriptionProps {
  dictionary: any;
}

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  dictionary,
}) => {
  const translatedLanguageOptions = getTranslatedLanguageOptions(dictionary);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState(dictionary.webSocketClosed);
  const [model, setModel] = useState("Systran/faster-whisper-large-v3");
  const [language, setLanguage] = useState("zh");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);

  const largeV3LanguagesKeys = Object.keys(translatedLanguageOptions);
  const defaultLanguagesKeys = largeV3LanguagesKeys.slice(0, -1);

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

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
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
      const audioBlob = new Blob(audioBufferRef.current, {
        type: "audio/webm",
      });
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

  const handlePlayMessage = (message: string) => {
    // 这里可以实现你的TTS播放逻辑
    console.log("播放消息:", message);
  };

  const handleEditMessage = (index: number, newText: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, i) => (i === index ? newText : msg))
    );
  };

  return (
    <Container
      maxWidth="md"
      sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {dictionary.title}
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleSettingsOpen}
            sx={{
              "&:hover": {
                backgroundColor: "#5fa4f3",
              },
              "&:focus, &:focus-visible": {
                outline: "none",
              },
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Dialog open={settingsOpen} onClose={handleSettingsClose}>
        <DialogTitle>{dictionary.settings}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="model-select-label">
              {dictionary.modelLabel}
            </InputLabel>
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
          <FormControl fullWidth>
            <InputLabel id="language-select-label">
              {dictionary.languageLabel}
            </InputLabel>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose} color="primary">
            {dictionary.close}
          </Button>
        </DialogActions>
      </Dialog>
      <Grid
        item
        xs={12}
        sx={{ display: "flex", flexDirection: "column", flex: 1, mb: 2 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">{dictionary.transcriptionText}</Typography>
          <Typography variant="body1" sx={{ p: 1 }}>
            {status}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            width: "100%",
            overflow: "auto",
          }}
        >
          <DynamicHeightList
            items={messages}
            dictionary={dictionary}
            handlePlayMessage={handlePlayMessage}
            handleEditMessage={handleEditMessage}
          />
        </Box>
      </Grid>
      <Grid container sx={{ display: "flex", pb: 1 }}>
        <Grid item sx={{ flex: 1 }}>
          <Button
            variant="contained"
            color={recording ? "secondary" : "primary"}
            onClick={recording ? stopRecording : startRecording}
            sx={{
              width: "100%",
              "&:focus": {
                outline: "none",
              },
              "&:focus-visible": {
                outline: "none",
              },
            }}
          >
            {recording ? dictionary.stopRecording : dictionary.startRecording}
          </Button>
        </Grid>
        <Grid item sx={{ textAlign: { xs: "left", md: "center" } }}>
          <IconButton
            color="primary"
            component="label"
            onClick={handleButtonClick}
            sx={{
              width: "100%",
              backgroundColor: "rgba(25, 118, 210, 0.2)",
              "&:hover": {
                backgroundColor: "rgba(25, 118, 210, 0.6)",
              },
            }}
          >
            <AddIcon />
          </IconButton>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: "none" }}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

export default RealTimeTranscription;
