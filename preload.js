// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 'window.electronAPI'라는 객체를 렌더러(index.html)의 window 객체에 주입합니다.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 렌더러에서 메인 프로세스로 메시지를 보냅니다.
   * @param {string} channel - IPC 채널 이름
   * @param {*} data - 전송할 데이터 (Buffer, string, object 등)
   */
  send: (channel, data) => {
    // 보안: 허용된 채널 목록을 여기에 정의할 수 있습니다.
    const validChannels = [
      'start-recording', 
      'stop-recording', 
      'video-chunk', 
      'exit-app',
      'menu-copy',
      'menu-paste',
      'menu-toggle-fullscreen',
      'menu-reload',
      'menu-toggle-devtools'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});