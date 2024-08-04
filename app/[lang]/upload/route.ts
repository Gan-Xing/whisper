// pages/api/upload.ts
import { NextRequest, NextResponse } from "next/server";
import { getGlobalSendMessage } from "@/lib/globalState";
import ffmpeg from "fluent-ffmpeg";
import { extname, join } from "path";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";

const ffmpegPath = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";
const transcriptionApiBaseUrl = process.env.TRANSCRIPTION_API_BASE_URL;

ffmpeg.setFfmpegPath(ffmpegPath);

async function handleAudioFile(
  buffer: Buffer,
  model: string,
  language: string,
  responseFormat: string,
  temperature: string,
  fileType: string,
  sendMessage: (data: any) => void
) {
  const audioType = fileType || "webm";
  const uploadDir = join(process.cwd(), "uploads");
  const filePath = join(uploadDir, `audio_${Date.now()}.${audioType}`);
  const wavFilePath = join(uploadDir, `audio_${Date.now()}_processed.wav`);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    fs.writeFileSync(filePath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .audioChannels(1)
        .audioCodec("pcm_s16le")
        .toFormat("wav")
        .on("end", () => {
          console.log("FFmpeg processing finished");
          resolve();
        })
        .on("error", (error) => {
          console.error("FFmpeg error:", error);
          reject(error);
        })
        .save(wavFilePath);
    });

    const chunks = await splitAudio(wavFilePath, 30);
    console.log("Audio split into chunks:", chunks);

    for (const chunk of chunks) {
      const transcription = await transcribeAudio(
        chunk,
        model,
        language,
        responseFormat,
        temperature
      );
      sendMessage(transcription);
      fs.unlinkSync(chunk);
    }

    cleanupFiles([filePath, wavFilePath]);
    console.log("Cleaned up temporary files");
  } catch (error) {
    console.error("Error handling audio file:", error);
    cleanupFiles([filePath, wavFilePath]);
    throw new Error("Error handling audio file");
  }
}

async function splitAudio(filePath: string, chunkDuration: number) {
  const outputDir = join(process.cwd(), "uploads/chunks");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise<string[]>((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        `-f segment`,
        `-segment_time ${chunkDuration}`,
        `-c copy`,
      ])
      .on("end", () => {
        fs.readdir(outputDir, (err, files) => {
          if (err) {
            reject(err);
          } else {
            const outputFiles = files.map((file) => join(outputDir, file));
            resolve(outputFiles);
          }
        });
      })
      .on("error", (error) => reject(error))
      .save(`${outputDir}/chunk_%03d.wav`);
  });
}

async function transcribeAudio(
  chunkFilePath: string,
  model: string,
  language: string,
  responseFormat: string,
  temperature: string
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
      `${transcriptionApiBaseUrl}/v1/audio/transcriptions`,
      {
        method: "POST",
        body: formData,
      }
    );

    const transcriptionResponseText = await transcriptionResponse.text();
    const transcription = JSON.parse(transcriptionResponseText);

    const audioBuffer = fs.readFileSync(chunkFilePath);
    const audioBase64 = audioBuffer.toString("base64");

    return {
      type: "transcription",
      text: transcription.text,
      id: messageId,
      audio: audioBase64,
    };
  } catch (error) {
    throw new Error("Error processing audio");
  }
}

function cleanupFiles(files: string[]) {
  files.forEach((file) => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.error(`Error deleting temporary file: ${file}`, error);
      }
    }
  });
}

// 文件上传处理逻辑
export async function POST(request: NextRequest) {
  if (request.method === "POST") {
    const formData = await request.formData();
    const file = formData.get("file");
    const model = formData.get("model");
    const language = formData.get("language");
    const responseFormat = formData.get("response_format");
    const temperature = formData.get("temperature");

    if (
      !file ||
      typeof file.arrayBuffer !== "function" ||
      typeof file.type !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid file upload" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type.split("/")[1];

    // 等待 SSE 连接建立
    await new Promise<void>((resolve) => {
      const checkConnection = setInterval(() => {
        if (getGlobalSendMessage() !== (() => {})) {
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);
    });

    try {
      const sendMessage = getGlobalSendMessage();
      sendMessage({ status: "File upload started" });
      await handleAudioFile(
        buffer,
        model,
        language,
        responseFormat,
        temperature,
        fileType,
        sendMessage
      );
      sendMessage({ status: "File upload and processing completed" });
      return NextResponse.json({ message: "File uploaded and processed successfully" });
    } catch (error) {
      const sendMessage = getGlobalSendMessage();
      sendMessage({ status: "Error during file processing" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unsupported method" }, { status: 405 });
}
