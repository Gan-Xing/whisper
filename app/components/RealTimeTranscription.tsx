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

interface Transcript {
  type: string;
  text: string;
  message?: string;
}

const models = [
  "Systran/faster-whisper-large-v3",
  "Systran/faster-whisper-medium",
  "Systran/faster-whisper-base",
  "Systran/faster-whisper-small",
  "Systran/faster-whisper-tiny",
  "Systran/faster-distil-whisper-large-v3",
  "Systran/faster-distil-whisper-medium.en",
  "Systran/faster-distil-whisper-small.en",
  "Systran/faster-distil-whisper-large-v2",
  "Systran/faster-whisper-large-v2",
  "Systran/faster-whisper-large-v1",
  "Systran/faster-whisper-medium.en",
  "Systran/faster-whisper-base.en",
  "Systran/faster-whisper-small.en",
  "Systran/faster-whisper-tiny.en",
];

const languageOptions: Record<string, string> = {
  "English": "en",
  "Chinese": "zh",
  "German": "de",
  "Spanish": "es",
  "Russian": "ru",
  "Korean": "ko",
  "French": "fr",
  "Japanese": "ja",
  "Portuguese": "pt",
  "Turkish": "tr",
  "Polish": "pl",
  "Catalan": "ca",
  "Dutch": "nl",
  "Arabic": "ar",
  "Swedish": "sv",
  "Italian": "it",
  "Indonesian": "id",
  "Hindi": "hi",
  "Finnish": "fi",
  "Vietnamese": "vi",
  "Hebrew": "he",
  "Ukrainian": "uk",
  "Greek": "el",
  "Malay": "ms",
  "Czech": "cs",
  "Romanian": "ro",
  "Danish": "da",
  "Hungarian": "hu",
  "Tamil": "ta",
  "Norwegian": "no",
  "Thai": "th",
  "Urdu": "ur",
  "Croatian": "hr",
  "Bulgarian": "bg",
  "Lithuanian": "lt",
  "Latin": "la",
  "Māori": "mi",
  "Malayalam": "ml",
  "Welsh": "cy",
  "Slovak": "sk",
  "Telugu": "te",
  "Persian": "fa",
  "Latvian": "lv",
  "Bengali": "bn",
  "Serbian": "sr",
  "Azerbaijani": "az",
  "Slovenian": "sl",
  "Kannada": "kn",
  "Estonian": "et",
  "Macedonian": "mk",
  "Breton": "br",
  "Basque": "eu",
  "Icelandic": "is",
  "Armenian": "hy",
  "Nepali": "ne",
  "Mongolian": "mn",
  "Bosnian": "bs",
  "Kazakh": "kk",
  "Albanian": "sq",
  "Swahili": "sw",
  "Galician": "gl",
  "Marathi": "mr",
  "Panjabi": "pa",
  "Sinhala": "si",
  "Khmer": "km",
  "Shona": "sn",
  "Yoruba": "yo",
  "Somali": "so",
  "Afrikaans": "af",
  "Occitan": "oc",
  "Georgian": "ka",
  "Belarusian": "be",
  "Tajik": "tg",
  "Sindhi": "sd",
  "Gujarati": "gu",
  "Amharic": "am",
  "Yiddish": "yi",
  "Lao": "lo",
  "Uzbek": "uz",
  "Faroese": "fo",
  "Haitian": "ht",
  "Pashto": "ps",
  "Turkmen": "tk",
  "Norwegian Nynorsk": "nn",
  "Maltese": "mt",
  "Sanskrit": "sa",
  "Luxembourgish": "lb",
  "Burmese": "my",
  "Tibetan": "bo",
  "Tagalog": "tl",
  "Malagasy": "mg",
  "Assamese": "as",
  "Tatar": "tt",
  "Hawaiian": "haw",
  "Lingala": "ln",
  "Hausa": "ha",
  "Bashkir": "ba",
  "jw": "jw",
  "Sundanese": "su",
  "Yue Chinese": "yue",
};

const defaultLanguages = Object.keys(languageOptions);
const largeV3Languages = [...defaultLanguages]; // 保持默认不变

const RealTimeTranscription: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("Systran/faster-whisper-large-v3");
  const [language, setLanguage] = useState("zh");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    const langOptions =
      selectedModel.includes("distil") || selectedModel.endsWith(".en")
        ? ["English"]
        : selectedModel === "Systran/faster-whisper-large-v3"
        ? largeV3Languages
        : defaultLanguages.filter((lang) => lang !== "Yue Chinese");
    setLanguage(languageOptions[langOptions[0]]);
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    setLanguage(languageOptions[event.target.value]);
    console.log("选中的语言", event.target.value);
  };

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (data.type === "transcription") {
        setMessages((prevMessages) => [...prevMessages, data.text]);
        setStatus("转录成功");
      } else if (data.type === "error") {
        setStatus(`错误: ${data.message}`);
      } else if (data.type === "pong") {
        setStatus("收到服务器的pong");
      }
    };
    ws.onopen = () => {
      setStatus("WebSocket 连接已建立");
      socketRef.current = ws;
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 5000); // 每5秒发送一次ping
      return () => clearInterval(pingInterval);
    };
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
    audioBufferRef.current = [];
    mediaRecorder.start();
    setStatus("录音中");

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
          setStatus("音频数据已发送到服务器");
        }
      };
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
            JSON.stringify({
              type: "upload",
              audio: base64data.split(",")[1],
              model: model,
              language: language,
              response_format: "json",
              temperature: "0",
            })
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
            {messages.join("\n")}
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
            <FormControl fullWidth>
              <InputLabel id="model-select-label">模型</InputLabel>
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
              <InputLabel id="language-select-label">语言</InputLabel>
              <Select
                labelId="language-select-label"
                value={
                  Object.keys(languageOptions).find(
                    (key) => languageOptions[key] === language
                  ) || ""
                }
                onChange={handleLanguageChange}
              >
                {(model.includes("distil") || model.endsWith(".en")
                  ? ["English"]
                  : model === "Systran/faster-whisper-large-v3"
                  ? largeV3Languages
                  : defaultLanguages.filter((lang) => lang !== "Yue Chinese")
                ).map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
