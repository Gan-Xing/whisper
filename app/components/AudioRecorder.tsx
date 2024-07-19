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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && socketRef.current) {
      setStatus(`${dictionary.uploadingFile}: ${file.name}`);
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onloadend = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        if (arrayBuffer) {
          const byteArray = new Uint8Array(arrayBuffer);
          const bufferData = Array.from(byteArray);
          socketRef.current!.send(
            JSON.stringify({
              type: "upload",
              audio: bufferData,
              fileType: file.type.split("/")[1],
              model: model,
              language: inputLanguage,
              operation: operation, // 新增操作
              outputLanguage:
                operation === "translation" || operation === "conversation"
                  ? outputLanguage
                  : undefined, // 新增输出语言
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
