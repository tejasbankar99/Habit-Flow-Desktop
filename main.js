const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const DATA_FILE = path.join(app.getPath('userData'), 'habits-data.json');
const CONFIG_FILE = path.join(app.getPath('userData'), 'widget-config.json');

// Default configurations
let widgetConfig = {
  isWidgetMode: true,
  widgetPos: { x: null, y: null },
  dashboardPos: { x: null, y: null },
  alwaysOnTop: true
};

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      widgetConfig = { ...widgetConfig, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (err) {
    console.error('Failed to load widget config', err);
  }
}

// Save configuration
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(widgetConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save widget config', err);
  }
}

function createWindow() {
  loadConfig();

  const width = widgetConfig.isWidgetMode ? 360 : 1280;
  const height = widgetConfig.isWidgetMode ? 520 : 820;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: widgetConfig.isWidgetMode && widgetConfig.alwaysOnTop,
    skipTaskbar: false, // keep it in taskbar for easy access
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load URL
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Restore position
  const savedPos = widgetConfig.isWidgetMode ? widgetConfig.widgetPos : widgetConfig.dashboardPos;
  if (savedPos && savedPos.x !== null && savedPos.y !== null) {
    // Verify position is on screen
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(d => {
      return savedPos.x >= d.bounds.x &&
             savedPos.x < d.bounds.x + d.bounds.width &&
             savedPos.y >= d.bounds.y &&
             savedPos.y < d.bounds.y + d.bounds.height;
    });
    if (isVisible) {
      mainWindow.setPosition(savedPos.x, savedPos.y);
    }
  } else {
    // Center by default if no saved pos
    mainWindow.center();
  }

  // Save window position on move
  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    if (widgetConfig.isWidgetMode) {
      widgetConfig.widgetPos = { x, y };
    } else {
      widgetConfig.dashboardPos = { x, y };
    }
    saveConfig();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });

  // Prevent white flash on launch
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => widgetConfig);

ipcMain.handle('save-habits', (event, habitsData) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(habitsData, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Failed to save habits', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-habits', () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load habits', err);
  }
  return null; // Return null if file doesn't exist or is invalid, frontend will create default data
});

ipcMain.on('minimize-app', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-app', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('close-app', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('toggle-always-on-top', (event, value) => {
  widgetConfig.alwaysOnTop = value;
  saveConfig();
  if (mainWindow && widgetConfig.isWidgetMode) {
    mainWindow.setAlwaysOnTop(value);
  }
});

ipcMain.on('toggle-mode', (event, isWidget) => {
  if (!mainWindow) return;
  
  if (isWidget && mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }

  widgetConfig.isWidgetMode = isWidget;
  saveConfig();

  const [currentX, currentY] = mainWindow.getPosition();
  
  // Store position before resizing
  if (isWidget) {
    widgetConfig.dashboardPos = { x: currentX, y: currentY };
  } else {
    widgetConfig.widgetPos = { x: currentX, y: currentY };
  }
  saveConfig();

  // Determine target size
  const targetWidth = isWidget ? 360 : 1280;
  const targetHeight = isWidget ? 520 : 820;

  // Set sizing and frame styles
  mainWindow.setResizable(true);
  mainWindow.setSize(targetWidth, targetHeight);
  
  // Always on top only in widget mode if enabled
  mainWindow.setAlwaysOnTop(isWidget && widgetConfig.alwaysOnTop);

  // Restore or center target position
  const targetPos = isWidget ? widgetConfig.widgetPos : widgetConfig.dashboardPos;
  if (targetPos && targetPos.x !== null && targetPos.y !== null) {
    mainWindow.setPosition(targetPos.x, targetPos.y);
  } else {
    mainWindow.center();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
