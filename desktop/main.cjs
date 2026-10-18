// Application de bureau (Windows / macOS / Linux) : une fenêtre qui affiche l'appli Kakeibo.
// Les fichiers de l'appli sont embarqués (dossier « web »), les données passent par Supabase comme sur le web.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'Kakeibo',
    backgroundColor: '#f6f3ec',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Les liens externes (tuto, Supabase…) s'ouvrent dans le navigateur.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, 'web', 'index.html'));
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
