/**
 * editor.js - 사진 보정(개별 필터/일괄 적용/슬라이더) 및 사진 선택/순서 배치 에디터 모듈
 */

export const FILTER_PRESETS = [
  {
    id: 'original',
    name: '원본',
    icon: '✨',
    cssFilter: 'none',
    settings: { brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'bright',
    name: '화사하게',
    icon: '🌸',
    cssFilter: 'brightness(1.12) contrast(1.05) saturate(1.15)',
    settings: { brightness: 112, contrast: 105, saturation: 115, sepia: 5, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'film',
    name: '빈티지 필름',
    icon: '🎞️',
    cssFilter: 'sepia(0.25) contrast(1.12) brightness(1.04) saturate(0.9)',
    settings: { brightness: 104, contrast: 112, saturation: 90, sepia: 25, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'mono',
    name: '모던 흑백',
    icon: '🖤',
    cssFilter: 'grayscale(1) contrast(1.25) brightness(1.05)',
    settings: { brightness: 105, contrast: 125, saturation: 0, sepia: 0, grayscale: 100, hueRotate: 0 }
  },
  {
    id: 'warm',
    name: '따뜻한 웜톤',
    icon: '☕',
    cssFilter: 'sepia(0.18) hue-rotate(-10deg) brightness(1.06) saturate(1.1)',
    settings: { brightness: 106, contrast: 102, saturation: 110, sepia: 18, grayscale: 0, hueRotate: -10 }
  },
  {
    id: 'cool',
    name: '청량한 쿨톤',
    icon: '🌊',
    cssFilter: 'hue-rotate(15deg) saturate(1.2) brightness(1.08) contrast(1.05)',
    settings: { brightness: 108, contrast: 105, saturation: 120, sepia: 0, grayscale: 0, hueRotate: 15 }
  }
];

export class PhotoEditor {
  constructor() {
    this.rawShots = []; // 6 captured shots
    this.photoSettings = []; // Array of settings per photo [{ preset, brightness, contrast, saturation, sepia, grayscale, hueRotate }]
    this.selectedIndices = []; // Indices in rawShots assigned to frame slots [0, 1, 2, 3]
    this.slotCount = 4;
  }

  // 촬영된 6장 로드
  init(shots, slotCount = 4) {
    this.rawShots = [...shots];
    this.slotCount = slotCount;

    // 각 사진마다 독립된 기본 보정값 초기화
    this.photoSettings = this.rawShots.map(() => ({
      preset: 'original',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sepia: 0,
      grayscale: 0,
      hueRotate: 0,
    }));

    // 기본값: 앞에서부터 슬롯 개수만큼 자동 선택
    this.selectedIndices = [];
    for (let i = 0; i < Math.min(this.rawShots.length, this.slotCount); i++) {
      this.selectedIndices.push(i);
    }
  }

  // 특정 사진의 보정 설정 조회
  getSettings(photoIdx) {
    if (this.photoSettings[photoIdx]) {
      return this.photoSettings[photoIdx];
    }
    return {
      preset: 'original',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sepia: 0,
      grayscale: 0,
      hueRotate: 0,
    };
  }

  // 특정 사진에 프리셋 적용
  applyPresetToPhoto(photoIdx, presetId) {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (preset && this.photoSettings[photoIdx]) {
      this.photoSettings[photoIdx] = {
        preset: presetId,
        brightness: preset.settings.brightness,
        contrast: preset.settings.contrast,
        saturation: preset.settings.saturation,
        sepia: preset.settings.sepia,
        grayscale: preset.settings.grayscale,
        hueRotate: preset.settings.hueRotate,
      };
    }
  }

  // 특정 사진의 미세 조정 슬라이더 업데이트
  setAdjustmentForPhoto(photoIdx, type, value) {
    if (this.photoSettings[photoIdx] && this.photoSettings[photoIdx][type] !== undefined) {
      this.photoSettings[photoIdx][type] = Number(value);
    }
  }

  // 현재 선택된 사진의 보정 설정을 전체 사진에 일괄 복사/적용
  applyToAllPhotos(sourcePhotoIdx) {
    const src = this.getSettings(sourcePhotoIdx);
    this.photoSettings = this.photoSettings.map(() => ({ ...src }));
  }

  // 특정 사진의 CSS 필터 문자열 계산
  getFilterStringForPhoto(photoIdx) {
    const s = this.getSettings(photoIdx);
    const b = s.brightness / 100;
    const c = s.contrast / 100;
    const sat = s.saturation / 100;

    let filter = `brightness(${b}) contrast(${c}) saturate(${sat})`;
    if (s.sepia > 0) filter += ` sepia(${s.sepia / 100})`;
    if (s.grayscale > 0) filter += ` grayscale(${s.grayscale / 100})`;
    if (s.hueRotate !== 0) filter += ` hue-rotate(${s.hueRotate}deg)`;

    return filter;
  }

  // 사진 선택 토글
  togglePhotoSelection(photoIndex) {
    const existingSlotIdx = this.selectedIndices.indexOf(photoIndex);
    if (existingSlotIdx > -1) {
      this.selectedIndices.splice(existingSlotIdx, 1);
    } else {
      if (this.selectedIndices.length < this.slotCount) {
        this.selectedIndices.push(photoIndex);
      } else {
        this.selectedIndices[this.selectedIndices.length - 1] = photoIndex;
      }
    }
    return [...this.selectedIndices];
  }

  // 슬롯 내 위치 스왑
  swapSlots(indexA, indexB) {
    if (
      indexA >= 0 && indexA < this.selectedIndices.length &&
      indexB >= 0 && indexB < this.selectedIndices.length
    ) {
      const temp = this.selectedIndices[indexA];
      this.selectedIndices[indexA] = this.selectedIndices[indexB];
      this.selectedIndices[indexB] = temp;
    }
    return [...this.selectedIndices];
  }

  // 슬롯에 배치될 최종 이미지 목록과 각각의 필터 반환
  getSelectedPhotosWithFilters() {
    return this.selectedIndices.map(rawIdx => {
      return {
        photoSrc: this.rawShots[rawIdx],
        filterString: this.getFilterStringForPhoto(rawIdx),
        rawIndex: rawIdx
      };
    }).filter(item => Boolean(item.photoSrc));
  }
}
