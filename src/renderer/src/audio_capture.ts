import { Observable } from 'rxjs'

// Global variable to track if speech is detected
declare global {
  var current_speaker: boolean;
  var current_volume: number;
}
globalThis.current_speaker = false;
globalThis.current_volume = 0;

// Audio processing constants
const VOLUME_THRESHOLD_ON = 20;      // Higher threshold to start transmission
const VOLUME_THRESHOLD_OFF = 10;     // Lower threshold to end transmission
const TRANSMISSION_HOLDOFF = 300;    // Debounce time between speaker switches
const VOLUME_DIFFERENCE_THRESHOLD = 1.2; // 20% volume difference required for speaker switch
const BUFFER_SIZE = 10;             // Size of rolling buffer for volume averaging
const ANALYSIS_INTERVAL = 50;       // 50ms for volume analysis

interface SpeakerSegment {
  speaker: 'mic' | 'desktop';
  startTime: number;
  endTime?: number;
}

export class Capturer {
  private recording_stream?: MediaStream
  private audio_context?: AudioContext
  private analyser?: AnalyserNode
  private speech_detection_interval?: number
  
  // New state tracking variables
  private currentSpeaker: 'mic' | 'desktop' = 'mic'
  private lastSpeakerSwitch: number = 0
  private micVolumeBuffer: number[] = []
  private desktopVolumeBuffer: number[] = []
  private isTransmitting: boolean = false
  private pendingMicSwitch: boolean = false
  private pendingMicSwitchTimeout?: NodeJS.Timeout
  private pendingDesktopSwitch: boolean = false
  private pendingDesktopSwitchTimeout?: NodeJS.Timeout
  
  // Add speaker segment tracking
  private currentSegments: SpeakerSegment[] = []

  private addToRollingBuffer(buffer: number[], value: number): number {
    buffer.push(value)
    if (buffer.length > BUFFER_SIZE) {
      buffer.shift()
    }
    return buffer.reduce((a, b) => a + b, 0) / buffer.length
  }

  private detectSpeechFromBothSources(desktopAnalyser: AnalyserNode) {
    if (!this.analyser) {
      console.log('No analyser node available')
      return
    }

    const micData = new Uint8Array(this.analyser.frequencyBinCount)
    const desktopData = new Uint8Array(desktopAnalyser.frequencyBinCount)

    this.analyser.getByteFrequencyData(micData)
    desktopAnalyser.getByteFrequencyData(desktopData)

    const micVolume = Math.sqrt(micData.reduce((a, b) => a + b * b, 0) / micData.length)
    const desktopVolume = Math.sqrt(desktopData.reduce((a, b) => a + b * b, 0) / desktopData.length)

    const avgMicVolume = this.addToRollingBuffer(this.micVolumeBuffer, micVolume)
    const avgDesktopVolume = this.addToRollingBuffer(this.desktopVolumeBuffer, desktopVolume)

    const now = Date.now()

    const micActive = this.currentSpeaker === 'mic' 
      ? avgMicVolume > VOLUME_THRESHOLD_OFF 
      : avgMicVolume > VOLUME_THRESHOLD_ON

    const desktopActive = this.currentSpeaker === 'desktop'
      ? avgDesktopVolume > VOLUME_THRESHOLD_OFF
      : avgDesktopVolume > VOLUME_THRESHOLD_ON

    if (now - this.lastSpeakerSwitch < TRANSMISSION_HOLDOFF) {
      return
    }

    // Handle speaker changes with segment tracking
    if (micActive && (!desktopActive || avgMicVolume > avgDesktopVolume * VOLUME_DIFFERENCE_THRESHOLD)) {
      if (this.currentSpeaker !== 'mic') {
        if (this.pendingDesktopSwitchTimeout) {
          clearTimeout(this.pendingDesktopSwitchTimeout)
          this.pendingDesktopSwitch = false
        }
        
        // Close current segment
        if (this.currentSegments.length > 0) {
          const currentSegment = this.currentSegments[this.currentSegments.length - 1]
          currentSegment.endTime = now
        }
        
        this.lastSpeakerSwitch = now
        if (!this.pendingMicSwitch) {
          this.pendingMicSwitch = true
          if (this.pendingMicSwitchTimeout) {
            clearTimeout(this.pendingMicSwitchTimeout)
          }
          this.pendingMicSwitchTimeout = setTimeout(() => {
            this.currentSpeaker = 'mic'
            this.pendingMicSwitch = false
            
            // Start new segment
            this.currentSegments.push({
              speaker: 'mic',
              startTime: Date.now()
            })
          }, 5000)
        }
      }
    } else if (desktopActive && avgDesktopVolume > avgMicVolume * VOLUME_DIFFERENCE_THRESHOLD) {
      if (this.currentSpeaker !== 'desktop') {
        if (this.pendingMicSwitchTimeout) {
          clearTimeout(this.pendingMicSwitchTimeout)
          this.pendingMicSwitch = false
        }
        
        // Close current segment
        if (this.currentSegments.length > 0) {
          const currentSegment = this.currentSegments[this.currentSegments.length - 1]
          currentSegment.endTime = now
        }
        
        this.lastSpeakerSwitch = now
        if (!this.pendingDesktopSwitch) {
          this.pendingDesktopSwitch = true
          if (this.pendingDesktopSwitchTimeout) {
            clearTimeout(this.pendingDesktopSwitchTimeout)
          }
          this.pendingDesktopSwitchTimeout = setTimeout(() => {
            this.currentSpeaker = 'desktop'
            this.pendingDesktopSwitch = false
            
            // Start new segment
            this.currentSegments.push({
              speaker: 'desktop',
              startTime: Date.now()
            })
          }, 5000)
        }
      }
    }

    // Update audio state
    if (window.audioAPI) {
      window.audioAPI.updateAudioState({
        volume: this.currentSpeaker === 'mic' ? avgMicVolume : avgDesktopVolume,
        isSpeaking: this.isTransmitting,
        isFromMic: this.currentSpeaker === 'mic',
        segments: this.currentSegments  // Add segments to state update
      })
    }
  }

