import { NextRequest, NextResponse } from "next/server";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import { getGlobalSendMessage } from "@/lib/globalState";
import { Transcript } from "@/types";

const LLMApiBaseUrl = process.env.LLM_API_BASE_URL;
const LLMApiKey = process.env.LLM_API_KEY;

async function transcribeAudio(
  buffer: Uint8Array,
  model: string,
  language: string,
  responseFormat: string,
  temperature: string,
  fileType: string,
  lang: string,
  baseUrl: string
): Promise<Transcript> {
  const response = await fetch(`${baseUrl}/${lang}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: Array.from(buffer),
      model,
      language,
      responseFormat,
      temperature,
      fileType,
      operation: "translation",
    }),
  });

  if (!response.ok) {
    throw new Error("Transcription failed");
  }

  const transcription = await response.json();
  return transcription as Transcript;
}

async function translateText(
  text: string,
  outputLanguage: string
): Promise<string> {
  try {
    const systemPrompt =
      "You are a professional, authentic machine translation engine.";
    const userPrompt = `Translate the following source text to ${outputLanguage}, Output translation directly without any additional text.\nSource Text: ${text}\nTranslated Text:`;

    const LLMResponse = await fetch(
      `${LLMApiBaseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LLMApiKey}`,
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

    if (!LLMResponse.ok) {
      const errorText = await LLMResponse.text();
      console.error("LLM API response error:", errorText);
      throw new Error(`LLM API Error: ${errorText}`);
    }

    const LLMResponseText = await LLMResponse.text();

    const LLM = JSON.parse(LLMResponseText);

    return LLM.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error processing LLM:", error);
    throw new Error("Error processing LLM");
  }
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

    // 获取请求头中的referer，提取出lang
    const referer = request.headers.get("referer");
    if (!referer) {
      throw new Error("Referer header is missing");
    }
    const lang = new URL(referer).pathname.split("/")[1];
    const port = process.env.NEXT_PUBLIC_PORT || '3000';
    const baseUrl = `http://127.0.0.1:${port}`;

    const buffer = new Uint8Array(audio);
    const transcription = await transcribeAudio(
      buffer,
      model,
      language,
      responseFormat,
      temperature,
      fileType,
      lang,
      baseUrl
    );

    if (transcription.text) {
      // 继续进行翻译
      const LLM = await translateText(
        transcription.text,
        outputLanguage
      );
      const messageId = uuidv4();
      const audioBase64 = Buffer.from(buffer).toString("base64");
      const LLMResponse = {
        type: "translation",
        text: LLM,
        id: messageId,
        audio: audioBase64,
      };
      return NextResponse.json([transcription, LLMResponse]);
    }
  } catch (error) {
    console.error("Error during LLM:", error);
    return NextResponse.json(
      { error: "Error during LLM" },
      { status: 500 }
    );
  }
}
