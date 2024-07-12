import { exec, spawn } from "child_process";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ffmpegPath = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg"; // 使用环境变量或默认路径
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.NEXT_PUBLIC_WS_PORT || 3001; // 从环境变量中读取端口
const upload = multer({ dest: path.join(__dirname, "uploads/") }); // 修改路径

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");
  let audioBuffer = [];

  // 心跳机制
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 50000); // 每50秒发送一次心跳

  ws.on("message", async (message) => {
    const data = JSON.parse(message);
    const model = data.model || "Systran/faster-whisper-large-v3";
    const language = data.language || "zh";
    const operation = data.operation || "transcription"; // 新增操作
    const outputLanguage = data.outputLanguage || "fr"; // 新增输出语言
    const responseFormat = data.response_format || "json";
    const temperature = data.temperature || "0";

    if (data.type === "audio") {
      const buffer = Buffer.from(data.audio, "base64");
      audioBuffer.push(buffer);

      const filePath = path.join(__dirname, `uploads/audio_${Date.now()}.webm`); // 修改路径

      fs.writeFileSync(filePath, buffer);
      console.log(`Audio file saved to ${filePath}`);

      await convertToWavAndSplit(
        filePath,
        ws,
        model,
        language,
        responseFormat,
        temperature,
        operation,
        outputLanguage
      );
    } else if (data.type === "upload") {
      const buffer = Buffer.from(data.audio, "base64");
      const extension = data.fileType || 'webm'; // 动态确定文件扩展名
      const filePath = path.join(
        __dirname,
        `uploads/uploaded_audio_${Date.now()}.${extension}`
      ); // 动态确定文件扩展名

      fs.writeFileSync(filePath, buffer);
      console.log(`Uploaded audio file saved to ${filePath}`);

      await convertToWavAndSplit(
        filePath,
        ws,
        model,
        language,
        responseFormat,
        temperature,
        operation,
        outputLanguage
      );
    } else if (data.type === "stop") {
      audioBuffer = [];
      console.log("Recording stopped, buffer cleared");
    } else if (data.type === "pong") {
      console.log("Received pong from client");
    }
  });

  ws.on("close", () => {
    clearInterval(interval); // 关闭连接时清除心跳定时器
    console.log("Client disconnected");
  });
});

async function convertToWavAndSplit(
  filePath,
  ws,
  model,
  language,
  responseFormat,
  temperature,
  operation,
  outputLanguage
) {
  const wavFilePath = filePath.replace(path.extname(filePath), ".wav");
  const outputDir = path.join(__dirname, "uploads", "chunks");

  console.log("wavFilePath", wavFilePath);
  console.log("outputDir", outputDir);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat("wav")
        .audioCodec('pcm_s16le') // 设置音频编解码器
        .audioChannels(1) // 设置音频通道数
        .audioFrequency(16000) // 设置音频采样率
        .on("end", () => {
          console.log(`Audio file successfully converted to WAV: ${wavFilePath}`);
          resolve();
        })
        .on("error", (error) => {
          console.error(`Error converting audio to WAV: ${error.message}`);
          reject(error);
        })
        .save(wavFilePath);
    });

    const pythonProcess = spawn("python", [
      "split_audio_vad.py",
      wavFilePath,
      outputDir,
      "60",
    ]);
    const chunkQueue = [];

    pythonProcess.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        const chunkFilePath = line.trim();
        if (chunkFilePath) {
          chunkQueue.push(chunkFilePath);
        }
      });
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python process stderr: ${data}`);
    });

    pythonProcess.on("close", async (code) => {
      console.log(`Python process exited with code: ${code}`);
      try {
        fs.unlinkSync(wavFilePath);
        console.log(`Deleted original WAV file: ${wavFilePath}`);
      } catch (error) {
        console.error(
          `Error deleting temporary WAV file: ${wavFilePath}`,
          error
        );
      }

      while (chunkQueue.length > 0) {
        const chunkFilePath = chunkQueue.shift();
        await transcribeOrTranslateChunk(
          chunkFilePath,
          ws,
          model,
          language,
          responseFormat,
          temperature,
          operation,
          outputLanguage
        );
        try {
          fs.unlinkSync(chunkFilePath);
          console.log(`Deleted temporary file: ${chunkFilePath}`);
        } catch (error) {
          console.error(
            `Error deleting temporary file: ${chunkFilePath}`,
            error
          );
        }
      }

      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted original file: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting original file: ${filePath}`, error);
      }
    });
  } catch (error) {
    console.error("Error during conversion and splitting:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Error converting or splitting audio",
      })
    );

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted temporary file: ${filePath}`);
      }
      if (fs.existsSync(wavFilePath)) {
        fs.unlinkSync(wavFilePath);
        // Ensure temporary files are deleted in case of errorconsole.log(`Deleted temporary WAV file: ${wavFilePath}`);
      }
    } catch (cleanupError) {
      console.error("Error deleting temporary files:", cleanupError);
    }
  }
}

async function transcribeOrTranslateChunk(
  chunkFilePath,
  ws,
  model,
  language,
  responseFormat,
  temperature,
  operation,
  outputLanguage
) {
  const messageId = uuidv4();
  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(chunkFilePath));
    formData.append("model", model);
    formData.append("language", language);
    formData.append("response_format", responseFormat);
    formData.append("temperature", temperature);

    const transcriptionResponse = await fetch(
      `${process.env.TRANSCRIPTION_API_BASE_URL}/v1/audio/transcriptions`,
      {
        method: "POST",
        body: formData,
      }
    );

    const transcriptionResponseText = await transcriptionResponse.text();
    console.log("Transcription API response:", transcriptionResponseText);
    const transcription = JSON.parse(transcriptionResponseText);

    ws.send(
      JSON.stringify({
        type: "transcription",
        text: transcription.text,
        id: messageId,
      })
    );

    if (operation === "translation") {
      const translationResponse = await fetch(
        `${process.env.TRANSLATION_API_BASE_URL}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.TRANSLATION_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional, authentic machine translation engine.",
              },
              {
                role: "user",
                content: `Translate the following source text to ${outputLanguage}, Output translation directly without any additional text.\nSource Text: ${transcription.text}\nTranslated Text:`,
              },
            ],
          }),
        }
      );

      const translationResponseText = await translationResponse.text();
      console.log("Translation API response:", translationResponseText);
      const translation = JSON.parse(translationResponseText);

      ws.send(
        JSON.stringify({
          type: "translation",
          text: translation.choices[0].message.content.trim(),
          id: messageId,
        })
      );
    }
  } catch (error) {
    console.error("Error during transcription or translation:", error);
    ws.send(
      JSON.stringify({ type: "error", message: "Error processing audio" })
    );
  }
}
