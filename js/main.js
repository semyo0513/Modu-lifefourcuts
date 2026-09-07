/**
 * main.js - 모두의 네컷 사진 웹앱 진입점 및 전역 상태 관리
 */

import { sound } from './sound.js';
import { CameraManager } from './camera.js';
import { PhotoEditor, FILTER_PRESETS } from './editor.js';
import { FrameCompositor } from './compositor.js';
import { printer } from './print.js';
import { emailSender } from './email.js';

class App {
  constructor() {
    this.frames = [];
    this.selectedFrame = null;
    this.currentStep = 'start';

    this.camera = null;
    this.editor = new PhotoEditor();
    this.compositor = new FrameCompositor();

    this.finalComposite = null; // { canvas, dataUrl, blob }

    this.initElements();
    this.bindEvents();
  }

  async init() {
    await this.loadFrames();
    this.renderFilterPresets();
    this.goToStep('start');
  }

  initElements() {
    // Steps
    this.steps = {
      start: document.getElementById('step-start'),
      frame: document.getElementById('step-frame'),
      camera: document.getElementById('step-camera'),
      editor: document.getElementById('step-editor'),
      preview: document.getElementById('step-preview'),
    };

    // Camera elements
    this.videoEl = document.getElementById('camera-video');
    this.cameraFlashEl = document.getElementById('camera-flash');
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownText = document.getElementById('countdown-text');
    this.cameraProgressText = document.getElementById('camera-progress-text');
    this.cameraThumbnails = document.getElementById('camera-thumbnails');
    this.camera = new CameraManager(this.videoEl);

    // Frame gallery
    this.frameListEl = document.getElementById('frame-list');

    // Editor elements
    this.presetListEl = document.getElementById('preset-list');
    this.sliderBrightness = document.getElementById('slider-brightness');
    this.sliderContrast = document.getElementById('slider-contrast');
    this.sliderSaturation = document.getElementById('slider-saturation');
    this.valBrightness = document.getElementById('val-brightness');
    this.valContrast = document.getElementById('val-contrast');
    this.valSaturation = document.getElementById('val-saturation');
    this.editorThumbnails = document.getElementById('editor-thumbnails');
    this.editorSlots = document.getElementById('editor-slots');
    this.slotCountNotice = document.getElementById('slot-count-notice');

    // Preview elements
    this.previewImageEl = document.getElementById('preview-final-image');
    this.previewLoadingEl = document.getElementById('preview-loading');

    // Modals
    this.emailModal = document.getElementById('email-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.fileUploadInput = document.getElementById('file-upload-input');
  }

  bindEvents() {
    // Start -> Frame
    document.getElementById('btn-start-app')?.addEventListener('click', () => {
      sound.playClick();
      this.goToStep('frame');
    });

    // Frame -> Camera
    document.getElementById('btn-frame-next')?.addEventListener('click', () => {
      if (!this.selectedFrame) {
        alert('원하시는 프레임을 선택해 주세요!');
        return;
      }
      sound.playClick();
      this.goToStep('camera');
    });

    // Camera controls
    document.getElementById('btn-camera-flip')?.addEventListener('click', async () => {
      sound.playClick();
      await this.camera.toggleCameraFacing();
      this.updateCameraMirrorClass();
    });

    document.getElementById('btn-camera-mirror')?.addEventListener('click', () => {
      sound.playClick();
      this.camera.toggleMirror();
      this.updateCameraMirrorClass();
    });

    document.getElementById('btn-camera-upload')?.addEventListener('click', () => {
      sound.playClick();
      this.fileUploadInput.click();
    });

    this.fileUploadInput?.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const shots = await this.camera.loadShotsFromFiles(e.target.files);
        if (shots.length > 0) {
          this.camera.stopCamera();
          this.editor.init(shots, this.selectedFrame.slotCount);
          this.goToStep('editor');
        }
      }
    });

    document.getElementById('btn-start-shooting')?.addEventListener('click', () => {
      this.startCameraShootingSequence();
    });

    // Editor controls
    const updateSliders = () => {
      this.valBrightness.textContent = `${this.sliderBrightness.value}%`;
      this.valContrast.textContent = `${this.sliderContrast.value}%`;
      this.valSaturation.textContent = `${this.sliderSaturation.value}%`;

      this.editor.setAdjustment('brightness', this.sliderBrightness.value);
      this.editor.setAdjustment('contrast', this.sliderContrast.value);
      this.editor.setAdjustment('saturation', this.sliderSaturation.value);
      this.updateEditorPreviewStyles();
    };

    this.sliderBrightness?.addEventListener('input', updateSliders);
    this.sliderContrast?.addEventListener('input', updateSliders);
    this.sliderSaturation?.addEventListener('input', updateSliders);

    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      sound.playClick();
      this.editor.applyPreset('original');
      this.syncSliderUIFromEditor();
      this.renderFilterPresets();
      this.updateEditorPreviewStyles();
    });

    // Editor -> Preview (최종 합성)
    document.getElementById('btn-editor-done')?.addEventListener('click', async () => {
      const selected = this.editor.getSelectedPhotos();
      if (selected.length < this.selectedFrame.slotCount) {
        alert(`사진을 ${this.selectedFrame.slotCount}장 모두 선택해 주세요! (현재 ${selected.length}장 선택됨)`);
        return;
      }
      sound.playClick();
      await this.goToStep('preview');
    });

    // Preview actions
    document.getElementById('btn-print')?.addEventListener('click', async () => {
      if (!this.finalComposite) return;
      sound.playClick();
      await printer.handlePrint(this.finalComposite.blob, this.finalComposite.dataUrl);
    });

    document.getElementById('btn-download')?.addEventListener('click', () => {
      if (!this.finalComposite) return;
      sound.playClick();
      printer.downloadImage(this.finalComposite.dataUrl);
    });

    document.getElementById('btn-email')?.addEventListener('click', () => {
      sound.playClick();
      this.openEmailModal();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      sound.playClick();
      if (confirm('처음 화면으로 돌아가시겠습니까?')) {
        this.goToStep('start');
      }
    });

    document.getElementById('btn-retake')?.addEventListener('click', () => {
      sound.playClick();
      if (confirm('다시 촬영하시겠습니까? 현재 보정된 설정은 초기화됩니다.')) {
        this.goToStep('camera');
      }
    });

    // Header Home button
    document.getElementById('header-logo-btn')?.addEventListener('click', () => {
      sound.playClick();
      if (this.currentStep !== 'start') {
        if (confirm('진행 중인 내용이 초기화됩니다. 처음으로 가시겠습니까?')) {
          this.camera.stopCamera();
          this.goToStep('start');
        }
      }
    });

    // Settings Modal
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      sound.playClick();
      this.openSettingsModal();
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      sound.playClick();
      this.saveSettingsModal();
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        this.closeAllModals();
      });
    });

    // Email send form
    document.getElementById('form-email-send')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleEmailSubmission();
    });
  }

  // 화면 전환
  async goToStep(stepName) {
    this.currentStep = stepName;

    // 모든 스텝 숨김
    Object.values(this.steps).forEach(el => {
      if (el) el.classList.remove('active-step');
    });

    // 대상 스텝 표시
    if (this.steps[stepName]) {
      this.steps[stepName].classList.add('active-step');
    }

    // 스텝별 진입 작업
    if (stepName === 'frame') {
      this.renderFrameGallery();
    } else if (stepName === 'camera') {
      await this.setupCameraStep();
    } else if (stepName === 'editor') {
      this.camera.stopCamera();
      this.setupEditorStep();
    } else if (stepName === 'preview') {
      await this.setupPreviewStep();
    }
  }

  // 1. 프레임 로드 및 렌더링
  async loadFrames() {
    try {
      const res = await fetch('frames/frames.json');
      this.frames = await res.json();
      if (this.frames.length > 0) {
        this.selectedFrame = this.frames[0];
      }
    } catch (e) {
      console.error('Failed to load frames.json:', e);
    }
  }

  renderFrameGallery() {
    if (!this.frameListEl) return;
    this.frameListEl.innerHTML = '';

    this.frames.forEach(frame => {
      const card = document.createElement('div');
      card.className = `frame-card ${this.selectedFrame?.id === frame.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="frame-thumb-wrap">
          <img src="${frame.file}" alt="${frame.name}" class="frame-thumb-img" />
          <span class="slot-badge">${frame.slotCount}컷</span>
        </div>
        <div class="frame-card-info">
          <h4>${frame.name}</h4>
          <p>${frame.description}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        sound.playClick();
        this.selectedFrame = frame;
        document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      this.frameListEl.appendChild(card);
    });
  }

  // 2. 카메라 화면 셋업 및 촬영
  async setupCameraStep() {
    this.cameraThumbnails.innerHTML = '';
    this.cameraProgressText.textContent = '카메라 준비 완료 (총 6컷 촬영)';
    this.countdownOverlay.style.display = 'none';
    document.getElementById('btn-start-shooting').style.display = 'inline-flex';

    const result = await this.camera.startCamera('user');
    this.updateCameraMirrorClass();

    if (!result.success) {
      this.cameraProgressText.innerHTML = `
        <span style="color:#ff6b8b;">카메라 접근 권한이 필요합니다.</span><br/>
        권한을 허용하시거나 [사진 파일 업로드] 버튼을 이용해 주세요.
      `;
    }
  }

  updateCameraMirrorClass() {
    if (this.camera.isMirrored) {
      this.videoEl.classList.add('mirrored');
    } else {
      this.videoEl.classList.remove('mirrored');
    }
  }

  async startCameraShootingSequence() {
    document.getElementById('btn-start-shooting').style.display = 'none';
    this.cameraThumbnails.innerHTML = '';

    await this.camera.startSequentialShooting({
      onCountdown: (currentShot, totalShots, sec) => {
        this.countdownOverlay.style.display = 'flex';
        this.cameraProgressText.textContent = `${currentShot} / ${totalShots} 번째 컷 촬영 중...`;

        if (sec === 'ready') {
          this.countdownText.textContent = '준비!';
          this.countdownText.className = 'countdown-ready';
        } else {
          this.countdownText.textContent = sec;
          this.countdownText.className = 'countdown-number pulse';
        }
      },
      onFlash: () => {
        this.cameraFlashEl.classList.add('flash-active');
        setTimeout(() => this.cameraFlashEl.classList.remove('flash-active'), 300);
      },
      onShotCaptured: (shotNum, shotDataUrl, allShots) => {
        this.countdownOverlay.style.display = 'none';
        const thumb = document.createElement('img');
        thumb.src = shotDataUrl;
        thumb.className = 'captured-thumb animate-pop';
        this.cameraThumbnails.appendChild(thumb);
      },
      onSequenceComplete: (allShots) => {
        this.cameraProgressText.textContent = '촬영 완료! 편집 화면으로 이동합니다.';
        setTimeout(() => {
          this.editor.init(allShots, this.selectedFrame.slotCount);
          this.goToStep('editor');
        }, 800);
      }
    });
  }

  // 3. 편집기(보정 & 선택/배치) 셋업
  setupEditorStep() {
    this.slotCountNotice.textContent = `선택한 프레임 규격: ${this.selectedFrame.name} (${this.selectedFrame.slotCount}컷 필요)`;
    this.renderFilterPresets();
    this.syncSliderUIFromEditor();
    this.renderEditorThumbnailsAndSlots();
  }

  renderFilterPresets() {
    if (!this.presetListEl) return;
    this.presetListEl.innerHTML = '';

    FILTER_PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `preset-btn ${this.editor.currentPreset === preset.id ? 'active' : ''}`;
      btn.innerHTML = `<span>${preset.icon}</span> <span>${preset.name}</span>`;

      btn.addEventListener('click', () => {
        sound.playClick();
        this.editor.applyPreset(preset.id);
        this.syncSliderUIFromEditor();
        this.renderFilterPresets();
        this.updateEditorPreviewStyles();
      });

      this.presetListEl.appendChild(btn);
    });
  }

  syncSliderUIFromEditor() {
    this.sliderBrightness.value = this.editor.customAdjustments.brightness;
    this.sliderContrast.value = this.editor.customAdjustments.contrast;
    this.sliderSaturation.value = this.editor.customAdjustments.saturation;

    this.valBrightness.textContent = `${this.sliderBrightness.value}%`;
    this.valContrast.textContent = `${this.sliderContrast.value}%`;
    this.valSaturation.textContent = `${this.sliderSaturation.value}%`;
  }

  updateEditorPreviewStyles() {
    const filterStyle = this.editor.getCSSFilterString();
    document.querySelectorAll('.editor-preview-img').forEach(img => {
      img.style.filter = filterStyle;
    });
  }

  renderEditorThumbnailsAndSlots() {
    // 1. 촬영된 6장 썸네일 풀 (Selection Pool)
    this.editorThumbnails.innerHTML = '';
    this.editor.rawShots.forEach((shotSrc, idx) => {
      const slotIndex = this.editor.selectedIndices.indexOf(idx);
      const isSelected = slotIndex > -1;

      const item = document.createElement('div');
      item.className = `editor-pool-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <img src="${shotSrc}" class="editor-preview-img" alt="Shot ${idx + 1}" />
        <div class="pool-badge">${isSelected ? `#${slotIndex + 1}` : `${idx + 1}`}</div>
      `;

      item.addEventListener('click', () => {
        sound.playClick();
        this.editor.togglePhotoSelection(idx);
        this.renderEditorThumbnailsAndSlots();
        this.updateEditorPreviewStyles();
      });

      this.editorThumbnails.appendChild(item);
    });

    // 2. 프레임 슬롯 배정 및 순서 제어 UI
    this.editorSlots.innerHTML = '';
    for (let slotIdx = 0; slotIdx < this.selectedFrame.slotCount; slotIdx++) {
      const photoIdx = this.editor.selectedIndices[slotIdx];
      const hasPhoto = photoIdx !== undefined;

      const slotEl = document.createElement('div');
      slotEl.className = `editor-slot-card ${hasPhoto ? 'filled' : 'empty'}`;

      if (hasPhoto) {
        slotEl.innerHTML = `
          <div class="slot-header">슬롯 ${slotIdx + 1}</div>
          <div class="slot-img-wrap">
            <img src="${this.editor.rawShots[photoIdx]}" class="editor-preview-img" alt="Slot ${slotIdx + 1}" />
          </div>
          <div class="slot-controls">
            <button class="btn-slot-nav" data-dir="left" ${slotIdx === 0 ? 'disabled' : ''} title="앞으로 이동">◀</button>
            <button class="btn-slot-nav" data-dir="right" ${slotIdx === this.selectedFrame.slotCount - 1 ? 'disabled' : ''} title="뒤로 이동">▶</button>
          </div>
        `;

        slotEl.querySelector('[data-dir="left"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          sound.playClick();
          this.editor.swapSlots(slotIdx, slotIdx - 1);
          this.renderEditorThumbnailsAndSlots();
          this.updateEditorPreviewStyles();
        });

        slotEl.querySelector('[data-dir="right"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          sound.playClick();
          this.editor.swapSlots(slotIdx, slotIdx + 1);
          this.renderEditorThumbnailsAndSlots();
          this.updateEditorPreviewStyles();
        });
      } else {
        slotEl.innerHTML = `
          <div class="slot-header">슬롯 ${slotIdx + 1}</div>
          <div class="slot-empty-placeholder">
            <span>➕</span>
            <p>위 6장에서 사진을 선택해 주세요</p>
          </div>
        `;
      }

      this.editorSlots.appendChild(slotEl);
    }
  }

  // 4. 미리보기 및 최종 합성
  async setupPreviewStep() {
    this.previewLoadingEl.style.display = 'flex';
    this.previewImageEl.style.display = 'none';

    const selectedPhotos = this.editor.getSelectedPhotos();
    const filterString = this.editor.getCSSFilterString();

    try {
      this.finalComposite = await this.compositor.composite({
        frameMeta: this.selectedFrame,
        photos: selectedPhotos,
        filterString: filterString,
        addDateStamp: true
      });

      this.previewImageEl.src = this.finalComposite.dataUrl;
      this.previewImageEl.style.display = 'block';
    } catch (e) {
      console.error('Composite failed:', e);
      alert('이미지 합성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      this.previewLoadingEl.style.display = 'none';
    }
  }

  // 모달 제어
  openEmailModal() {
    this.closeAllModals();
    if (this.emailModal) this.emailModal.classList.add('active');
  }

  openSettingsModal() {
    this.closeAllModals();
    const config = emailSender.loadConfig();
    document.getElementById('input-service-id').value = config.serviceId || '';
    document.getElementById('input-template-id').value = config.templateId || '';
    document.getElementById('input-public-key').value = config.publicKey || '';
    if (this.settingsModal) this.settingsModal.classList.add('active');
  }

  saveSettingsModal() {
    const sId = document.getElementById('input-service-id').value;
    const tId = document.getElementById('input-template-id').value;
    const pKey = document.getElementById('input-public-key').value;
    emailSender.saveConfig(sId, tId, pKey);
    alert('EmailJS 설정이 성공적으로 저장되었습니다!');
    this.closeAllModals();
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  async handleEmailSubmission() {
    const emailInput = document.getElementById('input-to-email');
    const toEmail = emailInput.value.trim();
    const sendBtn = document.getElementById('btn-submit-email');
    const statusMsg = document.getElementById('email-status-msg');

    if (!toEmail) {
      alert('이메일 주소를 입력해 주세요.');
      return;
    }

    if (!emailSender.isConfigured()) {
      statusMsg.innerHTML = `
        <span style="color:#ff6b8b;">EmailJS 설정이 필요합니다.</span><br/>
        상단 [설정⚙️] 버튼을 눌러 Service ID / Template ID / Public Key를 입력해 주세요.
      `;
      return;
    }

    try {
      sendBtn.disabled = true;
      sendBtn.textContent = '전송 중... 🚀';
      statusMsg.textContent = '포토 스트립 이미지를 압축하여 이메일로 전송하고 있습니다...';

      await emailSender.sendEmail({
        toEmail: toEmail,
        imageBlob: this.finalComposite.blob
      });

      statusMsg.innerHTML = '<span style="color:#10b981;">🎉 성공적으로 이메일이 발송되었습니다!</span>';
      setTimeout(() => {
        this.closeAllModals();
        sendBtn.disabled = false;
        sendBtn.textContent = '이메일 보내기';
        statusMsg.textContent = '';
      }, 2000);
    } catch (err) {
      console.error('Email send error:', err);
      statusMsg.innerHTML = `<span style="color:#ff6b8b;">전송 실패: ${err.message || '오류가 발생했습니다.'}</span>`;
      sendBtn.disabled = false;
      sendBtn.textContent = '다시 시도';
    }
  }
}

// 앱 시작
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
