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
async function handleOllamaRequest(event, conversationHistory, systemPrompt) {
  try {
    const history = JSON.parse(conversationHistory);
    const messages = history.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));
    const model = history[0]?.model || "mistral";
    try {
      const modelCheckResponse = await fetch("http://localhost:11434/api/tags", {
        method: "GET"
      });
      if (!modelCheckResponse.ok) {
        throw new Error("Failed to check available models");
      }
      const models = await modelCheckResponse.json();
      const modelExists = models.models.some((m) => m.name === model);
      if (!modelExists) {
        event.sender.send("ollama:error", `Model "${model}" is not installed. Please install it using 'ollama pull ${model}' in your terminal.`);
        return null;
      }
    } catch (error) {
      event.sender.send("ollama:error", `Failed to validate model: ${error.message}`);
      return null;
    }
    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: true
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      event.sender.send("ollama:error", `Failed to generate response: ${errorText}`);
      return null;
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
          if (data.message?.content) {
            event.sender.send("ollama:chunk", data.message.content);
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
    event.sender.send("ollama:error", `Error: ${error.message}`);
    throw error;
  }
}
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
      webSecurity: false
      // Allow local file access and cross-origin requests
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
  electron.ipcMain.handle("ollama:generate", handleOllamaRequest);
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
