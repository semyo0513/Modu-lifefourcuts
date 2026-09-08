/**
 * ==========================================================================
 * 모두의 네컷 사진 (Everyone's Four Cuts) - Google Apps Script 백엔드 (Code.gs)
 * ==========================================================================
 * 
 * [주요 기능]
 * 1. 프레임 관리: 업로드된 PNG를 구글 드라이브에 저장하고 Base64 DataURL로 안전하게 전송(CORS 완벽 해결)
 * 2. 구글 시트 기록: 관리자 설정, 프레임 등록/삭제 내역, 이메일 발송 로그를 스프레드시트에 자동 기록
 * 3. 이메일 발송: GmailApp을 통해 촬영된 고화질 사진을 첨부하여 사용자에게 즉시 발송
 * 
 * [배포 설정 방법]
 * 1. https://script.google.com 에 이 코드를 붙여넣기
 * 2. 상단 [배포] -> [배포 관리] -> [수정(연필 아이콘)] -> [새 버전]으로 배포
 *    - 실행: [나 (내 계정)]
 *    - 액세스 권한: [모든 사용자 (Anyone)]
 */

// 관리자 기본 비밀번호
var ADMIN_PIN = "1234";

// 구글 드라이브 폴더 및 스프레드시트 이름
var FOLDER_NAME = "Everyone_FourCut_Frames";
var SPREADSHEET_NAME = "모두의_네컷사진_관리자_기록시트";

/**
 * GET 요청 처리
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || "getFrames";
  var result = {};

  try {
    if (action === "ping") {
      result = { status: "ok", message: "모두의 네컷 사진 GAS 서버가 정상 작동 중입니다." };
    } else if (action === "getFrames") {
      result = { status: "ok", frames: getStoredFramesWithBase64() };
    } else if (action === "getFrameBase64") {
      var fileId = params.fileId;
      if (fileId) {
        var file = DriveApp.getFileById(fileId);
        var b64 = Utilities.base64Encode(file.getBlob().getBytes());
        result = { status: "ok", dataUrl: "data:image/png;base64," + b64 };
      } else {
        result = { status: "error", message: "fileId가 필요합니다." };
      }
    } else if (action === "getAdminInfo") {
      result = { status: "ok", spreadsheetUrl: getOrCreateSpreadsheet().getUrl() };
    } else {
      result = { status: "error", message: "알 수 없는 GET action입니다." };
    }
  } catch (err) {
    result = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST 요청 처리
 */
