const express = require('express');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const app = express();
const PORT = 3000;

const SAMPLE_RATE = 44100;
const MAX_VOLUME = 32767;

// Daftar nada (frekuensi)
const NOTES = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
    G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50
};

// Progresi chord populer: I–V–vi–IV dalam C Mayor
const CHORD_PROGRESSIONS = [
    ['C4', 'E4', 'G4'], // C (I)
    ['G3', 'B3', 'D4'], // G (V)
    ['A3', 'C4', 'E4'], // Am (vi)
    ['F3', 'A3', 'C4']  // F (IV)
];

// Fungsi envelope ADSR untuk dinamika suara
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

// Fungsi untuk menghasilkan satu nada
function generateNote(freq, duration = 0.5, volume = 0.4) {
    const samples = Math.floor(duration * SAMPLE_RATE);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        let sample = Math.sin(2 * Math.PI * freq * t) * 0.6; // Nada dasar
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.2; // Harmonik 1
        sample += Math.sin(2 * Math.PI * freq * 3 * t) * 0.1; // Harmonik 2

        sample *= MAX_VOLUME * volume;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return applyADSR(buffer);
}

// Fungsi untuk menghasilkan chord
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

// Fungsi untuk membuat melodi sederhana
function generateMelody(chord, duration = 0.4) {
    const melodyNote = chord[Math.floor(Math.random() * chord.length)];
    return generateNote(NOTES[melodyNote], duration, 0.35);
}

// Fungsi untuk streaming musik ambient terstruktur
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

    let chordIndex = 0;

    const interval = setInterval(() => {
        const currentChord = CHORD_PROGRESSIONS[chordIndex % CHORD_PROGRESSIONS.length];
        const chord = generateChord(currentChord, 1.5);
        const melody = generateMelody(currentChord, 0.5);
        const minLength = Math.min(chord.length, melody.length);
        const mixed = Buffer.alloc(minLength);

        for (let i = 0; i < minLength; i += 2) {
            let sample = (chord.readInt16LE(i) + melody.readInt16LE(i)) / 2;
            sample = Math.max(-MAX_VOLUME, Math.min(MAX_VOLUME, sample));
            mixed.writeInt16LE(sample | 0, i);
        }

        audioStream.push(mixed);
        chordIndex++;
    }, 1500); // Pergantian chord setiap 1.5 detik

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
