import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    electron({
      main: {
        // vite config for electron main process
        entry: 'src/main/index.ts',
      },
      preload: {
        // vite config for electron preload process
        input: 'src/preload/index.ts',
      },
    }),
  ],
  resolve: {
    alias: {
      'microsoft-cognitiveservices-speech-sdk': resolve(__dirname, 'node_modules/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js')
    }
  }
})
