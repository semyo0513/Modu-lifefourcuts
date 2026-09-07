/**
 * email.js - EmailJS 클라이언트 기반 이메일 전송 모듈
 * 서버 없이 GitHub Pages 환경에서 포토 스트립 이미지를 이메일로 전송합니다.
 */

export class EmailManager {
  constructor() {
    this.storageKey = 'life4cut_emailjs_config';
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load emailjs config from localStorage:', e);
    }
    return {
      serviceId: '',
      templateId: '',
      publicKey: '',
    };
  }

  saveConfig(serviceId, templateId, publicKey) {
    this.config = {
      serviceId: serviceId.trim(),
      templateId: templateId.trim(),
      publicKey: publicKey.trim(),
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save emailjs config to localStorage:', e);
    }
  }

  isConfigured() {
    return Boolean(this.config.serviceId && this.config.templateId && this.config.publicKey);
  }

  // Blob -> Base64 Data URL 변환 (JPEG 압축)
  async blobToBase64Jpeg(blob, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // 이메일 전송 실행
  async sendEmail({ toEmail, imageBlob, userName = '고객님' }) {
    if (!this.isConfigured()) {
      throw new Error('EmailJS 설정(Service ID, Template ID, Public Key)이 필요합니다.');
    }

    if (!window.emailjs) {
      throw new Error('EmailJS SDK가 로드되지 않았습니다.');
    }

    // 용량 최적화를 위해 JPEG base64로 변환
    const base64Image = await this.blobToBase64Jpeg(imageBlob, 0.82);

    window.emailjs.init(this.config.publicKey);

    const templateParams = {
      to_email: toEmail,
      to_name: userName,
      photo_attachment: base64Image,
      send_date: new Date().toLocaleString('ko-KR'),
      message: '모두의 네컷 사진에서 촬영하신 특별한 추억을 보내드립니다!'
    };

    const response = await window.emailjs.send(
      this.config.serviceId,
      this.config.templateId,
      templateParams
    );

    return response;
  }
}

export const emailSender = new EmailManager();
