# Real-time Local Speech-to-Text with VOX-Style Speaker Detection

A sophisticated Electron desktop application combining OpenAI's Whisper model with classical audio engineering principles for efficient real-time transcription and speaker detection.

## Overview

This application takes an innovative approach to speech transcription and speaker identification by combining modern machine learning with time-tested audio engineering and ham radio concepts. Instead of relying on ML-based diarization, it implements a sophisticated VOX (Voice-Operated Exchange) system, creating a solution that's both powerful and efficient.

## Technical Implementation

The audio processing chain implements key concepts from ham radio and audio engineering:
- Dual-watch monitoring of mic and desktop audio
- VOX-style operation with hysteresis for speaker detection
- Professional-grade frequency analysis (2048-point FFT)
- RMS-based audio level detection
- Sophisticated debouncing logic

## Advantages Over ML-Based Approaches

### Performance
- Near-zero latency (50ms decision intervals vs. 500ms-2s for ML)
- Minimal CPU/memory footprint
- No GPU requirements
- Instant startup (no model loading)

### Reliability
- Deterministic behavior
- Predictable speaker switching
- No model hallucinations
- Consistent performance across sessions

### Practicality
- Works completely offline
- Easy to debug and maintain
- No dependencies on external services
- Simple parameter tuning

### Privacy
- All processing happens locally
- No audio data leaves the system
- No cloud services required
- No model updates needed

## Limitations

### Speaker Discrimination
- Limited to two-party conversations
- Cannot identify individual speakers
- No speaker verification
- Cannot handle overlapping speech

### Environmental Adaptation
- Fixed thresholds may need manual adjustment
- More sensitive to background noise
- No automatic adaptation to different acoustics
- Cannot distinguish speech from similar-volume sounds

## Ideal Use Cases

- Customer service environments
- Professional transcription services
- Live broadcasting/streaming
- Two-party professional communications

## Less Suitable For

- Multi-party meetings
- Conference calls
- Informal group discussions
- Situations with significant background noise

## Technical Notes

Current ML-based diarization systems, while more flexible, face significant challenges:
- Diarization Error Rates of 5-15% in real conditions
- High latency for real-time applications
- Resource intensive
- Often require cloud connectivity

## Conclusion

This hybrid approach - using ML for transcription (Whisper) and classical engineering for speaker detection - creates a solution that's both powerful and practical for its intended use case. While it may not match the flexibility of ML-based diarization, it can actually outperform more complex solutions in specific, structured scenarios where real-time performance and reliability are critical.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)


## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
