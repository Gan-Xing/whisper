// server.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 模拟 __dirname 和 __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001; // 确保与 Next.js 的端口不冲突
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    let audioBuffer = [];
    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.type === 'audio') {
            const buffer = Buffer.from(data.audio, 'base64');
            audioBuffer.push(buffer);

            const totalLength = audioBuffer.reduce((acc, buf) => acc + buf.length, 0);
            const concatenatedBuffer = Buffer.concat(audioBuffer, totalLength);
            const filePath = `uploads/audio_${Date.now()}.webm`;

            fs.writeFileSync(filePath, concatenatedBuffer);

            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(filePath));
                formData.append('model', 'Systran/faster-whisper-large-v3');
                formData.append('language', 'zh');
                formData.append('response_format', 'json');
                formData.append('temperature', '0');

                const response = await fetch('http://100.105.162.69:8000/v1/audio/transcriptions', {
                    method: 'POST',
                    body: formData
                });

                const transcription = await response.json();

                fs.unlinkSync(filePath); // 删除上传的文件

                ws.send(JSON.stringify({ type: 'transcription', text: transcription.text }));
            } catch (error) {
                console.error(error);
                ws.send(JSON.stringify({ type: 'error', message: 'Error transcribing audio' }));
            }
        }

        if (data.type === 'stop') {
            audioBuffer = [];
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
