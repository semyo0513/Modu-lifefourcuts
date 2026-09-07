/**
 * camera.js - 카메라 스트림, 카운트다운 및 6컷 순차 캡처 관리 모듈
 */

import { sound } from './sound.js';

export class CameraManager {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stream = null;
    this.facingMode = 'user'; // 'user' (전면/웹캠) or 'environment' (후면)
    this.isMirrored = true;
    this.capturedShots = []; // Array of DataURL strings
    this.totalShots = 6;
    this.countdownSeconds = 3;
    this.isShooting = false;
    this.abortShooting = false;
  }

  // 카메라 시작
  async startCamera(facingMode = 'user') {
    this.facingMode = facingMode;
    this.stopCamera();

    const constraints = {
      audio: false,
      video: {
        facingMode: this.facingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      return { success: true };
    } catch (err) {
      console.warn('getUserMedia error with high resolution, trying fallback constraints:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.video.srcObject = this.stream;
        await this.video.play();
        return { success: true };
      } catch (fallbackErr) {
        console.error('Camera access completely failed:', fallbackErr);
        return { success: false, error: fallbackErr };
      }
    }
  }

  // 카메라 정지
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // 전/후면 카메라 전환
  async toggleCameraFacing() {
    const nextMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.isMirrored = (nextMode === 'user');
    return await this.startCamera(nextMode);
  }

  // 좌우 반전(미러링) 토글
  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  // 단일 프레임 캡처
  captureCurrentFrame() {
    const video = this.video;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;

    this.canvas.width = w;
    this.canvas.height = h;

    this.ctx.save();
    if (this.isMirrored) {
      this.ctx.translate(w, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(video, 0, 0, w, h);
    this.ctx.restore();

    return this.canvas.toDataURL('image/jpeg', 0.95);
  }

  // 6컷 순차 자동 촬영 시퀀스
  async startSequentialShooting(callbacks = {}) {
    const {
      onCountdown = () => {},
      onFlash = () => {},
      onShotCaptured = () => {},
      onSequenceComplete = () => {}
    } = callbacks;

    if (this.isShooting) return;
    this.isShooting = true;
    this.abortShooting = false;
    this.capturedShots = [];

    for (let shotIndex = 0; shotIndex < this.totalShots; shotIndex++) {
      if (this.abortShooting) break;

      // 3, 2, 1 카운트다운
      for (let sec = this.countdownSeconds; sec > 0; sec--) {
        if (this.abortShooting) break;
        sound.playBeep(sec === 1);
        onCountdown(shotIndex + 1, this.totalShots, sec);
        await new Promise(r => setTimeout(r, 1000));
      }

      if (this.abortShooting) break;

      // 플래시 & 셔터음
      sound.playShutter();
      onFlash();

      // 프레임 캡처 및 저장
      const shotDataUrl = this.captureCurrentFrame();
      this.capturedShots.push(shotDataUrl);
      onShotCaptured(shotIndex + 1, shotDataUrl, [...this.capturedShots]);

      // 다음 컷으로 넘어가기 전 잠시 대기 (포즈 바꿀 여유 1.5초)
      if (shotIndex < this.totalShots - 1) {
        onCountdown(shotIndex + 2, this.totalShots, 'ready');
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    this.isShooting = false;
    if (!this.abortShooting) {
      onSequenceComplete([...this.capturedShots]);
    }
  }

  // 촬영 중단
  cancelShooting() {
    this.abortShooting = true;
    this.isShooting = false;
  }

  // 파일 업로드로 6컷 채우기 (카메라 불가 시 폴백)
  async loadShotsFromFiles(fileList) {
    const files = Array.from(fileList).slice(0, 6);
    const readPromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.all(readPromises);
    this.capturedShots = results;
    return results;
  }
}
