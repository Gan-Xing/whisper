import { spawn } from "child_process";
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

const env = process.env.NODE_ENV;

if (env === "production") {
  dotenv.config({ path: ".env.production" });
} else {
  dotenv.config({ path: ".env.development" });
}

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

const wss = new WebSocketServer({ server,maxPayload: 40000 * 1024 * 1024   });

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
    const isUpload = data.type === "upload";

    if (data.type === "audio" || data.type === "upload") {
      const buffer = Uint8Array.from(data.audio);

      const audioType = data.fileType || "webm"; // 动态确定文件扩展名
      const filePath = path.join(
        __dirname,
        `uploads/audio_${Date.now()}.${audioType}`
      ); // 动态确定文件扩展名

      fs.writeFileSync(filePath, buffer);
      console.log(`Audio file saved to ${filePath}`);

      await handleAudioFile(
        filePath,
        ws,
        model,
        language,
        responseFormat,
        temperature,
        operation,
        outputLanguage,
        isUpload
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

async function handleAudioFile(
  filePath,
  ws,
  model,
  language,
  responseFormat,
  temperature,
  operation,
  outputLanguage,
  isUpload
) {
  const wavFilePath = filePath.replace(path.extname(filePath), ".wav");
  const outputDir = path.join(__dirname, "uploads", "chunks");

  console.log("wavFilePath", wavFilePath);
  console.log("outputDir", outputDir);

  console.log(new Date().toISOString().replace("T", " ").replace("Z", ""));

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
    .audioChannels(1)
    .audioCodec('pcm_s16le')
    .toFormat("wav")
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

  console.log(new Date().toISOString().replace("T", " ").replace("Z", ""));

  try {
    if (isUpload) {
      const pythonProcess = spawn("python", [
        "split_audio_vad.py",
        wavFilePath,
        outputDir,
        "30",
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
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Python process error: ${data}`,
          })
        );
      });

      pythonProcess.on("close", async (code) => {
        console.log(`Python process exited with code: ${code}`);
        if (code !== 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Python process exited with code: ${code}`,
            })
          );
          cleanupFiles([filePath, wavFilePath]);
          return;
        }
        while (chunkQueue.length > 0) {
          const chunkFilePath = chunkQueue.shift();
          await transcribeOrTranslate(
            chunkFilePath,
            ws,
            model,
            language,
            responseFormat,
            temperature,
            operation,
            outputLanguage
          );
          fs.unlinkSync(chunkFilePath);
          console.log(`Deleted temporary file: ${chunkFilePath}`);
        }
        cleanupFiles([filePath, wavFilePath]);
        console.log(`Deleted original file: ${filePath}`);
      });
    } else {
      await transcribeOrTranslate(
        wavFilePath,
        ws,
        model,
        language,
        responseFormat,
        temperature,
        operation,
        outputLanguage
      );
      cleanupFiles([filePath, wavFilePath]);
    }
  } catch (error) {
    console.error("Error during conversion and sending:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Error converting or sending audio",
      })
    );
    cleanupFiles([filePath, wavFilePath]);
  }
}

async function transcribeOrTranslate(
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

    // 读取wav文件并编码为base64
    const audioBuffer = fs.readFileSync(chunkFilePath);
    const audioBase64 = audioBuffer.toString("base64");
    console.log(new Date().toISOString().replace("T", " ").replace("Z", ""));

    ws.send(
      JSON.stringify({
        type: "transcription",
        text: transcription.text,
        id: messageId,
        audio: audioBase64,
      })
    );

    if (operation === "translation" || operation === "conversation") {
      const systemPrompt =
        operation === "translation"
          ? "You are a professional, authentic machine translation engine."
          : "You are a helpful assistant engaging in a conversation.";

      const userPrompt =
        operation === "translation"
          ? `Translate the following source text to ${outputLanguage}, Output translation directly without any additional text.\nSource Text: ${transcription.text}\nTranslated Text:`
          : `Respond to the following input in ${outputLanguage} as if you were having a conversation. Keep your responses concise and brief. Output response directly without any additional text.\nInput: ${transcription.text}\nResponse:`;

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
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
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
          type: operation,
          text: translation.choices[0].message.content.trim(),
          id: messageId,
          audio: audioBase64,
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

function cleanupFiles(files) {
  files.forEach((file) => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`Deleted temporary file: ${file}`);
      } catch (error) {
        console.error(`Error deleting temporary file: ${file}`, error);
      }
    }
  });
}
