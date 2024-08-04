import { NextRequest, NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import { extname, join } from "path";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
const ffmpegPath = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";
const transcriptionApiBaseUrl = process.env.TRANSCRIPTION_API_BASE_URL;

ffmpeg.setFfmpegPath(ffmpegPath);

async function handleAudioFile(
  buffer: Buffer,
  model: string,
  language: string,
  responseFormat: string,
  temperature: string,
  fileType: string
) {
  const audioType = fileType || "webm"; // 动态确定文件扩展名
  const uploadDir = join(process.cwd(), "uploads");
  const filePath = join(uploadDir, `audio_${Date.now()}.${audioType}`);
  const wavFilePath = join(uploadDir, `audio_${Date.now()}_processed.wav`);

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    // Save buffer to file
    fs.writeFileSync(filePath, buffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .audioChannels(1)
        .audioCodec("pcm_s16le")
        .toFormat("wav")
        .on("end", () => {
          console.log(
            `Audio file successfully converted to WAV: ${wavFilePath}`
          );
          resolve();
        })
        .on("error", (error) => {
          console.error(`Error converting audio to WAV: ${error.message}`);
          reject(error);
        })
        .save(wavFilePath);
    });

    const result = await transcribeAudio(
      wavFilePath,
      model,
      language,
      responseFormat,
      temperature
    );

    cleanupFiles([filePath, wavFilePath]);

    return result;
  } catch (error) {
    console.error("Error handling audio file:", error);
    cleanupFiles([filePath, wavFilePath]);
    throw new Error("Error handling audio file");
  }
}

async function transcribeAudio(
  chunkFilePath: string,
  model: string,
  language: string,
  responseFormat: string,
  temperature: string,
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

    // 读取wav文件并编码为base64
    const audioBuffer = fs.readFileSync(chunkFilePath);
    const audioBase64 = audioBuffer.toString("base64");


    const response = {
      type: "transcription",
      text: transcription.text,
      id: messageId,
      audio: audioBase64,
    };

    return response;
  } catch (error) {
    console.error("Error during transcription or translation:", error);
    throw new Error("Error processing audio");
  }
}

function cleanupFiles(files: string[]) {
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

export async function POST(request: NextRequest) {
  try {
    const {
      audio,
      model,
      language,
      responseFormat,
      temperature,
      operation,
      outputLanguage,
      fileType,
    } = await request.json();
    const buffer = Buffer.from(new Uint8Array(audio));

    const result = await handleAudioFile(
      buffer,
      model,
      language,
      responseFormat,
      temperature,
      fileType
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Error during transcription" },
      { status: 500 }
    );
  }
}
