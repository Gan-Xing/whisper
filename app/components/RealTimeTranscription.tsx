// app/components/RealTimeTranscription.tsx
"use client";
import React, { useCallback, useState } from "react";
import {
  Typography,
  Container,
  Box,
  Grid,
  CssBaseline,
  AppBar,
  Toolbar,
  IconButton,
  SelectChangeEvent,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SettingsIcon from "@mui/icons-material/Settings";
import DownloadIcon from "@mui/icons-material/Download";
import { models, getTranslatedLanguageOptions } from "@/constants";
import DynamicHeightList from "./DynamicHeightList";
import SettingsDialog from "./SettingsDialog";
import AudioRecorder from "./AudioRecorder";
import { RealTimeTranscriptionProps } from "@/types";
import { useRealTimeTranscription } from "@/hooks/useRealTimeTranscription";

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  dictionary,
}) => {
  const {
    recording,
    setRecording,
    messages,
    status,
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
    setStatus,
    isPlaying,
    setIsPlaying,
  } = useRealTimeTranscription(dictionary);

  const translatedLanguageOptions = getTranslatedLanguageOptions(dictionary);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
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

  const handlePlayMessageWithCallback = useCallback(
    (
      audio: string,
      type: string,
      text: string,
      onEnded: () => void,
      onPlayPause: (isPlaying: boolean) => void
    ) => {
      handlePlayMessage(audio, type, text, onEnded, onPlayPause);
    },
    [handlePlayMessage]
  );

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
              onClick={() => fileInputRef.current?.click()}
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
      <SettingsDialog
        dictionary={dictionary}
        settingsOpen={settingsOpen}
        handleSettingsClose={handleSettingsClose}
        model={model}
        handleModelChange={handleModelChange}
        operation={operation}
        handleOperationChange={handleOperationChange}
        inputLanguage={inputLanguage}
        handleInputLanguageChange={handleInputLanguageChange}
        outputLanguage={outputLanguage}
        handleOutputLanguageChange={handleOutputLanguageChange}
        selectedVoice={selectedVoice}
        voices={voices}
        handleVoiceChange={(event: SelectChangeEvent) => {
          const selectedVoiceURI = event.target.value as string;
          const selectedVoice = voices.find(
            (voice) => voice.voiceURI === selectedVoiceURI
          );
          setSelectedVoice(selectedVoice || null);
        }}
        models={models}
        langOptions={langOptions}
        translatedLanguageOptions={translatedLanguageOptions}
        largeV3LanguagesKeys={largeV3LanguagesKeys}
      />
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
            handlePlayMessage={handlePlayMessageWithCallback}
            handleEditMessage={handleEditMessage}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
        </Box>
      </Grid>
      <AudioRecorder
        dictionary={dictionary}
        recording={recording}
        setRecording={setRecording}
        setStatus={setStatus}
        socketRef={socketRef}
        model={model}
        inputLanguage={inputLanguage}
        operation={operation}
        outputLanguage={outputLanguage}
        setMyFileType={setMyFileType}
        mediaRecorderRef={mediaRecorderRef}
        audioBufferRef={audioBufferRef}
        fileInputRef={fileInputRef}
      />
    </Container>
  );
};

export default RealTimeTranscription;
