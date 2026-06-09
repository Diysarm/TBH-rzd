import { app, BrowserWindow } from "electron";
import { join } from "node:path";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 420,
    minHeight: 480,
    show: false,
    backgroundColor: "#0f1117",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL as string);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
