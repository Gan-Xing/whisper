import webrtcvad
import collections
import contextlib
import sys
import wave
import os

def read_wave(path):
    with contextlib.closing(wave.open(path, 'rb')) as wf:
        num_channels = wf.getnchannels()
        assert num_channels == 1, f"Expected mono audio, but got {num_channels} channels"
        sample_width = wf.getsampwidth()
        assert sample_width == 2, f"Expected sample width of 2 bytes, but got {sample_width} bytes"
        sample_rate = wf.getframerate()
        assert sample_rate in (8000, 16000, 22050, 32000, 44100, 48000, 96000), f"Unexpected sample rate: {sample_rate}"
        pcm_data = wf.readframes(wf.getnframes())
        return pcm_data, sample_rate

def write_wave(path, audio, sample_rate):
    with contextlib.closing(wave.open(path, 'wb')) as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio)

class Frame(object):
    def __init__(self, bytes, timestamp, duration):
        self.bytes = bytes
        self.timestamp = timestamp
        self.duration = duration

def frame_generator(frame_duration_ms, audio, sample_rate):
    n = int(sample_rate * (frame_duration_ms / 1000.0) * 2)
    offset = 0
    timestamp = 0.0
    duration = (float(n) / sample_rate) / 2.0
    while offset + n < len(audio):
        yield Frame(audio[offset:offset + n], timestamp, duration)
        timestamp += duration
        offset += n

def vad_collector(sample_rate, frame_duration_ms, padding_duration_ms, vad, frames, min_segment_duration_s):
    num_padding_frames = int(padding_duration_ms / frame_duration_ms)
    ring_buffer = collections.deque(maxlen=num_padding_frames)
    triggered = False
    voiced_frames = []
    segment_start_time = None

    for frame in frames:
        is_speech = vad.is_speech(frame.bytes, sample_rate)

        if not triggered:
            ring_buffer.append((frame, is_speech))
            num_voiced = len([f for f, speech in ring_buffer if speech])
            if num_voiced > 0.9 * ring_buffer.maxlen:
                triggered = True
                voiced_frames.extend([f for f, s in ring_buffer])
                ring_buffer.clear()
                segment_start_time = frame.timestamp
        else:
            voiced_frames.append(frame)
            ring_buffer.append((frame, is_speech))
            num_unvoiced = len([f for f, speech in ring_buffer if not speech])
            
            segment_duration = frame.timestamp - segment_start_time
            if num_unvoiced > 0.9 * ring_buffer.maxlen and segment_duration >= min_segment_duration_s:
                triggered = False
                yield b''.join([f.bytes for f in voiced_frames])
                ring_buffer.clear()
                voiced_frames = []

    if voiced_frames:
        yield b''.join([f.bytes for f in voiced_frames])

def split_audio(input_path, output_dir, min_segment_duration_s=15):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    audio, sample_rate = read_wave(input_path)
    vad = webrtcvad.Vad(3)
    frames = frame_generator(30, audio, sample_rate)
    frames = list(frames)
    segments = vad_collector(sample_rate, 30, 300, vad, frames, min_segment_duration_s)

    for i, segment in enumerate(segments):
        output_path = os.path.join(output_dir, f'chunk_{i}.wav')
        write_wave(output_path, segment, sample_rate)
        print(output_path)

if __name__ == "__main__":
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    min_segment_duration_s = float(sys.argv[3]) if len(sys.argv) > 3 else 15
    split_audio(input_path, output_dir, min_segment_duration_s)