function doPost(e) {
  var result = {};

  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter || {};
    }

    var action = data.action;

    if (action === "uploadFrame") {
      result = handleUploadFrame(data);
    } else if (action === "sendEmail") {
      result = handleSendEmail(data);
    } else if (action === "deleteFrame") {
      result = handleDeleteFrame(data);
    } else if (action === "saveSettingsLog") {
      result = handleSaveSettingsLog(data);
    } else {
      result = { status: "error", message: "유효하지 않은 POST action입니다." };
    }
  } catch (err) {
    result = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. 프레임 PNG 업로드 및 구글 시트 자동 기록
 */
function handleUploadFrame(data) {
  if (data.adminPin && data.adminPin !== getAdminPin()) {
    return { status: "error", message: "관리자 비밀번호가 일치하지 않습니다." };
  }

  if (!data.name || !data.imageBase64 || !data.slots) {
    return { status: "error", message: "필수 데이터가 누락되었습니다." };
  }

  var folder = getOrCreateFolder(FOLDER_NAME);
  var base64Data = data.imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
  var decoded = Utilities.base64Decode(base64Data);
  var now = new Date();
  var filename = "frame_" + now.getTime() + "_" + data.name.replace(/[^a-zA-Z0-9가-힣_]/g, "") + ".png";
  var blob = Utilities.newBlob(decoded, "image/png", filename);

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var directImageUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w2000";
  var dataUrl = "data:image/png;base64," + base64Data;
  var frameId = "custom_" + fileId;

  var newFrame = {
    id: frameId,
    fileId: fileId,
    name: data.name,
    description: data.description || "사용자 등록 프레임",
    file: directImageUrl,
    canvas: data.canvas || { width: 600, height: 1800 },
    aspectRatio: data.aspectRatio || "1:3",
    slotCount: data.slotCount || 4,
    themeColor: data.themeColor || "#ff5e8e",
    slots: typeof data.slots === "string" ? JSON.parse(data.slots) : data.slots,
    createdAt: now.toISOString(),
    isCustom: true
  };

  var frames = getStoredFramesMetadata();
  frames.push(newFrame);
  saveStoredFramesMetadata(frames);

  // 📝 구글 스프레드시트 기록
  logFrameToSheet(newFrame, "등록 완료");

  // 클라이언트에 반환할 때는 캔버스 합성이 즉시 가능하도록 dataUrl을 첨부하여 전달
  var returnedFrame = Object.assign({}, newFrame);
  returnedFrame.file = dataUrl;

  return { status: "ok", message: "프레임이 구글 드라이브와 시트에 성공적으로 저장되었습니다.", frame: returnedFrame };
}

/**
 * 2. 이메일 발송 및 시트 기록
 */
function handleSendEmail(data) {
  var toEmail = data.toEmail;
  var imageBase64 = data.imageBase64;
  var userName = data.userName || "고객";

  if (!toEmail || !imageBase64) {
    return { status: "error", message: "수신자 이메일 주소 또는 이미지 데이터가 없습니다." };
  }

  var base64Data = imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
  var decoded = Utilities.base64Decode(base64Data);
  var filename = "모두의네컷사진_" + Utilities.formatDate(new Date(), "GMT+9", "yyyyMMdd_HHmmss") + ".jpg";
  var photoBlob = Utilities.newBlob(decoded, "image/jpeg", filename);

  var subject = "📸 [모두의 네컷 사진] 촬영하신 네컷 사진이 도착했습니다!";
  var htmlBody = 
    "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;'>" +
      "<h2 style='color: #ff5e8e; text-align: center; margin-bottom: 20px;'>✨ 모두의 네컷 사진 ✨</h2>" +
      "<p style='font-size: 16px; line-height: 1.6;'>안녕하세요, <b>" + userName + "</b>님!</p>" +
      "<p style='font-size: 15px; color: #555; line-height: 1.6;'>오늘 '모두의 네컷 사진'에서 촬영하신 소중한 순간을 담은 네컷 사진을 보내드립니다.</p>" +
      "<div style='margin: 24px 0; text-align: center;'>" +
        "<p style='font-size: 13px; color: #888;'>첨부파일로 고화질 사진 원본이 첨부되어 있습니다.</p>" +
      "</div>" +
      "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;' />" +
      "<p style='font-size: 12px; color: #999; text-align: center;'>모두의 네컷 사진 포토부스 웹앱</p>" +
    "</div>";

  MailApp.sendEmail({
    to: toEmail,
    subject: subject,
    htmlBody: htmlBody,
    attachments: [photoBlob]
  });

  // 📝 구글 스프레드시트 기록
  logEmailToSheet(toEmail, userName, "성공");

  return { status: "ok", message: "이메일이 성공적으로 발송되었습니다." };
}

/**
 * 3. 프레임 삭제 및 시트 상태 업데이트
 */
function handleDeleteFrame(data) {
  if (data.adminPin && data.adminPin !== getAdminPin()) {
    return { status: "error", message: "관리자 비밀번호가 일치하지 않습니다." };
  }

  var frameId = data.frameId;
  var frames = getStoredFramesMetadata();
  var target = null;
  var newFrames = frames.filter(function(f) {
    if (f.id === frameId) {
      target = f;
      return false;
    }
    return true;
  });

  if (target && target.fileId) {
    try {
      DriveApp.getFileById(target.fileId).setTrashed(true);
    } catch (e) {
      Logger.log("Could not trash file: " + e.toString());
    }
  }

  saveStoredFramesMetadata(newFrames);

  if (target) {
    logFrameToSheet(target, "삭제됨");
  }

  return { status: "ok", message: "프레임이 성공적으로 삭제되었습니다." };
}

/**
 * 4. 관리자 설정 변경 로그 시트 기록
 */
function handleSaveSettingsLog(data) {
  if (data.adminPin && data.adminPin !== getAdminPin()) {
    return { status: "error", message: "관리자 비밀번호가 일치하지 않습니다." };
  }

  if (data.newPin) {
    setAdminPin(data.newPin);
  }

  logSettingsToSheet(data.settingName || "환경설정 수정", data.settingDetails || "설정 저장");
  return { status: "ok", message: "설정 변경 내역이 시트에 기록되었습니다." };
}

/* ==========================================================================
   구글 스프레드시트 생성 및 자동 로깅 함수들
   ========================================================================== */

function getOrCreateSpreadsheet() {
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  var ss;
  if (files.hasNext()) {
    var file = files.next();
    ss = SpreadsheetApp.open(file);
  } else {
    var folder = getOrCreateFolder(FOLDER_NAME);
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    var driveFile = DriveApp.getFileById(ss.getId());
    folder.addFile(driveFile);
    DriveApp.getRootFolder().removeFile(driveFile);
  }

  initSheetHeaders(ss);
  return ss;
}

function initSheetHeaders(ss) {
  // 시트 1: 프레임 등록 목록
  var sheetFrames = ss.getSheetByName("프레임_등록_목록");
  if (!sheetFrames) {
    sheetFrames = ss.insertSheet("프레임_등록_목록");
    sheetFrames.appendRow(["일시", "프레임 ID", "프레임 이름", "설명", "규격", "슬롯수", "구글드라이브 파일 ID", "이미지 URL", "상태"]);
    sheetFrames.getRange(1, 1, 1, 9).setBackground("#ff5e8e").setFontColor("#ffffff").setFontWeight("bold");
    sheetFrames.setFrozenRows(1);
  }

  // 시트 2: 이메일 발송 로그
  var sheetEmail = ss.getSheetByName("이메일_발송_로그");
  if (!sheetEmail) {
    sheetEmail = ss.insertSheet("이메일_발송_로그");
    sheetEmail.appendRow(["발송일시", "수신 이메일", "수신자명", "발송 상태", "비고"]);
    sheetEmail.getRange(1, 1, 1, 5).setBackground("#8b5cf6").setFontColor("#ffffff").setFontWeight("bold");
    sheetEmail.setFrozenRows(1);
  }

  // 시트 3: 관리자 설정 로그
  var sheetSettings = ss.getSheetByName("관리자_설정_로그");
  if (!sheetSettings) {
    sheetSettings = ss.insertSheet("관리자_설정_로그");
    sheetSettings.appendRow(["변경일시", "변경 항목", "상세 내용", "처리 결과"]);
    sheetSettings.getRange(1, 1, 1, 4).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
    sheetSettings.setFrozenRows(1);
  }

  // 기본 빈 Sheet1 삭제
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("시트1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

function logFrameToSheet(frame, status) {
  try {
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName("프레임_등록_목록");
    var dateStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      dateStr,
      frame.id,
      frame.name,
      frame.description,
      frame.aspectRatio,
      frame.slotCount,
      frame.fileId,
      frame.file,
      status
    ]);
  } catch (err) {
    Logger.log("logFrameToSheet error: " + err.toString());
  }
}

function logEmailToSheet(toEmail, userName, status) {
  try {
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName("이메일_발송_로그");
    var dateStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      dateStr,
      toEmail,
      userName,
      status,
      "모두의 네컷 사진 발송 완료"
    ]);
  } catch (err) {
    Logger.log("logEmailToSheet error: " + err.toString());
  }
}

