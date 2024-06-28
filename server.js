import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3001;
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`服务器正在运行在 http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('客户端已连接');
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
            console.log(`音频文件已保存到 ${filePath}`);

            await convertAndTranscribe(filePath, ws);
        } else if (data.type === 'upload') {
            const buffer = Buffer.from(data.audio, 'base64');
            const filePath = `uploads/uploaded_audio_${Date.now()}.webm`;

            fs.writeFileSync(filePath, buffer);
            console.log(`上传的音频文件已保存到 ${filePath}`);

            await convertAndTranscribe(filePath, ws);
        } else if (data.type === 'stop') {
            audioBuffer = [];
            console.log('录音已停止，缓冲区已清空');
        }
    });

    ws.on('close', () => {
        console.log('客户端已断开连接');
    });
});

async function convertAndTranscribe(filePath, ws) {
    const mp3FilePath = filePath.replace(path.extname(filePath), '.mp3');
    
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .toFormat('mp3')
                .on('end', resolve)
                .on('error', reject)
                .save(mp3FilePath);
        });
        console.log(`音频文件已转换为 MP3: ${mp3FilePath}`);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(mp3FilePath));
        formData.append('model', 'Systran/faster-whisper-large-v3');
        formData.append('language', 'zh');
        formData.append('response_format', 'json');
        formData.append('temperature', '0');

        const response = await fetch('http://100.105.162.69:8000/v1/audio/transcriptions', {
            method: 'POST',
            body: formData
        });

        const responseText = await response.text();
        console.log('原始响应文本:', responseText);
        const transcription = JSON.parse(responseText);

        fs.unlinkSync(filePath);
        fs.unlinkSync(mp3FilePath);
        console.log(`已删除临时文件: ${filePath}, ${mp3FilePath}`);

        ws.send(JSON.stringify({ type: 'transcription', text: transcription.text }));
    } catch (error) {
        console.error('转录过程中出错:', error);
        ws.send(JSON.stringify({ type: 'error', message: '音频转录出错' }));

        // 确保在出错时删除临时文件
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`已删除临时文件: ${filePath}`);
            }
            if (fs.existsSync(mp3FilePath)) {
                fs.unlinkSync(mp3FilePath);
                console.log(`已删除临时文件: ${mp3FilePath}`);
            }
        } catch (cleanupError) {
            console.error('删除临时文件时出错:', cleanupError);
        }
    }
}
