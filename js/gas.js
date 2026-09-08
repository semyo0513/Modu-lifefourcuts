export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwaJY0ltkGCjqbwOF8SKQHyPmcSUaP8CM9zgZxx6t4cm2nXQeMVm1KzAnaYX_mJ7G_1Rw/exec';

export class GasManager {
  constructor() {
    this.storageKey = 'life4cut_gas_url';
    this.gasUrl = this.loadGasUrl();
  }

  loadGasUrl() {
    try {
      return localStorage.getItem(this.storageKey) || DEFAULT_GAS_URL;
    } catch (e) {
      return DEFAULT_GAS_URL;
    }
  }

  saveGasUrl(url) {
    this.gasUrl = (url || '').trim();
    try {
      localStorage.setItem(this.storageKey, this.gasUrl);
    } catch (e) {
      console.warn('Failed to save GAS URL:', e);
    }
  }

  isConfigured() {
    return Boolean(this.gasUrl && this.gasUrl.startsWith('https://script.google.com'));
  }

  // 1. 구글 드라이브에 저장된 사용자 정의 프레임 목록 가져오기
  async fetchCustomFrames() {
    if (!this.isConfigured()) return [];

    try {
      const url = `${this.gasUrl}${this.gasUrl.includes('?') ? '&' : '?'}action=getFrames&t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'ok' && Array.isArray(data.frames)) {
        return data.frames;
      }
    } catch (err) {
      console.warn('GAS fetchCustomFrames error:', err);
    }
    return [];
  }

  // 1-1. 특정 프레임의 Base64 Data URL 조회 (CORS 방지용 개별 조회)
  async getFrameBase64(fileId) {
    if (!this.isConfigured() || !fileId) return null;
    try {
      const url = `${this.gasUrl}${this.gasUrl.includes('?') ? '&' : '?'}action=getFrameBase64&fileId=${encodeURIComponent(fileId)}&t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'ok' && data.dataUrl) {
        return data.dataUrl;
      }
    } catch (err) {
      console.warn('GAS getFrameBase64 error:', err);
    }
    return null;
  }

  // 2. 새 프레임 PNG 업로드 (구글 드라이브에 저장)
  async uploadFrame({ name, description, imageBase64, slotPreset = 'strip_4', customSlots = null, adminPin = '1234' }) {
    if (!this.isConfigured()) {
      throw new Error('Google Apps Script 웹 앱 URL이 설정되지 않았습니다. [설정⚙️]에서 URL을 먼저 등록해 주세요.');
    }

    let canvas = { width: 600, height: 1800 };
    let slots = [
      { x: 40, y: 40, w: 520, h: 380 },
      { x: 40, y: 460, w: 520, h: 380 },
      { x: 40, y: 880, w: 520, h: 380 },
      { x: 40, y: 1300, w: 520, h: 380 }
    ];
    let aspectRatio = '1:3';
    let slotCount = 4;

    if (slotPreset === 'grid_4') {
      canvas = { width: 1200, height: 1600 };
      slots = [
        { x: 50, y: 50, w: 530, h: 680 },
        { x: 620, y: 50, w: 530, h: 680 },
        { x: 50, y: 770, w: 530, h: 680 },
        { x: 620, y: 770, w: 530, h: 680 }
      ];
      aspectRatio = '3:4';
      slotCount = 4;
    } else if (customSlots) {
      slots = customSlots;
      slotCount = customSlots.length;
    }

    const payload = {
      action: 'uploadFrame',
      name: name,
      description: description || '사용자 정의 프레임',
      imageBase64: imageBase64,
      canvas: canvas,
      slots: slots,
      slotCount: slotCount,
      aspectRatio: aspectRatio,
      adminPin: adminPin,
    };

    const res = await fetch(this.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS CORS 호환을 위해 text/plain 사용
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status !== 'ok') {
      throw new Error(result.message || '프레임 업로드 중 오류가 발생했습니다.');
    }

    return result.frame;
  }

  // 3. 이메일 발송 (GmailApp / MailApp)
  async sendEmail({ toEmail, imageBlob, userName = '고객' }) {
    if (!this.isConfigured()) {
      throw new Error('Google Apps Script 웹 앱 URL이 설정되지 않았습니다.');
    }

    // Blob -> Base64
    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    const payload = {
      action: 'sendEmail',
      toEmail: toEmail,
      userName: userName,
      imageBase64: imageBase64
    };

    const res = await fetch(this.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status !== 'ok') {
      throw new Error(result.message || '이메일 발송 중 오류가 발생했습니다.');
    }

    return result;
  }

  // 4. 프레임 삭제
  async deleteFrame(frameId, adminPin = '1234') {
    if (!this.isConfigured()) return;

    const payload = {
      action: 'deleteFrame',
      frameId: frameId,
      adminPin: adminPin
    };

    const res = await fetch(this.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status !== 'ok') {
      throw new Error(result.message || '프레임 삭제 실패');
    }
    return result;
  }

  // 5. 구글 시트 URL 및 관리자 정보 조회
  async fetchAdminInfo() {
    if (!this.isConfigured()) return null;
    try {
      const url = `${this.gasUrl}${this.gasUrl.includes('?') ? '&' : '?'}action=getAdminInfo&t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'ok') {
        return data;
      }
    } catch (err) {
      console.warn('fetchAdminInfo error:', err);
    }
    return null;
  }

  // 6. 관리자 설정 변경 로그 시트 기록
  async saveSettingsLog({ settingName, settingDetails, newPin = null, adminPin = '1234' }) {
    if (!this.isConfigured()) return;
    try {
      const payload = {
        action: 'saveSettingsLog',
        settingName: settingName,
        settingDetails: settingDetails,
        newPin: newPin,
        adminPin: adminPin
      };
      await fetch(this.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('saveSettingsLog error:', err);
    }
  }
}

export const gasManager = new GasManager();
