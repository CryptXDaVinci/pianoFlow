const express = require('express');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = 3000;

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

function generateNote(freq, duration = 0.5, volume = 0.4, reverb = false) {
    const sampleRate = 44100;
    const samples = Math.floor(duration * sampleRate);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        let sample = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 32767 * volume;
        if (reverb) {
            const decay = Math.exp(-2 * i / samples);
            sample *= decay;
        }
        buffer.writeInt16LE(sample | 0, i * 2);  // Casting to integer
    }
    return buffer;
}

function generateChord(chordNotes, duration = 1) {
    const buffers = chordNotes.map(note =>
        generateNote(NOTES[note], duration, Math.random() * 0.3 + 0.2, true)
    );
    const length = Math.min(...buffers.map(buf => buf.length));
    const combined = Buffer.alloc(length);

    for (let i = 0; i < length; i += 2) {
        let mixedSample = buffers.reduce((acc, buf) => acc + buf.readInt16LE(i), 0);
        mixedSample = Math.max(-32768, Math.min(32767, mixedSample / buffers.length)); 
        combined.writeInt16LE(mixedSample | 0, i);
    }
    return combined;
}

function generateAmbientPad(frequency = 100, duration = 3, volume = 0.1) {
    const sampleRate = 44100;
    const samples = Math.floor(duration * sampleRate);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const mod = Math.sin(2 * Math.PI * (frequency / 4) * (i / sampleRate));
        const sample = Math.sin(2 * Math.PI * frequency * (i / sampleRate) + mod) * 32767 * volume;
        buffer.writeInt16LE(sample | 0, i * 2);
    }
    return buffer;
}

function generateRandomPianoSound() {
    const isChord = Math.random() > 0.5;
    if (isChord) {
        const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
        return generateChord(chord, Math.random() * 0.5 + 0.5);
    } else {
        const notes = Object.keys(NOTES);
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        return generateNote(NOTES[randomNote], Math.random() * 0.4 + 0.3, Math.random() * 0.4 + 0.3, true);
    }
}

app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline; filename="stream.mp3"');
    const audioStream = new Readable({ read() {} });

    ffmpeg(audioStream)
    .inputFormat('s16le')
    .audioFrequency(44100)
    .audioChannels(1)
    .audioCodec('libmp3lame')
    .format('mp3')
    .addOption('-buffer_size', '2048k') 
    .addOption('-fflags', 'nobuffer')
    .addOption('-flush_packets', '1')
    .addOption('-reconnect', '1')
    .addOption('-reconnect_streamed', '1')
    .on('error', err => console.error('FFmpeg Error:', err))
    .pipe(res);
    
    const interval = setInterval(() => {
        const piano = generateRandomPianoSound();
        const pad = generateAmbientPad(80 + Math.random() * 40, 2, 0.07);

        const minLength = Math.min(piano.length, pad.length);
        const mixed = Buffer.alloc(minLength);

        for (let i = 0; i < minLength; i += 2) {
            let sample = (piano.readInt16LE(i) + pad.readInt16LE(i)) / 2;
            sample = Math.max(-32768, Math.min(32767, sample));
            mixed.writeInt16LE(sample | 0, i);
        }
        audioStream.push(mixed);
    }, 1000);

    req.on('close', () => {
        clearInterval(interval);
        audioStream.push(null);
        console.log('Client disconnected, resources cleaned up.');
    });

    console.log('Client connected to ambient piano stream');
});

app.listen(PORT, () => {
    console.log(`🎹 Ambient Piano Radio running at http://localhost:${PORT}/stream`);
});