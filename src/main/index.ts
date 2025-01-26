import { app, shell, BrowserWindow, ipcMain, session, desktopCapturer } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { promises as fs } from 'fs'

ipcMain.handle('writeFile', (_event, path, data): Promise<void> => {
  console.log('writing file to ' + path)
  return fs.writeFile(path, data)
})

// Audio capture IPC handlers
ipcMain.handle('start-audio-capture', async (event) => {
  const webContents = event.sender;
  const result = await webContents.executeJavaScript('window.startAudioCapture()');
  return result;
});

ipcMain.handle('stop-audio-capture', async (event) => {
  const webContents = event.sender;
  await webContents.executeJavaScript('window.stopAudioCapture()');
});

async function handleOllamaRequest(event, prompt: string, systemPrompt: string) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        prompt: prompt,
        system: systemPrompt,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            event.sender.send('ollama:chunk', data.response);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e);
        }
      }
    }

    event.sender.send('ollama:done');
    return null;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    throw error;
  }
}

async function handleDirectOllamaQuery(_event: Electron.IpcMainInvokeEvent, prompt: string) {
  console.log('Received direct Ollama query:', prompt);
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        prompt: prompt,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    let fullResponse = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream complete. Full response:', fullResponse);
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            fullResponse += json.response;
            // Send each chunk to the renderer process
            _event.sender.send('ollama:stream', json.response);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e);
        }
      }
    }

    // Send a final event to indicate completion
    _event.sender.send('ollama:complete', fullResponse);
    return fullResponse;
  } catch (error) {
    console.error('Error in direct Ollama query:', error);
    throw error;
  }
}

// Register IPC handlers early
console.log('Registering IPC handlers...');
ipcMain.handle('ollama:generate', handleOllamaRequest);
ipcMain.handle('ollama:direct-query', handleDirectOllamaQuery);
console.log('IPC handlers registered');

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux'
      ? {
          icon: join(__dirname, '../../build/icon.png')
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,  // Allow local file access and cross-origin requests
      contextIsolation: true,
      nodeIntegration: true
    }
  })

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
      // Grant access to the first screen found.
      callback({ video: sources[0], audio: 'loopback' })
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      callback({ requestHeaders: { Origin: '*', ...details.requestHeaders } });
    },
  );
 
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        'Access-Control-Allow-Origin': ['*'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Opener-Policy': ['same-origin'],
        ...details.responseHeaders,
      },
    });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
