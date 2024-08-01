// app/components/AudioRecorder.tsx
import React, { useRef, useState } from "react";
import { Button, Typography, Grid, IconButton } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

interface AudioRecorderProps {
  dictionary: any;
  recording: boolean;
  setRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  socketRef: React.MutableRefObject<WebSocket | null>;
  model: string;
  inputLanguage: string;
  operation: string;
  outputLanguage: string;
  setMyFileType: React.Dispatch<React.SetStateAction<string>>;
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
  audioBufferRef: React.MutableRefObject<Blob[]>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  dictionary,
  recording,
  setRecording,
  setStatus,
  socketRef,
  model,
  inputLanguage,
  operation,
  outputLanguage,
  setMyFileType,
  mediaRecorderRef,
  audioBufferRef,
  fileInputRef,
}) => {
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
      reader.onloadend = () => {
        const arrayBuffer = reader.result as ArrayBuffer; // 类型断言
        const binaryData = new Uint8Array(arrayBuffer);

        if (socketRef.current) {
          socketRef.current.send(
            JSON.stringify({
              type: "audio",
              audio: Array.from(binaryData),
              model: model,
              language: inputLanguage,
              operation: operation,
              outputLanguage:
                operation === "translation" || operation === "conversation"
                  ? outputLanguage
                  : undefined, // 新增输出语言
              response_format: "json",
              temperature: "0",
              fileType: audioType.split("/")[1],
            })
          );
          setStatus(dictionary.audioSent);
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", model);
      formData.append("language", inputLanguage);
      formData.append("operation", operation); // 新增操作
      if (operation === "translation" || operation === "conversation") {
        formData.append("outputLanguage", outputLanguage); // 新增输出语言
      }
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      try {
        const response = await fetch("http://localhost:3001/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Server response:", result);
          setStatus(dictionary.fileSent);
        } else {
          console.error("Upload failed:", response.statusText);
          setStatus(dictionary.uploadFailed);
        }
      } catch (error) {
        console.error("Error during upload:", error);
        setStatus(dictionary.uploadFailed);
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
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
      <Grid item sx={{ display: "none" }}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          ref={fileInputRef}
          style={{ display: "none" }}
        />
      </Grid>
    </Grid>
  );
};

export default AudioRecorder;
