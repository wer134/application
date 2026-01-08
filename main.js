const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let writableStream = null;
let savePath = 'C:\\VideoRecoding';

// 업데이트 서버 URL (GitHub Releases 또는 자체 서버)
const UPDATE_SERVER_URL = 'https://raw.githubusercontent.com/wer134/application/main/updates/latest.json';

/**
 * 메인 브라우저 창을 생성합니다.
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
/**
 * 녹화 시작 IPC 핸들러
 * 렌더러에서 녹화 시작 신호를 받으면 파일 스트림을 생성합니다.
 */
ipcMain.on('start-recording', () => {
  console.log('MAIN: 녹화 시작 신호 수신');
  
  const fileName = `obs-recording-${Date.now()}.webm`;
  const fullPath = path.join(savePath, fileName);

  try {
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }
  } catch (err) {
    console.error('Main: 폴더 생성 실패', err);
    return;
  }

  console.log(`MAIN: 파일 저장 위치: ${fullPath}`);
  writableStream = fs.createWriteStream(fullPath);
});

/**
 * 비디오 청크 수신 IPC 핸들러
 * 렌더러에서 전송된 비디오 데이터 청크를 파일에 기록합니다.
 * @param {Object} event - IPC 이벤트 객체
 * @param {Uint8Array} chunk - 비디오 데이터 청크
 */
ipcMain.on('video-chunk', (event, chunk) => {
  if (writableStream) {
    writableStream.write(Buffer.from(chunk));
  }
});

/**
 * 녹화 중지 IPC 핸들러
 * 녹화 종료 신호를 받으면 파일 스트림을 닫습니다.
 */
ipcMain.on('stop-recording', () => {
  console.log('MAIN: 녹화 중지 신호 수신');
  if (writableStream) {
    writableStream.end();
    writableStream = null;
    console.log('MAIN: 파일 저장 완료.');
  }
});

/**
 * 앱 종료 IPC 핸들러
 */
ipcMain.on('exit-app', () => {
  app.quit();
});

/**
 * 메뉴 > Edit > Copy IPC 핸들러
 */
ipcMain.on('menu-copy', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.copy();
});

/**
 * 메뉴 > Edit > Paste IPC 핸들러
 */
ipcMain.on('menu-paste', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.paste();
});

/**
 * 메뉴 > View > Toggle Fullscreen IPC 핸들러
 */
ipcMain.on('menu-toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setFullScreen(!win.isFullScreen());
  }
});

/**
 * 메뉴 > View > Force Reload IPC 핸들러
 */
ipcMain.on('menu-reload', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.reload();
});

/**
 * 메뉴 > View > Toggle Developer Tools IPC 핸들러
 */
ipcMain.on('menu-toggle-devtools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.toggleDevTools();
});

/**
 * 저장 위치 선택 다이얼로그 IPC 핸들러
 * 사용자가 폴더를 선택하면 저장 경로를 업데이트합니다.
 * @param {Object} event - IPC 이벤트 객체
 * @returns {Promise<string|null>} 선택된 경로 또는 null
 */
ipcMain.handle('select-save-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: '녹화 파일 저장 위치 선택'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    savePath = result.filePaths[0];
    console.log(`MAIN: 저장 경로 변경: ${savePath}`);
    return savePath;
  }
  return null;
});

/**
 * 현재 저장 경로 조회 IPC 핸들러
 * @returns {string} 현재 저장 경로
 */
ipcMain.handle('get-save-path', () => {
  return savePath;
});

/**
 * 녹화 파일 목록 조회 IPC 핸들러
 * @returns {Promise<string[]>} 녹화 파일 목록
 */
ipcMain.handle('show-recordings', async () => {
  try {
    if (!fs.existsSync(savePath)) {
      return [];
    }
    const files = fs.readdirSync(savePath);
    return files.filter(file => file.endsWith('.webm')).sort().reverse();
  } catch (err) {
    console.error('녹화 파일 목록 조회 실패:', err);
    return [];
  }
});

// ============================================
// 자동 업데이트 기능
// ============================================

/**
 * 버전 문자열을 비교합니다.
 * @param {string} version1 - 비교할 버전 1
 * @param {string} version2 - 비교할 버전 2
 * @returns {number} version1 > version2면 1, 같으면 0, 작으면 -1
 */
function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  const maxLength = Math.max(v1parts.length, v2parts.length);

  for (let i = 0; i < maxLength; i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  return 0;
}

