const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveHabits: (habitsData) => ipcRenderer.invoke('save-habits', habitsData),
  loadHabits: () => ipcRenderer.invoke('load-habits'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  maximizeApp: () => ipcRenderer.send('maximize-app'),
  closeApp: () => ipcRenderer.send('close-app'),
  toggleAlwaysOnTop: (value) => ipcRenderer.send('toggle-always-on-top', value),
  toggleMode: (isWidget) => ipcRenderer.send('toggle-mode', isWidget),
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', (event, value) => callback(value))
});
