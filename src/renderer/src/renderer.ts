import { audio_stream, AudioStreamSource } from './audio_capture'
import { buffer, firstValueFrom, fromEvent, map, ObservableInput } from 'rxjs'
import { renderWavFile } from './wav'

let audioSource: AudioStreamSource | null = null
let currentStream: MediaStream | null = null

async function record_wav(stop_event: ObservableInput<any>): Promise<void> {
  const data = await firstValueFrom(
    audio_stream().pipe(
      buffer(stop_event),
      map((chunks) => {
        const numFrames = chunks.reduce((acc, chunk) => acc.concat(chunk), [])
        return new Float32Array(numFrames)
      }),
      map((data) =>
        renderWavFile(data, { isFloat: true, numChannels: 1, sampleRate: 44100 })
      )
    )
  )
  console.log('Writing file')
  await window.nodeAPI.writeFile('out.wav', data)
}

async function startAudioCapture(): Promise<MediaStream> {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop())
    }
    
    audioSource = new AudioStreamSource()
    currentStream = await audioSource.getMediaStream()
    return currentStream
  } catch (error) {
    console.error('Error in startAudioCapture:', error)
    throw error
  }
}

function stopAudioCapture(): void {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
    currentStream = null
  }
  if (audioSource) {
    audioSource.stop()
    audioSource = null
  }
}

// Expose these functions globally for IPC access
declare global {
  interface Window {
    startAudioCapture: typeof startAudioCapture
    stopAudioCapture: typeof stopAudioCapture
  }
}
window.startAudioCapture = startAudioCapture
window.stopAudioCapture = stopAudioCapture

function init(): void {
  window.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start')
    const stopButton = document.getElementById('stop')
    if (!startButton || !stopButton) {
      console.error('Missing startButton or stopButton')
      return
    }

    startButton.addEventListener('click', async () => {
      try {
        const stream = await startAudioCapture()
        // The stream is now available for use in the page
        console.log('Audio capture started successfully')
      } catch (error) {
        console.error('Failed to start audio capture:', error)
      }
    })

    stopButton.addEventListener('click', () => {
      stopAudioCapture()
      console.log('Audio capture stopped')
    })
  })
}

init()