  private async mic(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    }).then((stream) => {
      return stream;
    });
  }

  private async audio(): Promise<MediaStream> {
    return navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 320,
        height: 240,
        frameRate: 30
      }
    })
  }

  mergeAudioStreams(
    audio_context: AudioContext,
    desktopStream: MediaStream,
    voiceStream: MediaStream
  ): MediaStreamTrack[] {
    console.log('Setting up audio processing chain')
    this.audio_context = audio_context

    // Create sources
    const source1 = this.audio_context.createMediaStreamSource(desktopStream)
    const source2 = this.audio_context.createMediaStreamSource(voiceStream)

    // Create analysers with larger FFT size for better frequency resolution
    const desktopAnalyser = this.audio_context.createAnalyser()
    this.analyser = this.audio_context.createAnalyser()
    desktopAnalyser.fftSize = 2048
    this.analyser.fftSize = 2048
    
    // Increase smoothing for more stable readings
    desktopAnalyser.smoothingTimeConstant = 0.8
    this.analyser.smoothingTimeConstant = 0.8

    source1.connect(desktopAnalyser)
    source2.connect(this.analyser)

    // Start speech detection with optimized interval
    if (this.speech_detection_interval) {
      clearInterval(this.speech_detection_interval)
    }
    this.speech_detection_interval = window.setInterval(() => {
      this.detectSpeechFromBothSources(desktopAnalyser)
    }, ANALYSIS_INTERVAL)

    const destination = this.audio_context.createMediaStreamDestination()
    const gain = this.audio_context.createGain()
    gain.channelCountMode = 'explicit'
    gain.channelCount = 2

    // Connect microphone with adjusted gain
    const micGain = this.audio_context.createGain()
    micGain.gain.value = 1.5
    source2.connect(micGain)
    micGain.connect(gain)

    // Connect desktop audio
    source1.connect(gain)
    gain.connect(destination)

    return destination.stream.getAudioTracks()
  }

  async stop(): Promise<void> {
    console.log('Stopping audio capture');
    if (this.speech_detection_interval) {
      clearInterval(this.speech_detection_interval);
      this.speech_detection_interval = undefined;
    }
    
    if (this.recording_stream) {
      this.recording_stream.getTracks().forEach((track) => track.stop())
      this.recording_stream = undefined
    }
    
    if (this.audio_context && this.audio_context.state !== 'closed') {
      try {
        await this.audio_context.close()
      } catch (error) {
        console.warn('Error closing AudioContext:', error)
      }
      this.audio_context = undefined
      this.analyser = undefined
    }
    
    // Reset audio state through window.audioAPI
    if (window.audioAPI) {
      window.audioAPI.updateAudioState({
        volume: 0,
        isSpeaking: false
      });
    }
    
    // Clear volume buffers
    this.micVolumeBuffer = []
    this.desktopVolumeBuffer = []
    this.isTransmitting = false
    
    console.log('Audio capture stopped')
  }

  startRecording = async (cb: (buffer: number[]) => void): Promise<void> => {
    if (this.recording_stream) {
      return
    }

    this.audio_context = new AudioContext({ sampleRate: 44100 })
    this.recording_stream = new MediaStream(
      this.mergeAudioStreams(this.audio_context, await this.audio(), await this.mic())
    )
    const audioSource = this.audio_context.createMediaStreamSource(this.recording_stream)

    await this.audio_context.audioWorklet.addModule(new URL('wave-loopback.js', import.meta.url))
    const waveLoopbackNode = new AudioWorkletNode(this.audio_context, 'wave-loopback')
    waveLoopbackNode.port.onmessage = (event): void => {
      const inputFrame = event.data
      // console.log(inputFrame)
      cb(inputFrame)
    }

    audioSource.connect(waveLoopbackNode)
    waveLoopbackNode.connect(this.audio_context.destination)

    console.log('Recording started')
  }
}

export class AudioStreamSource {
  private capturer: Capturer
  private recording_stream?: MediaStream
  private audio_context?: AudioContext

  constructor() {
    this.capturer = new Capturer()
  }

  async getMediaStream(): Promise<MediaStream> {
    try {
      console.log('Starting media stream setup');
      
      // Create audio context first
      this.audio_context = new AudioContext({ sampleRate: 44100 });
      console.log('Audio context created');

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      console.log('Microphone stream acquired');

      // Get system audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: {
          width: 320,
          height: 240,
          frameRate: 30
        }
      });
      console.log('Display stream acquired');

      // Merge streams
      const tracks = this.capturer.mergeAudioStreams(this.audio_context, displayStream, micStream);
      this.recording_stream = new MediaStream(tracks);
      console.log('Streams merged successfully');
      
      return this.recording_stream;
    } catch (error) {
      console.error('Error in getMediaStream:', error);
      throw error;
    }
  }

  stop() {
    console.log('Stopping audio capture');
    if (this.recording_stream) {
      this.recording_stream.getTracks().forEach(track => track.stop());
      this.recording_stream = undefined;
    }
    this.capturer.stop();
    console.log('Audio capture stopped');
  }
}

export function audio_stream(): Observable<number[]> {
    const capturer = new Capturer()
    return new Observable<number[]>((subscriber) => {
      capturer.startRecording((buffer) => {
        subscriber.next(buffer)
      })
  
      return (): void => {
        capturer.stop()
        subscriber.complete()
      }}
    )    
}