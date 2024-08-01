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
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SettingsIcon from "@mui/icons-material/Settings";
import { models, getTranslatedLanguageOptions } from "@/constants"; // 请根据实际路径调整
import DynamicHeightList from "./DynamicHeightList";

interface Transcript {
  type: string;
  text: string;
  message?: string;
  id: string;
  audio: string;
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const largeV3LanguagesKeys = Object.keys(translatedLanguageOptions);
  const [langOptions, setLangOptions] =
    useState<string[]>(largeV3LanguagesKeys);
  const [operation, setOperation] = useState("transcription");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);
  const defaultLanguagesKeys = largeV3LanguagesKeys.slice(0, -1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldPlay, setShouldPlay] = useState<string | null>(null);
  const [myFileType, setMyFileType] = useState("");

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
  };

  const handleOutputLanguageChange = (event: SelectChangeEvent) => {
    setOutputLanguage(event.target.value);
    const selectedVoice = voices.find((voice) =>
      voice.lang.startsWith(event.target.value)
    );
    setSelectedVoice(selectedVoice || null);
  };

  const handleOperationChange = (event: SelectChangeEvent) => {
    const selectedOperation = event.target.value;
    setOperation(selectedOperation);

    if (selectedOperation === "translation") {
      setOutputLanguage("fr");

      let defaultVoice = null;
      for (let i = 0; i < voices.length; i++) {
        if (voices[i].name === "Amélie") {
          defaultVoice = voices[i];
          break;
        }
      }

      setSelectedVoice(defaultVoice || null);
    } else if (selectedOperation === "conversation") {
      setOutputLanguage("zh");

      let defaultVoice = null;
      for (let i = 0; i < voices.length; i++) {
        if (voices[i].name === "美嘉") {
          defaultVoice = voices[i];
          break;
        }
      }

      setSelectedVoice(defaultVoice || null);
    }
  };

  const handlePlayMessage = (
    audioBase64: string,
    type: string,
    text: string
  ) => {
    if (
      (type === "translation" && selectedVoice) ||
      (type === "conversation" && selectedVoice) ||
      audioBase64 === "#@$"
    ) {
      // 清空语音队列
      speechSynthesis.cancel();

      // 创建并配置 SpeechSynthesisUtterance 对象
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;

      // 添加事件监听
      utterance.onend = function (event) {};

      utterance.onerror = function (event) {
        console.error("SpeechSynthesisUtterance.onerror:", event.error);
      };

      // 调用 speak 方法
      speechSynthesis.speak(utterance);
    } else {
      // 播放音频
      try {
        // 播放音频
        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        audio.play();

        audio.onended = () => {
          console.log("Audio playback finished.");
        };

        audio.onerror = (error) => {
          console.error("Error playing audio:", error);
        };
      } catch (error) {
        console.error("Error initializing audio:", error);
      }
    }
  };

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  useEffect(() => {
    const setContainerHeight = () => {
      if (containerRef.current) {
        const viewportHeight = window.innerHeight;
        const safeAreaInsetTop =
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--safe-area-inset-top"
            )
          ) || 0;
        const safeAreaInsetBottom =
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--safe-area-inset-bottom"
            )
          ) || 0;
        containerRef.current.style.height = `calc(${viewportHeight}px - ${safeAreaInsetTop}px - ${safeAreaInsetBottom}px)`;
      }
    };

    // Initial height setting
    setContainerHeight();

    // Update height on resize
    window.addEventListener("resize", setContainerHeight);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("resize", setContainerHeight);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        clearInterval(interval); // 拿到值后清除定时器
      }
    }, 1000); // 每秒执行一次

    // 组件卸载时清除定时器
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (shouldPlay) {
      handlePlayMessage("", "translation", shouldPlay);
      setShouldPlay(null);
    }
  }, [shouldPlay]);

  const startRecording = async () => {
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
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
      const audioType = (audioBufferRef.current[0].type || "audio/webm").split(
        ";"
      )[0];
      setMyFileType(audioType);
      const audioBlob = new Blob(audioBufferRef.current, { type: audioType });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const arrayBuffer = reader.result as ArrayBuffer; // 类型断言
        const binaryData = new Uint8Array(arrayBuffer);

        // 获取路径中的语言参数
        const lang = window.location.pathname.split("/")[1];

        try {
          console.log("我现在的操作状态operation", operation);

          // 根据 operation 的值来确定请求的接口
          let endpoint;
          switch (operation) {
            case "transcription":
              endpoint = `/${lang}/transcribe`;
              break;
            case "translation":
              endpoint = `/${lang}/translate`;
              break;
            case "conversation":
              endpoint = `/${lang}/converse`;
              break;
            default:
              throw new Error("未知的 operation 值");
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "audio",
              audio: Array.from(binaryData),
              model: model,
              language: inputLanguage,
              operation: operation,
              outputLanguage:
                operation === "translation" || operation === "conversation"
                  ? outputLanguage
                  : undefined,
              responseFormat: "json",
              temperature: "0",
              fileType: audioType.split("/")[1],
            }),
          });

          if (response.ok) {
            const data = await response.json();

            if (operation === "transcription") {
              setMessages((prevMessages) => [
                ...prevMessages,
                {
                  type: data.type,
                  text: data.text,
                  id: data.id,
                  audio: data.audio,
                },
              ]);
              setStatus(dictionary.transcriptionSuccess);
            } else if (operation === "translation" || operation === "conversation") {
              setMessages((prevMessages) => [
                ...prevMessages,
                {
                  type: data[0].type,
                  text: data[0].text,
                  id: data[0].id,
                  audio: data[0].audio,
                },
                {
                  type: data[1].type,
                  text: data[1].text,
                  id: data[1].id,
                  audio: data[1].audio,
                },
              ]);
              setShouldPlay(data[1].text);
              setStatus(dictionary.translationSuccess);
            }
          } else {
            console.error(`Error: ${response.statusText}`);
          }
        } catch (error) {
          console.error("Error sending audio data:", error);
        }
      };
      reader.readAsArrayBuffer(audioBlob);
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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setStatus(`${dictionary.uploadingFile}: ${file.name}`);
      const lang = window.location.pathname.split("/")[1];
      const uploadUrl = `/${lang}/upload`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", model);
      formData.append("language", inputLanguage);
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      try {
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          console.log("File upload successful");
        } else {
          console.error(`Error: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  const connectToSSE = () => {
    const lang = window.location.pathname.split("/")[1];
    const sseUrl = `/${lang}/sse`;

    console.log("Connecting to EventSource:", sseUrl);

    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log("EventSource connection established.");
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status) {
        setStatus(data.status);
      } else {
        setMessages((prevMessages) => [...prevMessages, data]);
      }
    };

    eventSource.onerror = (error) => {
      console.error("Error with SSE:", error);
      eventSource.close();
    };
  };

  useEffect(() => {
    connectToSSE();
  }, []);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleEditMessage = (index: number, newText: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, i) =>
        i === index ? { ...msg, text: newText } : msg
      )
    );
  };

  const handleDownload = async () => {
    const texts = messages.map((message) => message.text);
    const tranPort = process.env.NEXT_PUBLIC_WS_PORT || 3001;

    try {
      const response = await fetch(
        `http://localhost:${tranPort}/optimize-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texts }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        // 创建下载内容
        let content =
          "全文内容：\n" +
          result.combinedText +
          "\n\n分段总结：\n" +
          result.combinedSummary +
          "\n\n总结：\n" +
          result.finalSummary;

        // 创建Blob对象
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });

        // 获取当前时间戳
        const timestamp = new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\..+/, "");

        // 创建下载链接
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `summary_${timestamp}.txt`;

        // 触发下载
        document.body.appendChild(link);
        link.click();

        // 移除链接
        document.body.removeChild(link);
      } else {
        console.error("Error optimizing texts:", result.error);
      }
    } catch (error) {
      console.error("Error sending request:", error);
    }
  };

  return (
    <Container
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        p: "0 !important",
        width: "100%",
        maxWidth: "none!important",
      }}
    >
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {dictionary.title}
            {myFileType}
          </Typography>
          <Box>
            <IconButton
              color="inherit"
              component="label"
              onClick={handleDownload} // 下载按钮的点击事件
              sx={{
                "&:hover": {
                  backgroundColor: "#5fa4f3",
                },
                "&:focus, &:focus-visible": {
                  outline: "none",
                },
              }}
            >
              <DownloadIcon />
            </IconButton>
            <IconButton
              color="inherit"
              component="label"
              onClick={handleButtonClick}
              sx={{
                "&:hover": {
                  backgroundColor: "#5fa4f3",
                },
                "&:focus, &:focus-visible": {
                  outline: "none",
                },
              }}
            >
              <UploadFileIcon />
            </IconButton>
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
          </Box>
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
              <MenuItem value="conversation">
                {dictionary.conversation}
              </MenuItem>
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
          {(operation === "translation" || operation === "conversation") && (
            <>
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
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="voice-select-label">
                  {dictionary.voiceSelect}
                </InputLabel>
                <Select
                  labelId="voice-select-label"
                  value={selectedVoice ? selectedVoice.voiceURI : ""}
                  onChange={(event: SelectChangeEvent) => {
                    const selectedVoiceURI = event.target.value as string;
                    const selectedVoice = voices.find(
                      (voice) => voice.voiceURI === selectedVoiceURI
                    );
                    setSelectedVoice(selectedVoice || null);
                  }}
                >
                  {voices
                    .filter((voice) => voice.lang.startsWith(outputLanguage))
                    .map((voice) => (
                      <MenuItem key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </>
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
            handlePlayMessage={(audio, type, text) =>
              handlePlayMessage(audio, type, text)
            }
            handleEditMessage={handleEditMessage}
          />
        </Box>
      </Grid>
      <Grid item sx={{ display: "flex", justifyContent: "center" }}>
        <Button
          variant="contained"
          color={recording ? "secondary" : "primary"}
          onClick={recording ? stopRecording : startRecording}
          sx={{
            width: 200, // 设置宽度
            height: 200, // 设置高度
            borderRadius: "50%", // 将按钮变成圆形
            "&:focus": {
              outline: "none",
            },
            "&:focus-visible": {
              outline: "none",
            },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {recording ? dictionary.stopRecording : dictionary.startRecording}
        </Button>
      </Grid>
      <Grid item sx={{ display: "none" }}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          ref={fileInputRef}
          style={{ display: "none" }}
        />
      </Grid>
    </Container>
  );
};

export default RealTimeTranscription;
