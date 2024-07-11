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
  id: string;
}

interface RealTimeTranscriptionProps {
  dictionary: any;
}

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  dictionary,
}) => {
  const translatedLanguageOptions = getTranslatedLanguageOptions(dictionary);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<Transcript[]>([]);
  const [status, setStatus] = useState(dictionary.webSocketClosed);
  const [model, setModel] = useState("Systran/faster-whisper-large-v3");
  const [inputLanguage, setInputLanguage] = useState("zh");
  const [outputLanguage, setOutputLanguage] = useState("fr");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const largeV3LanguagesKeys = Object.keys(translatedLanguageOptions);
  const [langOptions, setLangOptions] =
    useState<string[]>(largeV3LanguagesKeys);
  const [operation, setOperation] = useState("transcription");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);
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
    setLangOptions(langOptions);
    setInputLanguage(langOptions[0]);
  };

  const handleInputLanguageChange = (event: SelectChangeEvent) => {
    setInputLanguage(event.target.value);
    console.log("选中的输入语言", event.target.value);
  };

  const handleOutputLanguageChange = (event: SelectChangeEvent) => {
    setOutputLanguage(event.target.value);
    console.log("选中的输出语言", event.target.value);
  };

  const handleOperationChange = (event: SelectChangeEvent) => {
    setOperation(event.target.value);
    console.log("选中的操作", event.target.value);
  };

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  useEffect(() => {
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT;
    const ws = new WebSocket(`ws://localhost:${wsPort}`);
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (data.type === "transcription" || data.type === "translation") {
        setMessages((prevMessages) => [...prevMessages, data]);
        setStatus(data.type === "transcription" ? dictionary.transcriptionSuccess : dictionary.translationSuccess);
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
              language: inputLanguage,
              operation: operation,
              outputLanguage:
                operation === "translation" ? outputLanguage : undefined, // 新增输出语言
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
              fileType: file.type.split("/")[1],
              model: model,
              language: inputLanguage,
              operation: operation, // 新增操作
              outputLanguage:
                operation === "translation" ? outputLanguage : undefined, // 新增输出语言
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
      prevMessages.map((msg, i) => (i === index ? { ...msg, text: newText } : msg))
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
            <InputLabel id="operation-select-label">
              {dictionary.operationType}
            </InputLabel>
            <Select
              labelId="operation-select-label"
              value={operation}
              onChange={handleOperationChange}
            >
              <MenuItem value="transcription">
                {dictionary.transcription}
              </MenuItem>
              <MenuItem value="translation">{dictionary.translation}</MenuItem>
            </Select>
          </FormControl>
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
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="input-language-select-label">
              {dictionary.inputLanguage}
            </InputLabel>
            <Select
              labelId="input-language-select-label"
              value={inputLanguage}
              onChange={handleInputLanguageChange}
            >
              {langOptions &&
                langOptions.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {translatedLanguageOptions[lang]}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          {operation === "translation" && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="output-language-select-label">
                {dictionary.outputLanguage}
              </InputLabel>
              <Select
                labelId="output-language-select-label"
                value={outputLanguage}
                onChange={handleOutputLanguageChange}
              >
                {largeV3LanguagesKeys &&
                  largeV3LanguagesKeys.map((lang) => (
                    <MenuItem key={lang} value={lang}>
                      {translatedLanguageOptions[lang]}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
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
