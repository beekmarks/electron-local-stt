"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
electron.ipcMain.handle("writeFile", (_event, path2, data) => {
  console.log("writing file to " + path2);
  return fs.promises.writeFile(path2, data);
});
electron.ipcMain.handle("start-audio-capture", async (event) => {
  const webContents = event.sender;
  const result = await webContents.executeJavaScript("window.startAudioCapture()");
  return result;
});
electron.ipcMain.handle("stop-audio-capture", async (event) => {
  const webContents = event.sender;
  await webContents.executeJavaScript("window.stopAudioCapture()");
});
async function handleOllamaRequest(event, prompt, systemPrompt) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-r1:7b",
        prompt,
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
      throw new Error("Failed to get response reader");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            event.sender.send("ollama:chunk", data.response);
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
        }
      }
    }
    event.sender.send("ollama:done");
    return null;
  } catch (error) {
    console.error("Error calling Ollama:", error);
    throw error;
  }
}
async function handleDirectOllamaQuery(_event, prompt, systemPrompt, model = "deepseek-r1:7b") {
  console.log("Received direct Ollama query:", prompt);
  console.log("System prompt:", systemPrompt);
  console.log("Using model:", model);
  try {
    const requestBody = {
      model,
      prompt,
      system: systemPrompt,
      stream: true
    };
    console.log("Sending request to Ollama:", requestBody);
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }
    let fullResponse = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream complete. Full response:", fullResponse);
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            fullResponse += json.response;
            _event.sender.send("ollama:stream", json.response);
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
        }
      }
    }
    _event.sender.send("ollama:complete", fullResponse);
    return fullResponse;
  } catch (error) {
    console.error("Error in direct Ollama query:", error);
    throw error;
  }
}
console.log("Registering IPC handlers...");
electron.ipcMain.handle("ollama:generate", handleOllamaRequest);
electron.ipcMain.handle("ollama:direct-query", handleDirectOllamaQuery);
console.log("IPC handlers registered");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? {
      icon: path.join(__dirname, "../../build/icon.png")
    } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      webSecurity: false,
      // Allow local file access and cross-origin requests
      contextIsolation: true,
      nodeIntegration: true
    }
  });
  electron.session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    electron.desktopCapturer.getSources({ types: ["window", "screen"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      callback({ requestHeaders: { Origin: "*", ...details.requestHeaders } });
    }
  );
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        "Access-Control-Allow-Origin": ["*"],
        "Cross-Origin-Embedder-Policy": ["require-corp"],
        "Cross-Origin-Opener-Policy": ["same-origin"],
        ...details.responseHeaders
      }
    });
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
