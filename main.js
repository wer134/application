// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 파일 저장을 위한 쓰기 스트림 변수
let writableStream = null;

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1440, // 창 크기를 obs-window 크기보다 약간 크게 설정
    height: 900,
    webPreferences: {
      // preload.js 스크립트를 로드합니다.
      // 렌더러(index.html)가 'window.electronAPI'에 접근할 수 있게 됩니다.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // 보안을 위해 필수 (기본값)
      nodeIntegration: false  // 보안을 위해 필수 (기본값)
    }
  });
  mainWindow.setMenu(null);
  // index.html 파일을 로드합니다.
  mainWindow.loadFile('index.html');

}

// Electron 앱이 준비되면 창을 생성합니다.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 모든 창이 닫히면 앱을 종료합니다 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// --- 녹화를 위한 IPC 핸들러 ---

// 1. 'start-recording' 메시지를 받으면
ipcMain.on('start-recording', () => {
  console.log('MAIN: 녹화 시작 신호 수신');
  
  // 'Videos' 폴더에 저장 (Electron 기본 경로)
  const savePath = 'C:\\VideoRecoding';
  const fileName = `obs-recording-${Date.now()}.webm`;
  const fullPath = path.join(savePath, fileName);
  try {
    fs.mkdirSync(savePath, { recursive: true});
  } catch (err) {
    console.error('Main: 폴더 생성 실패', err);
    return
  }

  console.log(`MAIN: 파일 저장 위치: ${fullPath}`);

  // 파일을 쓸 수 있는 스트림 생성
  writableStream = fs.createWriteStream(fullPath);
});

// 2. 'video-chunk' 메시지를 받으면 (가장 중요)
// 렌더러에서 보낸 'Buffer' 데이터를 받습니다.
ipcMain.on('video-chunk', (event, chunk) => {
  if (writableStream) {
    // 받아온 비디오 데이터 조각을 파일에 즉시 씁니다.
    writableStream.write(Buffer.from(chunk));
  } else {
    console.error('MAIN: 스트림이 준비되지 않았는데 비디오 청크 수신');
  }
});

// 3. 'stop-recording' 메시지를 받으면
ipcMain.on('stop-recording', () => {
  console.log('MAIN: 녹화 중지 신호 수신');
  if (writableStream) {
    // 파일 쓰기를 종료하고 스트림을 닫습니다.
    writableStream.end();
    writableStream = null;
    console.log('MAIN: 파일 저장 완료.');
  }
});

// 4. 'exit-app' 메시지를 받으면
ipcMain.on('exit-app', () => {
  app.quit();
});

// Edit > copy 신호를 받으면
ipcMain.on('menu-copy', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.copy();
})

// Edit > Paste 신호를 받으면
ipcMain.on('menu-paste', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.paste();
})

// View > Toggle Fullscreen 신호를 받으면
ipcMain.on('menu-toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setFullScreen(!win.isFullScreen);
})

// View > Force Reload 신호를 받으면
ipcMain.on('menu-reload', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.webContents.reload();
})

// View > Toggle Developer Tools 신호를 받으면
ipcMain.on('menu-toggle-devtools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.toggleDevTools();
})