/**
 * 업데이트 서버에서 최신 버전 정보를 가져옵니다.
 * @returns {Promise<Object|null>} 업데이트 정보 또는 null
 */
async function checkForUpdates() {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(UPDATE_SERVER_URL);
      const client = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers: {
          'User-Agent': `SpotlightCam/${app.getVersion()}`
        }
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const updateInfo = JSON.parse(data);
            resolve(updateInfo);
          } catch (error) {
            console.error('업데이트 정보 파싱 실패:', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.error('업데이트 확인 요청 실패:', error);
        resolve(null);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        console.error('업데이트 확인 타임아웃');
        resolve(null);
      });

      req.end();
    } catch (error) {
      console.error('업데이트 확인 오류:', error);
      resolve(null);
    }
  });
}

/**
 * 업데이트가 필요한지 확인하고 결과를 반환합니다.
 * @returns {Promise<Object|null>} 업데이트 정보 또는 null
 */
async function getUpdateInfo() {
  try {
    const updateInfo = await checkForUpdates();
    if (!updateInfo) {
      return null;
    }

    const currentVersion = app.getVersion();
    const latestVersion = updateInfo.version;

    if (compareVersions(latestVersion, currentVersion) > 0) {
      return {
        available: true,
        currentVersion: currentVersion,
        latestVersion: latestVersion,
        downloadUrl: updateInfo.downloadUrl,
        releaseNotes: updateInfo.releaseNotes || '업데이트가 사용 가능합니다.',
        releaseDate: updateInfo.releaseDate
      };
    }

    return {
      available: false,
      currentVersion: currentVersion,
      latestVersion: latestVersion
    };
  } catch (error) {
    console.error('업데이트 정보 가져오기 실패:', error);
    return null;
  }
}

/**
 * 업데이트 확인 IPC 핸들러
 * 렌더러에서 업데이트 확인을 요청하면 서버에서 최신 버전을 확인합니다.
 * @param {Object} event - IPC 이벤트 객체
 * @returns {Promise<Object|null>} 업데이트 정보
 */
ipcMain.handle('check-for-updates', async (event) => {
  console.log('업데이트 확인 요청');
  return await getUpdateInfo();
});

/**
 * 업데이트 다운로드 IPC 핸들러
 * 사용자가 업데이트를 다운로드하기로 결정하면 브라우저에서 다운로드 페이지를 엽니다.
 * @param {Object} event - IPC 이벤트 객체
 * @param {string} downloadUrl - 다운로드 URL
 */
ipcMain.on('download-update', (event, downloadUrl) => {
  console.log('업데이트 다운로드:', downloadUrl);
  shell.openExternal(downloadUrl);
});

// ============================================
// AI 학습 관련 IPC 핸들러
// ============================================

const trainingDataPath = path.join(app.getPath('userData'), 'training_data');

/**
 * 학습 데이터 저장 경로 선택 IPC 핸들러
 */
ipcMain.handle('select-training-data-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: '학습 데이터 저장 위치 선택'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return trainingDataPath;
});

/**
 * 학습 데이터 저장 경로 조회 IPC 핸들러
 */
ipcMain.handle('get-training-data-path', () => {
  return trainingDataPath;
});

/**
 * 학습 이미지 저장 IPC 핸들러
 */
