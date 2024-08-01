// pages/api/sse.ts
import { NextRequest, NextResponse } from "next/server";
import { setGlobalSendMessage, getGlobalSendMessage } from "@/lib/globalState";

export function GET(request: NextRequest) {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  setGlobalSendMessage((data: { status: string } | any) => {
    writer.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  const sendMessage = getGlobalSendMessage();
  sendMessage({ status: "SSE connection established" });

  // 保持连接打开状态
  const interval = setInterval(() => {
    sendMessage({ status: "Keep connection alive" });
  }, 30000);

  const closeConnection = () => {
    clearInterval(interval);
    sendMessage({ status: "SSE connection closed" });
    writer.close();
  };

  request.signal.addEventListener("abort", closeConnection);

  return new NextResponse(responseStream.readable, { headers });
}
