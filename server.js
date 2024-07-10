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
import ffmpegPath from "ffmpeg-static";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3001;
const upload = multer({ dest: "uploads/" });

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(port, () => {
  console.log(`服务器正在运行在 http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("客户端已连接");
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

      const filePath = `uploads/audio_${Date.now()}.webm`;

      fs.writeFileSync(filePath, buffer);
      console.log(`音频文件已保存到 ${filePath}`);

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
      const filePath = `uploads/uploaded_audio_${Date.now()}.webm`;

      fs.writeFileSync(filePath, buffer);
      console.log(`上传的音频文件已保存到 ${filePath}`);

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
      console.log("录音已停止，缓冲区已清空");
    } else if (data.type === "pong") {
      console.log("Received pong from client");
    }
  });

  ws.on("close", () => {
    clearInterval(interval); // 关闭连接时清除心跳定时器
    console.log("客户端已断开连接");
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

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(wavFilePath);
    });
    console.log(`音频文件已转换为 WAV: ${wavFilePath}`);

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
      console.error(`stderr: ${data}`);
    });

    pythonProcess.on("close", async (code) => {
      console.log(`子进程退出码: ${code}`);
      try {
        fs.unlinkSync(wavFilePath);
        console.log(`已删除原始 WAV 文件: ${wavFilePath}`);
      } catch (error) {
        console.error(`删除临时文件时出错: ${wavFilePath}`, error);
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
          console.log(`已删除临时文件: ${chunkFilePath}`);
        } catch (error) {
          console.error(`删除临时文件时出错: ${chunkFilePath}`, error);
        }
        // 删除原始的 webm 文件
        try {
          fs.unlinkSync(filePath);
          console.log(`已删除原始 webm 文件: ${filePath}`);
        } catch (error) {
          console.error(`删除原始 webm 文件时出错: ${filePath}`, error);
        }
      }
    });
  } catch (error) {
    console.error("转换和分割过程中出错:", error);
    ws.send(JSON.stringify({ type: "error", message: "音频转换或分割出错" }));

    // 确保在出错时删除临时文件
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`已删除临时文件: ${filePath}`);
      }
      if (fs.existsSync(wavFilePath)) {
        fs.unlinkSync(wavFilePath);
        console.log(`已删除临时 WAV 文件: ${wavFilePath}`);
      }
    } catch (cleanupError) {
      console.error("删除临时文件时出错:", cleanupError);
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
    console.log("原始响应文本:", transcriptionResponseText);
    const transcription = JSON.parse(transcriptionResponseText);

    ws.send(
      JSON.stringify({
        type: "transcription",
        text: transcription.text,
        id: messageId,
      })
    );

    if (operation === "translation") {
      // 发起翻译请求
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
      console.log("翻译响应文本:", translationResponseText);
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
    console.error("转录或翻译过程中出错:", error);
    ws.send(JSON.stringify({ type: "error", message: "音频处理出错" }));
  }
}
