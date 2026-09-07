/**
 * ==========================================================================
 * 모두의 네컷 사진 (Everyone's Four Cuts) - Google Apps Script 백엔드 (Code.gs)
 * ==========================================================================
 * 
 * [주요 기능]
 * 1. 프레임 관리: 관리자가 업로드한 PNG 프레임을 구글 드라이브에 저장하고 공개 URL 발급
 * 2. 프레임 목록 조회: 앱 시작 시 구글 드라이브에 저장된 사용자 정의 프레임 목록 반환
 * 3. 이메일 발송: MailApp/GmailApp을 통해 완성된 네컷 사진을 첨부하여 사용자 이메일로 발송
 * 
 * [배포 설정 방법]
 * 1. https://script.google.com 에서 '새 프로젝트' 생성
 * 2. 이 Code.gs 파일의 전체 내용을 붙여넣기
 * 3. 상단 [배포] -> [새 배포] 클릭
 * 4. 유형: [웹 앱] 선택
 *    - 설명: 모두의 네컷 사진 API
 *    - 다음 사용자로 실행: [나 (내 계정)]
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)] -> 필수!
 * 5. [배포] 클릭 후 발급된 '웹 앱 URL' (https://script.google.com/macros/s/.../exec) 복사
 * 6. 모두의 네컷 사진 웹앱의 [설정 ⚙️] 메뉴에 웹 앱 URL 입력 후 저장!
 */

// 관리자 기본 비밀번호 (필요시 변경 가능)
var ADMIN_PIN = "1234";

// 구글 드라이브 내 프레임 저장 폴더명
var FOLDER_NAME = "Everyone_FourCut_Frames";

/**
 * GET 요청 처리 (프레임 목록 조회 및 상태 확인)
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || "getFrames";

  var result = {};

  try {
    if (action === "ping") {
      result = { status: "ok", message: "모두의 네컷 사진 GAS 서버가 정상 작동 중입니다." };
    } else if (action === "getFrames") {
      result = { status: "ok", frames: getStoredFrames() };
    } else {
      result = { status: "error", message: "알 수 없는 action입니다." };
    }
  } catch (err) {
    result = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST 요청 처리 (프레임 업로드, 이메일 발송, 프레임 삭제)
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
 * 1. 프레임 PNG 업로드 및 메타데이터 등록
 */
function handleUploadFrame(data) {
  // 관리자 비밀번호 확인
  if (data.adminPin && data.adminPin !== ADMIN_PIN) {
    return { status: "error", message: "관리자 비밀번호가 일치하지 않습니다." };
  }

  if (!data.name || !data.imageBase64 || !data.slots) {
    return { status: "error", message: "필수 데이터(이름, 이미지, 슬롯 정보)가 누락되었습니다." };
  }

  // 1. 구글 드라이브 폴더 가져오기 또는 생성
  var folder = getOrCreateFolder(FOLDER_NAME);

  // 2. Base64 이미지 디코딩 및 파일 생성
  var base64Data = data.imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
  var decoded = Utilities.base64Decode(base64Data);
  var filename = "frame_" + new Date().getTime() + "_" + data.name.replace(/[^a-zA-Z0-9가-힣_]/g, "") + ".png";
  var blob = Utilities.newBlob(decoded, "image/png", filename);

  var file = folder.createFile(blob);
  // 전체 공개 설정 (웹앱에서 이미지 로딩 가능하도록 설정)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  // 웹에서 직접 로드 가능한 Google Drive 다이렉트 이미지 URL 생성
  var directImageUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w2000";

  // 3. 메타데이터 생성 및 ScriptProperties에 저장
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
    createdAt: new Date().toISOString(),
    isCustom: true
  };

  var frames = getStoredFrames();
  frames.push(newFrame);
  saveStoredFrames(frames);

  return { status: "ok", message: "프레임이 구글 드라이브에 성공적으로 저장되었습니다.", frame: newFrame };
}

/**
 * 2. 이메일 발송 (MailApp 활용)
 */
function handleSendEmail(data) {
  var toEmail = data.toEmail;
  var imageBase64 = data.imageBase64;
  var userName = data.userName || "고객";

  if (!toEmail || !imageBase64) {
    return { status: "error", message: "수신자 이메일 주소 또는 이미지 데이터가 없습니다." };
  }

  // Base64 이미지를 Blob으로 변환
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

  return { status: "ok", message: "이메일이 성공적으로 발송되었습니다." };
}

/**
 * 3. 프레임 삭제
 */
function handleDeleteFrame(data) {
  if (data.adminPin && data.adminPin !== ADMIN_PIN) {
    return { status: "error", message: "관리자 비밀번호가 일치하지 않습니다." };
  }

  var frameId = data.frameId;
  if (!frameId) {
    return { status: "error", message: "삭제할 frameId가 누락되었습니다." };
  }

  var frames = getStoredFrames();
  var target = null;
  var newFrames = frames.filter(function(f) {
    if (f.id === frameId) {
      target = f;
      return false;
    }
    return true;
  });

  // 구글 드라이브 파일 휴지통 이동
  if (target && target.fileId) {
    try {
      DriveApp.getFileById(target.fileId).setTrashed(true);
    } catch (e) {
      Logger.log("Could not trash file: " + e.toString());
    }
  }

  saveStoredFrames(newFrames);
  return { status: "ok", message: "프레임이 성공적으로 삭제되었습니다." };
}

/**
 * 유틸리티: 구글 드라이브 폴더 검색 또는 생성
 */
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
 * 유틸리티: ScriptProperties에서 프레임 목록 읽기
 */
function getStoredFrames() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("CUSTOM_FRAMES");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * 유틸리티: ScriptProperties에 프레임 목록 저장
 */
function saveStoredFrames(frames) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("CUSTOM_FRAMES", JSON.stringify(frames));
}