ipcMain.handle('save-training-image', async (event, data) => {
  try {
    const { imageBuffer, datasetName, timestamp } = data;
    const datasetPath = path.join(trainingDataPath, datasetName || 'default');
    const imagesPath = path.join(datasetPath, 'images');
    
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
    }
    
    const fileName = `image_${timestamp || Date.now()}.jpg`;
    const filePath = path.join(imagesPath, fileName);
    
    fs.writeFileSync(filePath, Buffer.from(imageBuffer));
    
    return { success: true, path: filePath };
  } catch (error) {
    console.error('학습 이미지 저장 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 학습 이미지 목록 조회 IPC 핸들러
 */
ipcMain.handle('get-training-images', async (event, datasetName) => {
  try {
    const datasetPath = path.join(trainingDataPath, datasetName || 'default');
    const imagesPath = path.join(datasetPath, 'images');
    
    if (!fs.existsSync(imagesPath)) {
      return [];
    }
    
    const files = fs.readdirSync(imagesPath);
    return files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
  } catch (error) {
    console.error('학습 이미지 목록 조회 실패:', error);
    return [];
  }
});

/**
 * 라벨 저장 IPC 핸들러
 */
ipcMain.handle('save-label', async (event, data) => {
  try {
    const { imageName, labels, datasetName, format } = data;
    const datasetPath = path.join(trainingDataPath, datasetName || 'default');
    const labelsPath = path.join(datasetPath, 'labels');
    
    if (!fs.existsSync(labelsPath)) {
      fs.mkdirSync(labelsPath, { recursive: true });
    }
    
    const labelFileName = imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');
    const labelPath = path.join(labelsPath, labelFileName);
    
    // YOLO 형식으로 저장
    let labelContent = '';
    labels.forEach(label => {
      // YOLO 형식: class_id center_x center_y width height (정규화된 좌표)
      const classId = label.class === 'person' ? 0 : 1;
      const centerX = (label.x + label.width / 2) / label.imageWidth;
      const centerY = (label.y + label.height / 2) / label.imageHeight;
      const normWidth = label.width / label.imageWidth;
      const normHeight = label.height / label.imageHeight;
      
      labelContent += `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${normWidth.toFixed(6)} ${normHeight.toFixed(6)}\n`;
    });
    
    fs.writeFileSync(labelPath, labelContent);
    
    return { success: true, path: labelPath };
  } catch (error) {
    console.error('라벨 저장 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 라벨 불러오기 IPC 핸들러
 */
ipcMain.handle('load-label', async (event, imageName, datasetName) => {
  try {
    const datasetPath = path.join(trainingDataPath, datasetName || 'default');
    const labelsPath = path.join(datasetPath, 'labels');
    const labelFileName = imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');
    const labelPath = path.join(labelsPath, labelFileName);
    
    if (!fs.existsSync(labelPath)) {
      return { success: false, labels: [] };
    }
    
    const labelContent = fs.readFileSync(labelPath, 'utf-8');
    const lines = labelContent.trim().split('\n');
    const labels = lines.map(line => {
      const [classId, centerX, centerY, width, height] = line.split(' ').map(Number);
      return {
        classId,
        centerX,
        centerY,
        width,
        height
      };
    });
    
    return { success: true, labels };
  } catch (error) {
    console.error('라벨 불러오기 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 학습 데이터셋 경로 선택 IPC 핸들러
 */
ipcMain.handle('select-training-dataset-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: '학습 데이터셋 경로 선택'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

/**
 * 데이터셋 다운로드 경로 선택 IPC 핸들러
 */
ipcMain.handle('select-dataset-download-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: '데이터셋 다운로드 위치 선택'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return path.join(app.getPath('userData'), 'datasets');
});

/**
 * 데이터셋 다운로드 IPC 핸들러
 */
ipcMain.handle('download-dataset', async (event, config) => {
  const { datasetType, downloadPath, customUrl } = config;
  
  try {
    let downloadUrl = '';
    
    // 데이터셋 URL 매핑
    switch (datasetType) {
      case 'coco':
        // COCO 데이터셋 샘플 (실제로는 전체 데이터셋 다운로드)
        downloadUrl = 'https://github.com/ultralytics/yolov5/releases/download/v1.0/coco128.zip';
        break;
      case 'voc':
        downloadUrl = 'https://github.com/ultralytics/yolov5/releases/download/v1.0/VOC.zip';
        break;
      case 'cityscapes':
        // Cityscapes는 로그인 필요하므로 샘플 데이터셋 사용
        downloadUrl = 'https://github.com/ultralytics/yolov5/releases/download/v1.0/coco128.zip';
        break;
      case 'custom':
        downloadUrl = customUrl;
        break;
      default:
        return { success: false, error: '알 수 없는 데이터셋 타입' };
    }
    
    if (!downloadUrl) {
      return { success: false, error: '다운로드 URL이 없습니다' };
    }
    
    // 다운로드 시작 (비동기)
    downloadFile(downloadUrl, downloadPath, (progress, speed) => {
      event.sender.send('dataset-download-progress', { progress, speed });
    }).then(() => {
      event.sender.send('dataset-download-complete');
    }).catch((error) => {
      event.sender.send('dataset-download-error', { error: error.message });
    });
    
    return { success: true, message: '다운로드가 시작되었습니다' };
  } catch (error) {
    console.error('데이터셋 다운로드 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 파일 다운로드 헬퍼 함수
 */
function downloadFile(url, savePath, onProgress) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const fileName = path.basename(urlObj.pathname) || 'dataset.zip';
    const filePath = path.join(savePath, fileName);
    
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }
    
    const file = fs.createWriteStream(filePath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let startTime = Date.now();
    
    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`다운로드 실패: ${res.statusCode}`));
        return;
      }
      
      totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        file.write(chunk);
        
        const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (downloadedBytes / 1024 / 1024) / elapsed : 0;
        
        if (onProgress) {
          onProgress(progress, speed);
        }
      });
      
      res.on('end', () => {
        file.end();
        resolve(filePath);
      });
    });
    
    req.on('error', (error) => {
      file.close();
      fs.unlinkSync(filePath);
      reject(error);
    });
    
    file.on('error', (error) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(error);
    });
  });
}

/**
 * 학습 시작 IPC 핸들러 (Python 스크립트 실행)
 */
ipcMain.handle('start-training', async (event, config) => {
  try {
    const { trainingType, datasetPath, epochs, batchSize, learningRate, imageSize } = config;
    
    // 학습 스크립트 경로
    const scriptPath = path.join(__dirname, 'training', 'scripts', `train_${trainingType}.py`);
    
    // Python 스크립트가 없으면 생성
    if (!fs.existsSync(scriptPath)) {
      createTrainingScript(trainingType, scriptPath);
    }
    
    // Python 프로세스 실행 (비동기)
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python', [
      scriptPath,
      '--dataset', datasetPath,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--learning-rate', learningRate.toString(),
      '--image-size', imageSize.toString()
    ], {
      cwd: path.join(__dirname, 'training')
    });
    
    let trainingOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      trainingOutput += data.toString();
      event.sender.send('training-output', { output: data.toString() });
    });
    
    pythonProcess.stderr.on('data', (data) => {
      event.sender.send('training-error', { error: data.toString() });
    });
    
    pythonProcess.on('close', (code) => {
      event.sender.send('training-complete', { code, output: trainingOutput });
    });
    
    // 프로세스 ID 저장 (중지용)
    trainingProcesses.set(event.sender.id, pythonProcess);
    
    return { success: true, message: '학습이 시작되었습니다' };
  } catch (error) {
    console.error('학습 시작 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 학습 중지 IPC 핸들러
 */
ipcMain.handle('stop-training', async (event) => {
  try {
    const process = trainingProcesses.get(event.sender.id);
    if (process) {
      process.kill();
      trainingProcesses.delete(event.sender.id);
      return { success: true };
    }
    return { success: false, error: '실행 중인 학습 프로세스가 없습니다' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 학습 프로세스 관리
const trainingProcesses = new Map();

/**
 * 학습 스크립트 생성 함수
 */
function createTrainingScript(trainingType, scriptPath) {
  const scriptDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  
  let scriptContent = '';
  
  if (trainingType === 'yolo') {
    scriptContent = `# YOLO 모델 학습 스크립트
import argparse
import sys
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=str, required=True)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--learning-rate', type=float, default=0.001)
    parser.add_argument('--image-size', type=int, default=640)
    
    args = parser.parse_args()
    
    print(f"학습 시작: 데이터셋={args.dataset}, 에포크={args.epochs}")
    print("YOLO 모델 학습을 시작합니다...")
    print("주의: 실제 학습을 위해서는 ultralytics 패키지가 필요합니다.")
    print("설치: pip install ultralytics")
    
    # 실제 학습 코드는 여기에 추가
    # from ultralytics import YOLO
    # model = YOLO('yolov8n.pt')
    # model.train(data=args.dataset, epochs=args.epochs, ...)

if __name__ == '__main__':
    main()
`;
  } else if (trainingType === 'segmentation') {
    scriptContent = `# 배경 제거 세그멘테이션 모델 학습 스크립트
import argparse
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=str, required=True)
    parser.add_argument('--epochs', type=int, default=50)
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--learning-rate', type=float, default=0.0001)
    parser.add_argument('--image-size', type=int, default=512)
    
    args = parser.parse_args()
    
    print(f"학습 시작: 데이터셋={args.dataset}, 에포크={args.epochs}")
    print("세그멘테이션 모델 학습을 시작합니다...")
    print("주의: 실제 학습을 위해서는 torch, torchvision 패키지가 필요합니다.")

if __name__ == '__main__':
    main()
`;
  }
  
  fs.writeFileSync(scriptPath, scriptContent);
}