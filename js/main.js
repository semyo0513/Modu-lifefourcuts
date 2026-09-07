/**
 * main.js - 모두의 네컷 사진 웹앱 진입점 및 전역 상태 관리
 */

import { sound } from './sound.js';
import { CameraManager } from './camera.js';
import { PhotoEditor, FILTER_PRESETS } from './editor.js';
import { FrameCompositor } from './compositor.js';
import { printer } from './print.js';
import { emailSender } from './email.js';
import { gasManager } from './gas.js';

class App {
  constructor() {
    this.frames = [];
    this.selectedFrame = null;
    this.currentStep = 'start';

    this.camera = null;
    this.editor = new PhotoEditor();
    this.compositor = new FrameCompositor();

    this.finalComposite = null; // { canvas, dataUrl, blob }
    this.adminUploadedFileBase64 = null;
    this.pendingAuthAction = null; // 'admin' or 'settings'
    this.spreadsheetUrl = null;
    this.currentInspectedIndex = 0; // 대형 뷰에서 보고 있는 사진 인덱스 (0~5)

    this.initElements();
    this.bindEvents();
  }

  async init() {
    await this.loadFrames();
    this.renderFilterPresets();
    this.goToStep('start');
  }

  getAdminPin() {
    try {
      return localStorage.getItem('life4cut_admin_pin') || '1234';
    } catch (e) {
      return '1234';
    }
  }

  setAdminPin(pin) {
    if (pin && pin.trim()) {
      try {
        localStorage.setItem('life4cut_admin_pin', pin.trim());
      } catch (e) {}
    }
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

    // Large Inspector elements
    this.largePreviewImg = document.getElementById('editor-large-preview-img');
    this.inspectorIndexText = document.getElementById('inspector-index-text');
    this.inspectorSelectLabel = document.getElementById('inspector-select-label');

    // Preview elements
    this.previewImageEl = document.getElementById('preview-final-image');
    this.previewLoadingEl = document.getElementById('preview-loading');

    // Modals
    this.authModal = document.getElementById('auth-modal');
    this.emailModal = document.getElementById('email-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.adminModal = document.getElementById('admin-modal');
    this.samplesModal = document.getElementById('samples-modal');
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

    // Large Inspector Navigations
    document.getElementById('btn-inspector-prev')?.addEventListener('click', () => {
      sound.playClick();
      this.navigateInspectedPhoto(-1);
    });

    document.getElementById('btn-inspector-next')?.addEventListener('click', () => {
      sound.playClick();
      this.navigateInspectedPhoto(1);
    });

    document.getElementById('btn-inspector-toggle-select')?.addEventListener('click', () => {
      sound.playClick();
      this.editor.togglePhotoSelection(this.currentInspectedIndex);
      this.renderEditorThumbnailsAndSlots();
      this.updateInspectorView();
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

    // 🔒 비밀번호 인증 기반 관리자 / 설정 열기
    document.getElementById('btn-open-admin')?.addEventListener('click', () => {
      sound.playClick();
      this.requestPasswordAuth('admin');
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      sound.playClick();
      this.requestPasswordAuth('settings');
    });

    document.getElementById('form-auth-check')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordAuthSubmit();
    });

    // 📥 프레임 템플릿/샘플 다운로드 모달 열기
    document.getElementById('btn-open-samples')?.addEventListener('click', () => {
      sound.playClick();
      this.openSamplesModal();
    });
    document.getElementById('btn-frame-samples-link')?.addEventListener('click', () => {
      sound.playClick();
      this.openSamplesModal();
    });
    document.getElementById('btn-admin-samples-download')?.addEventListener('click', () => {
      sound.playClick();
      this.openSamplesModal();
    });

    // 구글 시트 바로가기 버튼
    document.getElementById('btn-open-google-sheet')?.addEventListener('click', async () => {
      sound.playClick();
      await this.openGoogleSheet();
    });

    // Settings save
    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
      sound.playClick();
      await this.saveSettingsModal();
    });