function logSettingsToSheet(settingName, settingDetails) {
  try {
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName("관리자_설정_로그");
    var dateStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      dateStr,
      settingName,
      settingDetails,
      "성공"
    ]);
  } catch (err) {
    Logger.log("logSettingsToSheet error: " + err.toString());
  }
}

/* ==========================================================================
   유틸리티 함수들
   ========================================================================== */

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var newFolder = DriveApp.createFolder(folderName);
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return newFolder;
  }
}

/**
 * 프레임 목록을 구글 드라이브 파일에서 읽어 Base64 Data URL을 붙여 반환 (Canvas CORS 완벽 해결)
 */
function getStoredFramesWithBase64() {
  var metadataList = getStoredFramesMetadata();
  return metadataList.map(function(f) {
    var clone = Object.assign({}, f);
    if (f.fileId) {
      try {
        var driveFile = DriveApp.getFileById(f.fileId);
        if (driveFile && !driveFile.isTrashed()) {
          var b64 = Utilities.base64Encode(driveFile.getBlob().getBytes());
          clone.file = "data:image/png;base64," + b64;
        }
      } catch (err) {
        Logger.log("Could not load base64 for fileId " + f.fileId + ": " + err);
      }
    }
    return clone;
  });
}

function getStoredFramesMetadata() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("CUSTOM_FRAMES");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveStoredFramesMetadata(frames) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("CUSTOM_FRAMES", JSON.stringify(frames));
}

function getAdminPin() {
  var pin = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");
  return pin || ADMIN_PIN;
}

function setAdminPin(newPin) {
  PropertiesService.getScriptProperties().setProperty("ADMIN_PIN", newPin);
}
