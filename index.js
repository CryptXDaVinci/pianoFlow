const express = require('express');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = 3000;

// Konstanta
const SAMPLE_RATE = 44100;
const MAX_VOLUME = 32767;
const BUFFER_DURATION = 5; // Detik untuk pre-buffering

// Daftar nada dan progresi akor
const NOTES = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
    G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50
};

const CHORD_PROGRESSIONS = [
    ['C4', 'E4', 'G4'],
    ['Am', 'C4', 'E4'],
    ['F4', 'A4', 'C5'],
    ['G4', 'B4', 'D5'],
    ['Dm', 'F4', 'A4'],
    ['Em', 'G4', 'B4'],
];

// Fungsi ADSR Envelope
function applyADSR(buffer, attack = 0.02, decay = 0.1, sustain = 0.8, release = 0.3) {
    const samples = buffer.length / 2;
    const attackSamples = Math.floor(attack * SAMPLE_RATE);
    const decaySamples = Math.floor(decay * SAMPLE_RATE);
    const releaseSamples = Math.floor(release * SAMPLE_RATE);
    const sustainSamples = samples - (attackSamples + decaySamples + releaseSamples);

    for (let i = 0; i < samples; i++) {
        let amplitude = 1;
        if (i < attackSamples) {
            amplitude = i / attackSamples;
        } else if (i < attackSamples + decaySamples) {
            amplitude = 1 - ((i - attackSamples) / decaySamples) * (1 - sustain);
        } else if (i < attackSamples + decaySamples + sustainSamples) {
            amplitude = sustain;
        } else {
            amplitude = sustain * (1 - ((i - (samples - releaseSamples)) / releaseSamples));
        }
        const sample = buffer.readInt16LE(i * 2) * amplitude;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return buffer;
}

// Fungsi untuk menghasilkan nada tunggal
function generateNote(freq, duration = 0.5, volume = 0.4) {
    const samples = Math.floor(duration * SAMPLE_RATE);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        let sample = Math.sin(2 * Math.PI * freq * t) * 0.6;      // Gelombang dasar
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.2;    // Harmonik ke-2
        sample += Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;    // Harmonik ke-3

        sample *= MAX_VOLUME * volume;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return applyADSR(buffer);
}

// Fungsi untuk menghasilkan akor
function generateChord(notes, duration = 1) {
    const buffers = notes.map(note => generateNote(NOTES[note] || 0, duration, 0.3));
    const length = Math.min(...buffers.map(buf => buf.length));
    const combined = Buffer.alloc(length);

    for (let i = 0; i < length; i += 2) {
        let sample = buffers.reduce((acc, buf) => acc + buf.readInt16LE(i), 0) / buffers.length;
        sample = Math.max(-MAX_VOLUME, Math.min(MAX_VOLUME, sample));
        combined.writeInt16LE(sample | 0, i);
    }
    return applyADSR(combined);
}

// Fungsi untuk menghasilkan melodi acak dari akor
function generateMelody(chord, duration = 0.4) {
    const melodyNote = chord[Math.floor(Math.random() * chord.length)];
    const octaveShift = Math.random() > 0.5 ? 2 : 0; // Variasi oktaf
    return generateNote((NOTES[melodyNote] || 0) * (1 + octaveShift), duration, 0.35);
}

// Pre-buffering untuk stabilitas
function preBufferAudio() {
    const bufferChunks = [];
    let chordIndex = 0;

    for (let i = 0; i < BUFFER_DURATION; i++) {
        const currentChord = CHORD_PROGRESSIONS[chordIndex % CHORD_PROGRESSIONS.length];
        const chord = generateChord(currentChord, 1.5);
        const melody = generateMelody(currentChord, 0.5);

        const minLength = Math.min(chord.length, melody.length);
        const mixed = Buffer.alloc(minLength);

        for (let j = 0; j < minLength; j += 2) {
            let sample = (chord.readInt16LE(j) + melody.readInt16LE(j)) / 2;
            sample = Math.max(-MAX_VOLUME, Math.min(MAX_VOLUME, sample));
            mixed.writeInt16LE(sample | 0, j);
        }
        bufferChunks.push(mixed);
        chordIndex++;
    }
    return bufferChunks;
}

// Streaming musik
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Connection', 'keep-alive');

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

    const preBufferedChunks = preBufferAudio();
    preBufferedChunks.forEach(chunk => audioStream.push(chunk)); // Kirim pre-buffer terlebih dahulu

    let chordIndex = 0;

    function streamAudio() {
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

        if (!audioStream.push(mixed)) {
            console.log('Buffer penuh, menunggu drain...');
        }

        chordIndex++;
        setImmediate(streamAudio); // Non-blocking loop
    }

    streamAudio();

    req.on('close', () => {
        audioStream.push(null);
        console.log('Client disconnected.');
    });

    console.log('Client connected.');
});

// Server berjalan
app.listen(PORT, () => {
    console.log(`🎶 Ambient Piano Radio is live at http://localhost:${PORT}/stream`);
});
