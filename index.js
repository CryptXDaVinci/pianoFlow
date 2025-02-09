const express = require('express');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const app = express();
const PORT = 3000;

const SAMPLE_RATE = 44100;
const MAX_VOLUME = 32767;

const NOTES = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
    G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50
};

const CHORDS = [
    ['C3', 'E3', 'G3'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'],
    ['G4', 'B4', 'D5'], ['F4', 'A4', 'C5'], ['A3', 'C4', 'E4'],
    ['A4', 'C5', 'E5'], ['D4', 'F4', 'A4'], ['E4', 'G4', 'B4'],
    ['C4', 'E4', 'G4', 'Bb4'], ['G4', 'B4', 'D5', 'F5'],
    ['F4', 'A4', 'C5', 'Eb5'], ['D4', 'E4', 'A4'],
    ['D4', 'G4', 'A4'], ['G4', 'A4', 'D5'],
    ['G4', 'C5', 'D5'], ['C4', 'E4', 'G4', 'Bb4', 'D5'],
    ['G3', 'B3', 'D4', 'F4', 'A4'], ['C5', 'E5', 'G5'],
    ['A5', 'C6', 'E6'], ['F5', 'A5', 'C6']
];

// Fungsi untuk membuat envelope ADSR
function applyADSR(buffer, attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2) {
    const samples = buffer.length / 2;
    const attackSamples = Math.floor(attack * SAMPLE_RATE);
    const decaySamples = Math.floor(decay * SAMPLE_RATE);
    const releaseSamples = Math.floor(release * SAMPLE_RATE);
    const sustainSamples = samples - (attackSamples + decaySamples + releaseSamples);

    for (let i = 0; i < samples; i++) {
        let amplitude = 1;
        if (i < attackSamples) {
            amplitude = i / attackSamples; // Attack
        } else if (i < attackSamples + decaySamples) {
            amplitude = 1 - ((i - attackSamples) / decaySamples) * (1 - sustain); // Decay
        } else if (i < attackSamples + decaySamples + sustainSamples) {
            amplitude = sustain; // Sustain
        } else {
            amplitude = sustain * (1 - ((i - (samples - releaseSamples)) / releaseSamples)); // Release
        }
        const sample = buffer.readInt16LE(i * 2) * amplitude;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return buffer;
}

// Fungsi untuk menghasilkan nada dengan harmonik dan ADSR
function generateNote(freq, duration = 0.5, volume = 0.4) {
    const samples = Math.floor(duration * SAMPLE_RATE);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        let sample = Math.sin(2 * Math.PI * freq * t) * 0.6; // Fundamental
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.2; // 1st Overtone
        sample += Math.sin(2 * Math.PI * freq * 3 * t) * 0.1; // 2nd Overtone
        sample += Math.sin(2 * Math.PI * freq * 4 * t) * 0.05; // 3rd Overtone

        sample *= MAX_VOLUME * volume;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return applyADSR(buffer);
}

// Fungsi untuk membuat chord dari beberapa nada
function generateChord(notes, duration = 1) {
    const buffers = notes.map(note => generateNote(NOTES[note], duration, 0.3));
    const length = Math.min(...buffers.map(buf => buf.length));
    const combined = Buffer.alloc(length);

    for (let i = 0; i < length; i += 2) {
        let sample = buffers.reduce((acc, buf) => acc + buf.readInt16LE(i), 0) / buffers.length;
        sample = Math.max(-MAX_VOLUME, Math.min(MAX_VOLUME, sample));
        combined.writeInt16LE(sample | 0, i);
    }
    return applyADSR(combined, 0.02, 0.1, 0.8, 0.3);
}

// Fungsi untuk membuat ambient pad dengan vibrato
function generateAmbientPad(frequency = 100, duration = 3, volume = 0.1) {
    const samples = Math.floor(duration * SAMPLE_RATE);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const vibrato = Math.sin(2 * Math.PI * 5 * (i / SAMPLE_RATE)) * 5; // Vibrato 5 Hz
        const sample = Math.sin(2 * Math.PI * (frequency + vibrato) * (i / SAMPLE_RATE)) * MAX_VOLUME * volume;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return applyADSR(buffer, 0.5, 1, 0.6, 1.5); // Slow attack-release for pad
}

// Fungsi untuk menghasilkan suara piano acak
function generateRandomPianoSound() {
    const isChord = Math.random() > 0.5;
    const duration = 0.4 + Math.random() * 0.8; // Variasi durasi
    const volume = 0.3 + Math.random() * 0.2;  // Variasi volume

    return isChord
        ? generateChord(CHORDS[Math.floor(Math.random() * CHORDS.length)], duration)
        : generateNote(NOTES[Object.keys(NOTES)[Math.floor(Math.random() * Object.keys(NOTES).length)]], duration, volume);
}

// Endpoint streaming
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');

    const audioStream = new Readable({ read() {} });

    ffmpeg(audioStream)
        .inputFormat('s16le')
        .audioFrequency(SAMPLE_RATE)
        .audioChannels(1)
        .audioCodec('libmp3lame')
        .format('mp3')
        .addOption('-fflags', 'nobuffer')
        .addOption('-flush_packets', '1')
        .on('error', err => console.error('FFmpeg Error:', err))
        .pipe(res);

    const interval = setInterval(() => {
        const piano = generateRandomPianoSound();
        const pad = generateAmbientPad(80 + Math.random() * 40, 2, 0.07);
        const minLength = Math.min(piano.length, pad.length);
        const mixed = Buffer.alloc(minLength);

        for (let i = 0; i < minLength; i += 2) {
            let sample = (piano.readInt16LE(i) + pad.readInt16LE(i)) / 2;
            sample = Math.max(-MAX_VOLUME, Math.min(MAX_VOLUME, sample));
            mixed.writeInt16LE(sample | 0, i);
        }
        audioStream.push(mixed);
    }, 500);

    req.on('close', () => {
        clearInterval(interval);
        audioStream.push(null);
        console.log('Client disconnected, resources cleaned.');
    });

    console.log('Client connected to ambient stream');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎶 Ambient Piano Radio running at http://localhost:${PORT}/stream`);
});
