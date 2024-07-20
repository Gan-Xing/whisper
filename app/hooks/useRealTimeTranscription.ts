// hooks/useRealTimeTranscription.ts
import { useState, useEffect, useRef } from "react";
import { Transcript } from "@/types"; // 请根据实际路径调整
import { SelectChangeEvent } from "@mui/material";
import { getTranslatedLanguageOptions } from "@/constants"; // 请根据实际路径调整

export const useRealTimeTranscription = (dictionary: any) => {
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<Transcript[]>([]);
  const [status, setStatus] = useState(dictionary.webSocketClosed);
  const [model, setModel] = useState("Systran/faster-whisper-large-v3");
  const [inputLanguage, setInputLanguage] = useState("zh");
  const [outputLanguage, setOutputLanguage] = useState("fr");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [operation, setOperation] = useState("transcription");
  const [shouldPlay, setShouldPlay] = useState<string | null>(null);
  const [myFileType, setMyFileType] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBufferRef = useRef<Blob[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const translatedLanguageOptions = getTranslatedLanguageOptions(dictionary);
  const largeV3LanguagesKeys = Object.keys(translatedLanguageOptions);
  const defaultLanguagesKeys = largeV3LanguagesKeys.slice(0, -1);
  const [langOptions, setLangOptions] =
    useState<string[]>(largeV3LanguagesKeys);

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    const newLangOptions =
      selectedModel.includes("distil") || selectedModel.endsWith(".en")
        ? ["en"]
        : selectedModel === "Systran/faster-whisper-large-v3"
        ? largeV3LanguagesKeys
        : defaultLanguagesKeys;
    setLangOptions(newLangOptions);
    setInputLanguage(newLangOptions[0]);
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
    text: string,
    onEnded: () => void,
    onPlayPause: (isPlaying: boolean) => void
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
      utterance.onend = function (event) {
        onEnded(); // 在TTS结束时调用回调
        onPlayPause(false);
      };

      utterance.onerror = function (event) {
        console.error("SpeechSynthesisUtterance.onerror:", event.error);
        onEnded(); // 在错误时也调用回调
        onPlayPause(false);
      };

      // 调用 speak 方法
      speechSynthesis.speak(utterance);
      onPlayPause(true);
    } else {
      // 播放音频
      try {
        if (audioRef.current) {
          if (isPlaying) {
            audioRef.current.pause();
            onPlayPause(false);
          } else {
            audioRef.current.play();
            onPlayPause(true);
          }
        } else {
          const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
          audioRef.current = audio;
          audio.play();
          onPlayPause(true);

          audio.onended = () => {
            console.log("Audio playback finished.");
            onEnded(); // 在音频播放结束时调用回调
            onPlayPause(false);
            audioRef.current = null;
          };

          audio.onerror = (error) => {
            console.error("Error playing audio:", error);
            onEnded(); // 在错误时也调用回调
            onPlayPause(false);
            audioRef.current = null;
          };
        }
      } catch (error) {
        console.error("Error initializing audio:", error);
        onEnded(); // 在初始化错误时也调用回调
        onPlayPause(false);
        audioRef.current = null;
      }
    }
  };

  useEffect(() => {
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || 3001;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:${wsPort}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const data: Transcript = JSON.parse(event.data);
      if (
        data.type === "transcription" ||
        data.type === "translation" ||
        data.type === "conversation"
      ) {
        setMessages((prevMessages) => [...prevMessages, data]);
        setStatus(
          data.type === "transcription"
            ? dictionary.transcriptionSuccess
            : data.type === "translation"
            ? dictionary.translationSuccess
            : dictionary.replySuccess
        );
        // 如果是翻译类型，自动播放音频
        if (data.type === "translation" || data.type === "conversation") {
          setShouldPlay(data.text);
          setIsPlaying(true); // 自动播放时设置播放状态
        }
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
      handlePlayMessage("", "translation", shouldPlay, () => setShouldPlay(null), setIsPlaying);
      setShouldPlay(null);
    }
  }, [shouldPlay]);

  const handleEditMessage = (index: number, newText: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, i) =>
        i === index ? { ...msg, text: newText } : msg
      )
    );
  };

  return {
    recording,
    setRecording,
    messages,
    status,
    setStatus,
    model,
    handleModelChange,
    inputLanguage,
    handleInputLanguageChange,
    outputLanguage,
    handleOutputLanguageChange,
    operation,
    handleOperationChange,
    voices,
    selectedVoice,
    setSelectedVoice,
    socketRef,
    mediaRecorderRef,
    fileInputRef,
    audioBufferRef,
    shouldPlay,
    handlePlayMessage,
    myFileType,
    setMyFileType,
    handleEditMessage,
    containerRef,
    langOptions,
    largeV3LanguagesKeys,
    isPlaying, // 将isPlaying状态返回
    setIsPlaying, // 将setIsPlaying函数返回
  };
};