    // Admin frame upload handlers
    document.getElementById('admin-frame-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.adminUploadedFileBase64 = evt.target.result;
          const wrap = document.getElementById('admin-frame-preview-wrap');
          const img = document.getElementById('admin-frame-preview-img');
          if (wrap && img) {
            img.src = this.adminUploadedFileBase64;
            wrap.style.display = 'flex';
          }
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btn-admin-upload-frame')?.addEventListener('click', async () => {
      sound.playClick();
      await this.handleAdminFrameUpload();
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

  // 비밀번호 인증 게이트
  requestPasswordAuth(targetAction) {
    this.closeAllModals();
    this.pendingAuthAction = targetAction;
    document.getElementById('auth-password-input').value = '';
    document.getElementById('auth-error-msg').textContent = '';
    document.getElementById('auth-modal-title').textContent = 
      targetAction === 'admin' ? '🔒 관리자 모드 비밀번호 확인' : '⚙️ 환경 설정 비밀번호 확인';
    if (this.authModal) this.authModal.classList.add('active');
    setTimeout(() => document.getElementById('auth-password-input').focus(), 100);
  }

  handlePasswordAuthSubmit() {
    const inputPin = document.getElementById('auth-password-input').value.trim();
    const correctPin = this.getAdminPin();

    if (inputPin === correctPin) {
      const action = this.pendingAuthAction;
      this.closeAllModals();
      if (action === 'admin') {
        this.openAdminModal();
      } else if (action === 'settings') {
        this.openSettingsModal();
      }
    } else {
      document.getElementById('auth-error-msg').textContent = '⚠️ 비밀번호가 일치하지 않습니다.';
      document.getElementById('auth-password-input').select();
    }
  }

  openSamplesModal() {
    this.closeAllModals();
    if (this.samplesModal) this.samplesModal.classList.add('active');
  }

  async openGoogleSheet() {
    if (!gasManager.isConfigured()) {
      alert('Google Apps Script 웹 앱 URL이 설정되지 않았습니다.');
      return;
    }

    try {
      const info = await gasManager.fetchAdminInfo();
      if (info && info.spreadsheetUrl) {
        window.open(info.spreadsheetUrl, '_blank');
      } else {
        window.open('https://drive.google.com', '_blank');
      }
    } catch (e) {
      window.open('https://drive.google.com', '_blank');
    }
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
      await this.loadFrames();
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

  // 1. 프레임 로드
  async loadFrames() {
    let localFrames = [];
    try {
      const res = await fetch('frames/frames.json');
      localFrames = await res.json();
    } catch (e) {
      console.error('Failed to load frames.json:', e);
    }

    let customFrames = [];
    if (gasManager.isConfigured()) {
      try {
        customFrames = await gasManager.fetchCustomFrames();
      } catch (err) {
        console.warn('Failed to fetch custom frames from GAS:', err);
      }
    }

    this.frames = [...localFrames, ...customFrames];
    if (this.frames.length > 0 && !this.selectedFrame) {
      this.selectedFrame = this.frames[0];
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
          <img src="${frame.file}" alt="${frame.name}" class="frame-thumb-img" onerror="this.style.opacity=0.3" />
          <span class="slot-badge">${frame.slotCount}컷</span>
          ${frame.isCustom ? '<span style="position:absolute; bottom:8px; left:8px; background:#ff5e8e; color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px;">☁️ 드라이브</span>' : ''}
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
    this.currentInspectedIndex = 0;
    this.renderFilterPresets();
    this.syncSliderUIFromEditor();
    this.renderEditorThumbnailsAndSlots();
    this.updateInspectorView();
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

  // 대형 보정 뷰 갱신
  updateInspectorView() {
    if (!this.largePreviewImg || this.editor.rawShots.length === 0) return;

    const currentShot = this.editor.rawShots[this.currentInspectedIndex];
    if (currentShot) {
      this.largePreviewImg.src = currentShot;
      this.largePreviewImg.style.filter = this.editor.getCSSFilterString();
    }

    if (this.inspectorIndexText) {
      this.inspectorIndexText.textContent = `${this.currentInspectedIndex + 1} / ${this.editor.rawShots.length} 번째 사진`;
    }

    if (this.inspectorSelectLabel) {
      const slotIdx = this.editor.selectedIndices.indexOf(this.currentInspectedIndex);
      if (slotIdx > -1) {
        this.inspectorSelectLabel.textContent = `슬롯 #${slotIdx + 1}에 배치됨 (해제 ➖)`;
      } else {
        this.inspectorSelectLabel.textContent = '프레임 슬롯에 담기 ➕';
      }
    }
  }

  setInspectedPhoto(idx) {
    if (idx >= 0 && idx < this.editor.rawShots.length) {
      this.currentInspectedIndex = idx;
      this.updateInspectorView();
      // 대형 인스펙터로 부드럽게 스크롤
      document.getElementById('editor-inspector-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  navigateInspectedPhoto(delta) {
    const total = this.editor.rawShots.length;
    if (total === 0) return;
    this.currentInspectedIndex = (this.currentInspectedIndex + delta + total) % total;
    this.updateInspectorView();
  }

  renderEditorThumbnailsAndSlots() {
    // 1. 촬영된 6장 썸네일 풀 (Selection Pool)
    this.editorThumbnails.innerHTML = '';
    this.editor.rawShots.forEach((shotSrc, idx) => {
      const slotIndex = this.editor.selectedIndices.indexOf(idx);
      const isSelected = slotIndex > -1;
      const isInspected = this.currentInspectedIndex === idx;

      const item = document.createElement('div');
      item.className = `editor-pool-item ${isSelected ? 'selected' : ''} ${isInspected ? 'inspected' : ''}`;
      item.title = `더블클릭: 대형 확대 뷰로 보기 | 클릭: 슬롯 담기/해제`;
      item.innerHTML = `
        <img src="${shotSrc}" class="editor-preview-img" alt="Shot ${idx + 1}" />
        <div class="pool-badge">${isSelected ? `#${slotIndex + 1}` : `${idx + 1}`}</div>
      `;

      // 클릭 시 슬롯 선택 토글 + 대형 뷰 변경
      item.addEventListener('click', () => {
        sound.playClick();
        this.setInspectedPhoto(idx);
        this.editor.togglePhotoSelection(idx);
        this.renderEditorThumbnailsAndSlots();
        this.updateEditorPreviewStyles();
      });

      // 더블 클릭 시 대형 뷰 포커스
      item.addEventListener('dblclick', (e) => {
        e.preventDefault();
        sound.playClick();
        this.setInspectedPhoto(idx);
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
          <div class="slot-img-wrap" title="더블클릭: 대형 확대 뷰로 보기">
            <img src="${this.editor.rawShots[photoIdx]}" class="editor-preview-img" alt="Slot ${slotIdx + 1}" />
          </div>
          <div class="slot-controls">
            <button class="btn-slot-nav" data-dir="left" ${slotIdx === 0 ? 'disabled' : ''} title="앞으로 이동">◀</button>
            <button class="btn-slot-nav" data-dir="right" ${slotIdx === this.selectedFrame.slotCount - 1 ? 'disabled' : ''} title="뒤로 이동">▶</button>
          </div>
        `;

        slotEl.querySelector('.slot-img-wrap')?.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          sound.playClick();
          this.setInspectedPhoto(photoIdx);
        });

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
    document.getElementById('input-gas-url').value = gasManager.gasUrl || '';
    document.getElementById('input-change-admin-pin').value = '';
    const config = emailSender.loadConfig();
    document.getElementById('input-service-id').value = config.serviceId || '';
    document.getElementById('input-template-id').value = config.templateId || '';
    document.getElementById('input-public-key').value = config.publicKey || '';
    if (this.settingsModal) this.settingsModal.classList.add('active');
  }

  async saveSettingsModal() {
    const gasUrl = document.getElementById('input-gas-url').value;
    gasManager.saveGasUrl(gasUrl);

    const newPin = document.getElementById('input-change-admin-pin').value.trim();
    if (newPin) {
      this.setAdminPin(newPin);
      await gasManager.saveSettingsLog({
        settingName: '관리자 비밀번호 변경',
        settingDetails: '새 비밀번호로 변경됨',
        newPin: newPin,
        adminPin: newPin
      });
    }

    const sId = document.getElementById('input-service-id').value;
    const tId = document.getElementById('input-template-id').value;
    const pKey = document.getElementById('input-public-key').value;
    emailSender.saveConfig(sId, tId, pKey);

    alert('설정이 성공적으로 저장되었습니다!');
    this.closeAllModals();
    this.loadFrames();
  }

  // 관리자 모달
  async openAdminModal() {
    this.closeAllModals();
    if (!gasManager.isConfigured()) {
      alert('Google Apps Script 웹 앱 URL이 설정되지 않았습니다.\n먼저 [설정 ⚙️]에서 URL을 등록해 주세요.');
      this.openSettingsModal();
      return;
    }
    this.adminUploadedFileBase64 = null;
    document.getElementById('admin-frame-file').value = '';
    document.getElementById('admin-frame-preview-wrap').style.display = 'none';
    document.getElementById('admin-status-msg').textContent = '';
    if (this.adminModal) this.adminModal.classList.add('active');
    await this.renderAdminCustomFramesList();
  }

  async renderAdminCustomFramesList() {
    const listEl = document.getElementById('admin-custom-frames-list');
    if (!listEl) return;
    listEl.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted);">프레임 목록 로딩 중...</p>';

    const customFrames = await gasManager.fetchCustomFrames();
    if (customFrames.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted);">구글 드라이브에 등록된 커스텀 프레임이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = '';
    customFrames.forEach(frame => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--bg-primary); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);';
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${frame.file}" style="width:36px; height:36px; object-fit:contain; background:#000; border-radius:4px;" />
          <div>
            <div style="font-weight:600; font-size:0.85rem;">${frame.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${frame.slotCount}컷 · ${frame.aspectRatio}</div>
          </div>
        </div>
        <button class="btn-icon btn-delete-frame" style="color:#ff5e8e; padding:4px 8px; font-size:0.75rem;">삭제</button>
      `;

      item.querySelector('.btn-delete-frame')?.addEventListener('click', async () => {
        if (confirm(`'${frame.name}' 프레임을 구글 드라이브와 시트에서 삭제하시겠습니까?`)) {
          const pin = this.getAdminPin();
          await gasManager.deleteFrame(frame.id, pin);
          await this.renderAdminCustomFramesList();
          await this.loadFrames();
          this.renderFrameGallery();
        }
      });

      listEl.appendChild(item);
    });
  }

  async handleAdminFrameUpload() {
    const name = document.getElementById('admin-frame-name').value.trim();
    const desc = document.getElementById('admin-frame-desc').value.trim();
    const preset = document.getElementById('admin-frame-preset').value;
    const pin = this.getAdminPin();
    const statusMsg = document.getElementById('admin-status-msg');
    const uploadBtn = document.getElementById('btn-admin-upload-frame');

    if (!name) {
      alert('프레임 이름을 입력해 주세요.');
      return;
    }

    if (!this.adminUploadedFileBase64) {
      alert('투명 프레임 PNG 파일을 선택해 주세요.');
      return;
    }

    try {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span>구글 드라이브 및 시트 저장 중... ☁️</span>';
      statusMsg.textContent = '구글 드라이브에 PNG 이미지를 저장하고 시트에 기록하고 있습니다...';

      await gasManager.uploadFrame({
        name: name,
        description: desc,
        imageBase64: this.adminUploadedFileBase64,
        slotPreset: preset,
        adminPin: pin
      });

      statusMsg.innerHTML = '<span style="color:#10b981;">🎉 프레임이 구글 드라이브와 시트에 성공적으로 등록되었습니다!</span>';
      document.getElementById('admin-frame-name').value = '';
      document.getElementById('admin-frame-desc').value = '';
      document.getElementById('admin-frame-file').value = '';
      document.getElementById('admin-frame-preview-wrap').style.display = 'none';
      this.adminUploadedFileBase64 = null;

      await this.renderAdminCustomFramesList();
      await this.loadFrames();
      this.renderFrameGallery();
    } catch (err) {
      console.error('Frame upload error:', err);
      statusMsg.innerHTML = `<span style="color:#ff6b8b;">업로드 실패: ${err.message || '오류 발생'}</span>`;
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span>구글 드라이브 및 시트에 저장</span> <span>☁️</span>';
    }
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

    const useGas = gasManager.isConfigured();
    const useEmailJs = emailSender.isConfigured();

    if (!useGas && !useEmailJs) {
      statusMsg.innerHTML = `
        <span style="color:#ff6b8b;">이메일 발송 설정이 필요합니다.</span><br/>
        상단 [설정⚙️] 버튼을 눌러 <b>Google Apps Script 웹 앱 URL</b>을 입력해 주세요.
      `;
      return;
    }

    try {
      sendBtn.disabled = true;
      sendBtn.textContent = '전송 중... 🚀';
      statusMsg.textContent = '포토 스트립 이미지를 이메일로 전송하고 있습니다...';

      if (useGas) {
        // 1. 구글 앱스스크립트(Gmail)로 발송 (구글 시트에 로그 자동 기록)
        await gasManager.sendEmail({
          toEmail: toEmail,
          imageBlob: this.finalComposite.blob
        });
      } else {
        // 2. EmailJS 백업 발송
        await emailSender.sendEmail({
          toEmail: toEmail,
          imageBlob: this.finalComposite.blob
        });
      }

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
