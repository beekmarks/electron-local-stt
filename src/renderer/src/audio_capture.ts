import { Observable } from 'rxjs'

// Global variable to track if speech is detected
declare global {
  var current_speaker: boolean;
  var current_volume: number;
}
globalThis.current_speaker = false;
globalThis.current_volume = 0;

export class Capturer {
  private recording_stream?: MediaStream
  private audio_context?: AudioContext
  private analyser?: AnalyserNode
  private speech_detection_interval?: number

  private detectSpeechFromBothSources(desktopAnalyser: AnalyserNode) {
    if (!this.analyser) {
      console.log('No analyser node available');
      return;
    }
    
    const micData = new Uint8Array(this.analyser.frequencyBinCount);
    const desktopData = new Uint8Array(desktopAnalyser.frequencyBinCount);
    
    this.analyser.getByteFrequencyData(micData);
    desktopAnalyser.getByteFrequencyData(desktopData);
    
    // Calculate average volumes
    const micVolume = micData.reduce((a, b) => a + b, 0) / micData.length;
    const desktopVolume = desktopData.reduce((a, b) => a + b, 0) / desktopData.length;
    
    console.log('Audio volumes:', { micVolume, desktopVolume });
    
    // Determine which source is active
    const micActive = micVolume > 15;
    const desktopActive = desktopVolume > 15;
    
    // If microphone is active, it takes precedence
    // If neither or both are active, maintain previous state
    const isFromMic = micActive || (!desktopActive && window.audioAPI.getCurrentIsFromMic());
    
    // Update audio state with source information
    if (window.audioAPI) {
      window.audioAPI.updateAudioState({
        volume: isFromMic ? micVolume : desktopVolume,
        isSpeaking: micActive || desktopActive,
        isFromMic: isFromMic
      });
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
    console.log('Setting up audio processing chain');
    this.audio_context = audio_context;
    
    // Create sources
    const source1 = this.audio_context.createMediaStreamSource(desktopStream)
    const source2 = this.audio_context.createMediaStreamSource(voiceStream)
    
    // Create analysers for both streams
    const desktopAnalyser = this.audio_context.createAnalyser();
    this.analyser = this.audio_context.createAnalyser();
    desktopAnalyser.fftSize = 2048;
    this.analyser.fftSize = 2048;
    
    source1.connect(desktopAnalyser);
    source2.connect(this.analyser);
    console.log('Analysers connected to streams');
    
    // Start speech detection
    if (this.speech_detection_interval) {
      clearInterval(this.speech_detection_interval);
    }
    this.speech_detection_interval = window.setInterval(() => {
      this.detectSpeechFromBothSources(desktopAnalyser);
    }, 50);
    console.log('Speech detection interval started');
    
    const destination = this.audio_context.createMediaStreamDestination()
    const gain = this.audio_context.createGain()
    gain.channelCountMode = 'explicit'
    gain.channelCount = 2

    // Connect microphone with higher gain
    const micGain = this.audio_context.createGain();
    micGain.gain.value = 1.5;  // Boost microphone volume
    source2.connect(micGain);
    micGain.connect(gain);

    // Connect desktop audio
    source1.connect(gain)
    gain.connect(destination)

    return destination.stream.getAudioTracks()
  }

  private sampleRate(stream: MediaStream): number | undefined {
    return stream.getAudioTracks()[0].getSettings().sampleRate
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
    
    if (this.audio_context) {
      await this.audio_context.close()
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
    
    console.log('Audio capture stopped')
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
    }
    this.capturer.stop();
    if (this.audio_context) {
      this.audio_context.close();
      this.audio_context = undefined;
    }
    this.recording_stream = undefined;
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