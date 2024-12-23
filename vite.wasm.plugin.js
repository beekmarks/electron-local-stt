export default function wasmPlugin() {
  return {
    name: 'vite-plugin-wasm',
    load(id) {
      if (id.endsWith('.wasm')) {
        return `
          import wasmUrl from '${id}?url'
          export default async function initWasm() {
            const response = await fetch(wasmUrl)
            const wasmBinary = await response.arrayBuffer()
            return WebAssembly.instantiate(wasmBinary)
          }
        `
      }
    },
    enforce: 'pre'
  }
}
