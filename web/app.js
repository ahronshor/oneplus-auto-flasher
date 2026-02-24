const UPDATE_GUIDE_URL = "./update-guide.html";
const SUPPORT_WHATSAPP_URL = "";
const ROM_BOOT_API_URL = "https://admin-prod.koshersvr.com/api/rom_boot_link";
const DEVICE_HISTORY_KEY = "android_web_flasher_device_history_v1";
const PREFLIGHT_KEY = "android_web_flasher_preflight_v1";
const UPDATE_ZIP_SCAN_INTERVAL_MS = 4000;
const TRACKED_STEP_KEYS = [
  "adbDetected",
  "updatePushed",
  "updateInstalled",
  "bootloaderUnlocked",
  "flashed"
];

const USB_FILTERS = [
  { classCode: 0xff, subclassCode: 0x42, protocolCode: 0x01 },
  { classCode: 0xff, subclassCode: 0x42, protocolCode: 0x03 },
  { vendorId: 0x2a70 },
  { vendorId: 0x22d9 },
  { vendorId: 0x18d1 }
];

const MODULE_CANDIDATES = {
  adb: [
    "https://esm.sh/@yume-chan/adb@2.1.0?bundle",
    "https://esm.sh/@yume-chan/adb@2.1.0"
  ],
  adbWebUsb: [
    "https://esm.sh/@yume-chan/adb-daemon-webusb@2.1.0?bundle",
    "https://esm.sh/@yume-chan/adb-daemon-webusb@2.1.0"
  ],
  adbCredential: [
    "https://esm.sh/@yume-chan/adb-credential-web@2.1.0?bundle",
    "https://esm.sh/@yume-chan/adb-credential-web@2.1.0"
  ],
  fastboot: [
    "https://esm.sh/android-fastboot@1.1.3?bundle",
    "https://esm.sh/android-fastboot@1.1.3"
  ]
};

const els = {
  btnCheckUsb: document.getElementById("btn-check-usb"),
  btnPreflightReset: document.getElementById("btn-preflight-reset"),
  btnAutoContinue: document.getElementById("btn-auto-continue"),
  btnConnectAdb: document.getElementById("btn-connect-adb"),
  btnRebootBootloader: document.getElementById("btn-reboot-bootloader"),
  btnRebootBootloaderFastboot: document.getElementById("btn-reboot-bootloader-fastboot"),
  btnDownloadUpdate: document.getElementById("btn-download-update"),
  btnOpenUpdateGuide: document.getElementById("btn-open-update-guide"),
  btnRecheckUpdate: document.getElementById("btn-recheck-update"),
  btnPickDownloads: document.getElementById("btn-pick-downloads"),
  btnFindUpdateZip: document.getElementById("btn-find-update-zip"),
  btnPushUpdateZip: document.getElementById("btn-push-update-zip"),
  btnMarkUpdateInstalled: document.getElementById("btn-mark-update-installed"),
  btnConnectFastboot: document.getElementById("btn-connect-fastboot"),
  btnRebootDeviceFastboot: document.getElementById("btn-reboot-device-fastboot"),
  btnUnlock: document.getElementById("btn-unlock"),
  btnFlashAuto: document.getElementById("btn-flash-auto"),
  btnFlash: document.getElementById("btn-flash"),
  btnRebootDevice: document.getElementById("btn-reboot-device"),
  btnClearLog: document.getElementById("btn-clear-log"),
  flashFile: document.getElementById("flash-file"),
  usbStatus: document.getElementById("usb-status"),
  preflightStatus: document.getElementById("preflight-status"),
  adbStatus: document.getElementById("adb-status"),
  downloadsStatus: document.getElementById("downloads-status"),
  pushStatus: document.getElementById("push-status"),
  fastbootStatus: document.getElementById("fastboot-status"),
  flashStatus: document.getElementById("flash-status"),
  model: document.getElementById("device-model"),
  product: document.getElementById("device-product"),
  version: document.getElementById("device-version"),
  serial: document.getElementById("device-serial"),
  action: document.getElementById("recommended-action"),
  updateLink: document.getElementById("update-link"),
  supportLink: document.getElementById("support-link"),
  stageTitle: document.getElementById("stage-title"),
  stageDescription: document.getElementById("stage-description"),
  autoContinueStatus: document.getElementById("auto-continue-status"),
  panelPreflight: document.getElementById("panel-preflight"),
  panelConnectGrid: document.getElementById("panel-connect-grid"),
  panelDeviceDetails: document.getElementById("panel-device-details"),
  panelAction: document.getElementById("action-panel"),
  panelUpdate: document.getElementById("panel-update"),
  panelProgress: document.getElementById("panel-progress"),
  panelFastbootFlashGrid: document.getElementById("panel-fastboot-flash-grid"),
  panelFastboot: document.getElementById("panel-fastboot"),
  panelFlash: document.getElementById("panel-flash"),
  panelInstructions: document.getElementById("panel-instructions"),
  progressWrap: document.getElementById("flash-progress-wrap"),
  progressBar: document.getElementById("flash-progress-bar"),
  pushProgressWrap: document.getElementById("push-progress-wrap"),
  pushProgressBar: document.getElementById("push-progress-bar"),
  progressSerial: document.getElementById("progress-serial"),
  stepAdb: document.getElementById("step-adb"),
  stepUpdatePushed: document.getElementById("step-update-pushed"),
  stepUpdateInstalled: document.getElementById("step-update-installed"),
  stepBootloaderUnlocked: document.getElementById("step-bootloader-unlocked"),
  stepFlashed: document.getElementById("step-flashed"),
  preDevMode: document.getElementById("pre-dev-mode"),
  preDevOptions: document.getElementById("pre-dev-options"),
  preUsbDebug: document.getElementById("pre-usb-debug"),
  preOemUnlock: document.getElementById("pre-oem-unlock"),
  preRsa: document.getElementById("pre-rsa"),
  logOutput: document.getElementById("log-output")
};

const state = {
  adb: null,
  adbTransport: null,
  adbUsbDevice: null,
  fastboot: null,
  fastbootInfo: null,
  deviceInfo: null,
  deviceMap: new Map(),
  actionRecommendation: null,
  downloadsDirHandle: null,
  selectedUpdateZipHandle: null,
  selectedUpdateZipName: "",
  activeSerial: "",
  deviceHistory: {},
  preflight: {
    devMode: false,
    devOptions: false,
    usbDebug: false,
    oemUnlock: false,
    rsa: false
  },
  deviceSupport: {
    supported: null,
    model: "",
    reason: ""
  },
  uiStage: "connect",
  lastUsbMode: "unknown",
  recommendationRequestId: 0,
  autoContinueRunning: false,
  autoZipScanTimer: null,
  autoZipScanBusy: false,
  adbStackPromise: null,
  fastbootCtorPromise: null
};

function normalizePreflightState(value = {}) {
  return {
    devMode: Boolean(value.devMode),
    devOptions: Boolean(value.devOptions),
    usbDebug: Boolean(value.usbDebug),
    oemUnlock: Boolean(value.oemUnlock),
    rsa: Boolean(value.rsa)
  };
}

function loadPreflightState() {
  try {
    const raw = localStorage.getItem(PREFLIGHT_KEY);
    if (!raw) {
      state.preflight = normalizePreflightState();
      return;
    }
    state.preflight = normalizePreflightState(JSON.parse(raw));
  } catch (error) {
    state.preflight = normalizePreflightState();
    appendLog(`טעינת צ'קליסט הכנה נכשלה: ${error.message}`, "WARN");
  }
}

function persistPreflightState() {
  try {
    localStorage.setItem(PREFLIGHT_KEY, JSON.stringify(state.preflight));
  } catch (error) {
    appendLog(`שמירת צ'קליסט הכנה נכשלה: ${error.message}`, "WARN");
  }
}

function getPreflightCompletion() {
  const values = Object.values(state.preflight);
  const done = values.filter(Boolean).length;
  return {
    done,
    total: values.length,
    complete: done === values.length
  };
}

function renderPreflightChecklist() {
  els.preDevMode.checked = state.preflight.devMode;
  els.preDevOptions.checked = state.preflight.devOptions;
  els.preUsbDebug.checked = state.preflight.usbDebug;
  els.preOemUnlock.checked = state.preflight.oemUnlock;
  els.preRsa.checked = state.preflight.rsa;

  const completion = getPreflightCompletion();
  const text = completion.complete
    ? "צ'קליסט הכנה הושלם: 5/5. אפשר להתחבר ב-ADB."
    : `צ'קליסט הכנה: ${completion.done}/${completion.total} הושלם.`;
  updateStatus(els.preflightStatus, text, false);
}

function setPreflightValue(key, checked) {
  state.preflight[key] = Boolean(checked);
  persistPreflightState();
  renderPreflightChecklist();
}

function resetPreflightChecklist() {
  state.preflight = normalizePreflightState();
  persistPreflightState();
  renderPreflightChecklist();
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateAutoContinueStatus(message, isError = false) {
  updateStatus(els.autoContinueStatus, message, isError);
}

function getAutoContinueLabel(stage) {
  if (stage === "connect") {
    if (state.lastUsbMode === "fastboot") {
      return "התחבר אוטומטית ל-Fastboot";
    }
    return state.adb ? "המשך לשלב הבא" : "התחבר אוטומטית ב-ADB";
  }

  if (stage === "update") {
    return "פתח הורדה והוראות עדכון";
  }

  if (stage === "fastboot") {
    if (state.fastboot && state.fastbootInfo?.unlocked === "no") {
      return "פתח Bootloader";
    }
    if (state.adb && !state.fastboot) {
      return "העבר ל-Fastboot והתחבר";
    }
    return "חיבור Fastboot";
  }

  if (stage === "flash") {
    if (!state.fastboot) {
      if (state.adb) {
        return "מעבר ל-Fastboot וצריבה אוטומטית";
      }
      return "חיבור Fastboot ואז צריבה";
    }
    if (state.fastbootInfo?.unlocked !== "yes") {
      return "פתח Bootloader לפני צריבה";
    }
    return getRecommendedFlashEntry() ? "צרוב אוטומטית מהמאגר" : "צרוב עכשיו";
  }

  if (stage === "done") {
    return "התהליך הושלם";
  }

  if (stage === "unsupported") {
    return "לא ניתן להמשיך";
  }

  return "המשך אוטומטי";
}

async function runAutoContinue() {
  const stage = computeUiStage();

  if (stage === "unsupported") {
    updateAutoContinueStatus(state.deviceSupport.reason || "הגרסה/המכשיר לא נתמכים כרגע ולכן אי אפשר להמשיך אוטומטית.", true);
    return;
  }

  if (stage === "done") {
    updateAutoContinueStatus("התהליך כבר הושלם עבור המכשיר הזה.");
    return;
  }

  if (stage === "connect") {
    if (state.lastUsbMode === "fastboot") {
      await handleConnectFastboot();
      if (state.fastboot) {
        updateAutoContinueStatus("בוצע ניסיון חיבור Fastboot אוטומטי.");
      } else {
        updateAutoContinueStatus("זוהה Fastboot, אבל החיבור נכשל. נסו שוב בלחיצה על חיבור Fastboot.", true);
      }
      return;
    }

    if (!state.adb) {
      await handleConnectAdb();
      updateAutoContinueStatus("בוצע ניסיון חיבור ADB אוטומטי.");
      return;
    }
    updateAutoContinueStatus("ADB כבר מחובר. ממשיך לשלב הבא.");
    refreshButtons();
    return;
  }

  if (stage === "update") {
    if (els.btnDownloadUpdate?.href && els.btnDownloadUpdate.href !== "#") {
      window.open(els.btnDownloadUpdate.href, "_blank", "noopener,noreferrer");
    }
    if (els.btnOpenUpdateGuide?.href) {
      window.open(els.btnOpenUpdateGuide.href, "_blank", "noopener,noreferrer");
    }
    updateAutoContinueStatus("נפתחו קישור הורדה והוראות. לאחר עדכון ידני במכשיר לחצו 'בדוק שוב גרסה ב-ADB'.");
    return;
  }

  if (stage === "fastboot") {
    if (!state.fastboot) {
      if (state.adb) {
        await handleRebootToBootloader();
        updateAutoContinueStatus("נשלחה פקודת מעבר ל-Fastboot. מנסה להתחבר...");
        await sleep(1800);
      }
      await handleConnectFastboot();
      if (!state.fastboot) {
        updateAutoContinueStatus("לא הצלחנו להתחבר ל-Fastboot אוטומטית. אפשר לנסות שוב בלחיצה.", true);
        return;
      }
    }

    if (state.fastbootInfo?.unlocked === "no") {
      await handleUnlockBootloader();
      updateAutoContinueStatus("נשלחה פקודת unlock. אשרו במכשיר וחזרו ל-Fastboot.");
      return;
    }

    updateAutoContinueStatus("Fastboot מחובר ומוכן לשלב הצריבה.");
    refreshButtons();
    return;
  }

  if (stage === "flash") {
    if (!state.fastboot) {
      if (state.adb) {
        await handleRebootToBootloader();
        updateAutoContinueStatus("נשלחה פקודת מעבר ל-Fastboot. מנסה להתחבר...");
        await sleep(1800);
      }
      await handleConnectFastboot();
      if (!state.fastboot) {
        updateAutoContinueStatus("צריך חיבור Fastboot לפני צריבה.", true);
        return;
      }
    }

    if (state.fastbootInfo?.unlocked !== "yes") {
      await handleUnlockBootloader();
      updateAutoContinueStatus("ה-Bootloader עדיין נעול. בצעו unlock ואז נסו שוב.", true);
      return;
    }

    if (getRecommendedFlashEntry()) {
      await handleAutoFlash();
      updateAutoContinueStatus("בוצע ניסיון צריבה אוטומטית מהמאגר.");
      return;
    }

    if (!els.flashFile.files?.[0]) {
      updateAutoContinueStatus("לא נמצא קובץ אוטומטי תואם. אפשר לבחור קובץ IMG ידנית ואז לנסות שוב.", true);
      return;
    }

    await handleFlash();
    updateAutoContinueStatus("בוצע ניסיון צריבה אוטומטי.");
  }
}

async function handleAutoContinue() {
  if (state.autoContinueRunning) {
    return;
  }

  state.autoContinueRunning = true;
  refreshButtons();

  try {
    await runAutoContinue();
  } catch (error) {
    updateAutoContinueStatus(`המשך אוטומטי נכשל: ${error.message}`, true);
    appendLog(`המשך אוטומטי נכשל: ${error.message}`, "ERROR");
  } finally {
    state.autoContinueRunning = false;
    refreshButtons();
  }
}

window.addEventListener("beforeunload", () => {
  stopAutoUpdateZipWatch();
});

function createEmptySteps() {
  return {
    adbDetected: false,
    updatePushed: false,
    updateInstalled: false,
    bootloaderUnlocked: false,
    flashed: false
  };
}

function normalizeStoredRecord(record = {}) {
  const steps = createEmptySteps();
  for (const key of TRACKED_STEP_KEYS) {
    if (Boolean(record.steps?.[key])) {
      steps[key] = true;
    }
  }

  return {
    serial: record.serial || "",
    model: normalizeModel(record.model || ""),
    brand: normalizeBrand(record.brand || ""),
    product: (record.product || "").trim(),
    version: (record.version || "").trim(),
    steps,
    lastSeenAt: record.lastSeenAt || ""
  };
}

function loadDeviceHistory() {
  try {
    const raw = localStorage.getItem(DEVICE_HISTORY_KEY);
    if (!raw) {
      state.deviceHistory = {};
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      state.deviceHistory = {};
      return;
    }

    const normalized = {};
    for (const [serial, record] of Object.entries(parsed)) {
      if (!serial) {
        continue;
      }
      normalized[serial] = normalizeStoredRecord({ ...record, serial });
    }
    state.deviceHistory = normalized;
  } catch (error) {
    state.deviceHistory = {};
    appendLog(`טעינת היסטוריית מכשירים נכשלה: ${error.message}`, "WARN");
  }
}

function persistDeviceHistory() {
  try {
    localStorage.setItem(DEVICE_HISTORY_KEY, JSON.stringify(state.deviceHistory));
  } catch (error) {
    appendLog(`שמירת היסטוריית מכשירים נכשלה: ${error.message}`, "WARN");
  }
}

function ensureDeviceRecord(serial) {
  if (!serial) {
    return null;
  }

  if (!state.deviceHistory[serial]) {
    state.deviceHistory[serial] = normalizeStoredRecord({ serial });
  }

  return state.deviceHistory[serial];
}

function getCurrentSerial() {
  return (state.deviceInfo?.serial || state.fastbootInfo?.serial || state.activeSerial || "").trim();
}

function setStepItemState(element, status) {
  if (!element) {
    return;
  }

  element.classList.remove("pending", "current", "done");
  element.classList.add(status);
}

function computeCurrentProgressStep(steps, needsUpdate) {
  if (!steps.adbDetected) {
    return "adbDetected";
  }

  if (needsUpdate && !steps.updatePushed) {
    return "updatePushed";
  }

  if (needsUpdate && !steps.updateInstalled) {
    return "updateInstalled";
  }

  if (!steps.bootloaderUnlocked) {
    return "bootloaderUnlocked";
  }

  if (!steps.flashed) {
    return "flashed";
  }

  return "";
}

function renderProgressTracker() {
  const serial = getCurrentSerial();
  const record = serial ? state.deviceHistory[serial] : null;
  const needsUpdate = state.actionRecommendation?.type === "update-required";
  const steps = record?.steps || createEmptySteps();
  const current = computeCurrentProgressStep(steps, needsUpdate);

  els.progressSerial.textContent = serial || "-";

  setStepItemState(
    els.stepAdb,
    steps.adbDetected ? "done" : (current === "adbDetected" ? "current" : "pending")
  );

  const updatePushedDone = needsUpdate ? steps.updatePushed : steps.adbDetected;
  setStepItemState(
    els.stepUpdatePushed,
    updatePushedDone ? "done" : (current === "updatePushed" ? "current" : "pending")
  );

  const updateInstalledDone = needsUpdate ? steps.updateInstalled : steps.adbDetected;
  setStepItemState(
    els.stepUpdateInstalled,
    updateInstalledDone ? "done" : (current === "updateInstalled" ? "current" : "pending")
  );

  setStepItemState(
    els.stepBootloaderUnlocked,
    steps.bootloaderUnlocked ? "done" : (current === "bootloaderUnlocked" ? "current" : "pending")
  );
  setStepItemState(
    els.stepFlashed,
    steps.flashed ? "done" : (current === "flashed" ? "current" : "pending")
  );
}

function setActiveSerial(serial) {
  const next = (serial || "").trim();
  const prev = state.activeSerial;
  state.activeSerial = next;
  if (next && prev && next !== prev) {
    setDeviceSupportStatus(null, "", "");
  }
  renderProgressTracker();
}

function updateDeviceRecord(serial, updater) {
  const record = ensureDeviceRecord(serial);
  if (!record) {
    return null;
  }

  updater(record);
  record.lastSeenAt = new Date().toISOString();
  persistDeviceHistory();
  renderProgressTracker();
  return record;
}

function mergeRecordIntoDeviceInfo(serial) {
  if (!serial) {
    return;
  }

  const record = state.deviceHistory[serial];
  if (!record) {
    return;
  }

  if (!state.deviceInfo || (state.deviceInfo.serial && state.deviceInfo.serial !== serial)) {
    state.deviceInfo = {
      model: record.model || "",
      brand: record.brand || "",
      product: record.product || "",
      version: record.version || "",
      serial
    };
  } else {
    state.deviceInfo.model = state.deviceInfo.model || record.model || "";
    state.deviceInfo.brand = state.deviceInfo.brand || record.brand || "";
    state.deviceInfo.product = state.deviceInfo.product || record.product || "";
    state.deviceInfo.version = state.deviceInfo.version || record.version || "";
    state.deviceInfo.serial = state.deviceInfo.serial || serial;
  }
}

function setSectionVisible(element, visible) {
  if (!element) {
    return;
  }
  element.classList.toggle("hidden", !visible);
}

function isUpdateRequired() {
  return state.actionRecommendation?.type === "update-required";
}

function setDeviceSupportStatus(supported, model = "", reason = "") {
  state.deviceSupport = {
    supported,
    model: normalizeModel(model),
    reason
  };
}

function getCurrentRecord() {
  const serial = getCurrentSerial();
  if (!serial) {
    return null;
  }
  return state.deviceHistory[serial] || null;
}

function computeUiStage() {
  if (state.deviceSupport?.supported === false) {
    return "unsupported";
  }

  const record = getCurrentRecord();
  const steps = record?.steps || createEmptySteps();
  const hasFastbootPath = Boolean(state.fastboot || state.fastbootInfo || state.lastUsbMode === "fastboot");
  if (!steps.adbDetected && !hasFastbootPath) {
    return "connect";
  }

  if (isUpdateRequired()) {
    return "update";
  }

  const unlocked = steps.bootloaderUnlocked || state.fastbootInfo?.unlocked === "yes";
  if (!unlocked) {
    return "fastboot";
  }

  if (!steps.flashed) {
    return "flash";
  }

  return "done";
}

function renderStageFlow() {
  const stage = computeUiStage();
  state.uiStage = stage;
  const hasDeviceInfo = Boolean(state.deviceInfo && (state.deviceInfo.model || state.deviceInfo.serial || state.deviceInfo.product));

  const contentByStage = {
    connect: {
      title: "שלב נוכחי: חיבור והכנת מכשיר",
      description: "בצעו את צ'קליסט ההכנה, אשרו USB Debugging, ואז התחברו ב-ADB."
    },
    update: {
      title: "שלב נוכחי: עדכון גרסה",
      description: "מסלול זה פעיל ל-OnePlus בלבד: הורידו ZIP, התקינו דרך Local install, ואז בדקו שוב גרסה ב-ADB."
    },
    fastboot: {
      title: "שלב נוכחי: מעבר ל-Fastboot ופתיחת Bootloader",
      description: "אשרו Unlock עם Volume Plus, ואז לחיצה ארוכה על Power + Volume Minus וחיבור Fastboot מחדש."
    },
    flash: {
      title: "שלב נוכחי: צריבת init_boot",
      description: "בחרו קובץ IMG מתאים ובצעו צריבה. בסיום הפעילו מחדש את המכשיר."
    },
    done: {
      title: "התהליך הושלם",
      description: "הצריבה סומנה כהצלחה למכשיר הנוכחי. ניתן לנתק או להתחיל מכשיר נוסף."
    },
    unsupported: {
      title: "לא ניתן להמשיך כרגע",
      description: state.deviceSupport.reason || "המכשיר או הגרסה שזוהו לא נתמכים כרגע."
    }
  };

  els.stageTitle.textContent = contentByStage[stage].title;
  els.stageDescription.textContent = contentByStage[stage].description;

  setSectionVisible(els.panelPreflight, stage === "connect");
  setSectionVisible(els.panelConnectGrid, stage === "connect" || stage === "unsupported");
  setSectionVisible(els.panelAction, stage === "connect" || stage === "update" || stage === "unsupported");
  setSectionVisible(els.panelUpdate, stage === "update");
  setSectionVisible(els.panelDeviceDetails, hasDeviceInfo);
  setSectionVisible(els.panelProgress, stage !== "connect" && stage !== "unsupported");
  setSectionVisible(els.panelFastboot, stage === "fastboot" || stage === "flash");
  setSectionVisible(els.panelFlash, stage === "flash" || stage === "done");
  const showFastbootFlashGrid = !els.panelFastboot.classList.contains("hidden") || !els.panelFlash.classList.contains("hidden");
  setSectionVisible(els.panelFastbootFlashGrid, showFastbootFlashGrid);
  setSectionVisible(els.panelInstructions, stage !== "done" && stage !== "unsupported");

  if (stage !== "update") {
    stopAutoUpdateZipWatch();
  }
}

function stopAutoUpdateZipWatch() {
  if (state.autoZipScanTimer) {
    window.clearInterval(state.autoZipScanTimer);
    state.autoZipScanTimer = null;
    state.autoZipScanBusy = false;
  }
}

function startAutoUpdateZipWatch() {
  if (state.autoZipScanTimer) {
    return;
  }

  if (!state.downloadsDirHandle) {
    updateStatus(els.pushStatus, "כדי לסרוק אוטומטית, בחר/י קודם תיקיית הורדות.");
    return;
  }

  if (!isUpdateRequired()) {
    return;
  }

  updateStatus(
    els.pushStatus,
    "סריקה אוטומטית פעילה: מחפש ZIP תואם בתיקיית ההורדות כל 4 שניות..."
  );
  appendLog("הופעלה סריקה אוטומטית ל-ZIP בתיקיית ההורדות.");

  const tick = async () => {
    if (state.autoZipScanBusy) {
      return;
    }
    if (!state.downloadsDirHandle || !isUpdateRequired()) {
      stopAutoUpdateZipWatch();
      return;
    }

    state.autoZipScanBusy = true;
    try {
      await handleFindUpdateZip({ silent: true, fromAuto: true });
      if (state.selectedUpdateZipHandle) {
        stopAutoUpdateZipWatch();
        appendLog(`סריקה אוטומטית מצאה קובץ עדכון: ${state.selectedUpdateZipName || "ZIP מתאים"}.`);
      }
    } finally {
      state.autoZipScanBusy = false;
    }
  };

  state.autoZipScanTimer = window.setInterval(() => {
    void tick();
  }, UPDATE_ZIP_SCAN_INTERVAL_MS);
  void tick();
}

function nowTime() {
  return new Date().toLocaleTimeString("he-IL", { hour12: false });
}

function appendLog(message, level = "INFO") {
  const line = `[${nowTime()}] [${level}] ${message}`;
  els.logOutput.textContent += `${line}\n`;
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

function updateStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.borderColor = isError ? "#f3c8c3" : "#e2ebee";
  element.style.background = isError ? "#fdeeed" : "#f5f8f9";
  element.style.color = isError ? "#7b1f16" : "#2a3b40";
}

function setActionMessage(message, kind = "neutral", link = "") {
  els.action.className = `action-message ${kind}`;
  els.action.textContent = message;

  const setLinkState = (element, url) => {
    if (!element) {
      return;
    }
    if (url) {
      element.href = url;
      element.classList.remove("hidden");
    } else {
      element.href = "#";
      element.classList.add("hidden");
    }
  };

  if (link) {
    setLinkState(els.updateLink, link);
    setLinkState(els.btnDownloadUpdate, link);
  } else {
    setLinkState(els.updateLink, "");
    setLinkState(els.btnDownloadUpdate, "");
  }
}

function setSupportLink(url = "") {
  if (!els.supportLink) {
    return;
  }
  if (url) {
    els.supportLink.href = url;
    els.supportLink.classList.remove("hidden");
  } else {
    els.supportLink.href = "#";
    els.supportLink.classList.add("hidden");
  }
}

function setProgress(percent) {
  const normalized = Math.max(0, Math.min(100, percent));
  els.progressBar.style.width = `${normalized}%`;
}

function setPushProgress(percent) {
  const normalized = Math.max(0, Math.min(100, percent));
  els.pushProgressBar.style.width = `${normalized}%`;
}

function showProgress(show) {
  els.progressWrap.classList.toggle("hidden", !show);
  if (!show) {
    setProgress(0);
  }
}

function showPushProgress(show) {
  els.pushProgressWrap.classList.toggle("hidden", !show);
  if (!show) {
    setPushProgress(0);
  }
}

function normalizeModel(value) {
  if (!value) {
    return "";
  }

  const match = String(value).toUpperCase().match(/(CPH\d{4}|OPD\d{4})/);
  return match ? match[1] : String(value).trim().toUpperCase();
}

function normalizeBrand(value) {
  const lower = String(value || "").trim().toLowerCase();
  if (!lower) {
    return "";
  }
  if (lower.includes("oneplus") || lower.includes("oppo") || lower.includes("oplus")) {
    return "oneplus";
  }
  if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) {
    return "xiaomi";
  }
  if (lower.includes("google")) {
    return "google";
  }
  return lower;
}

function getFamilyFromCompanyCode(company) {
  if (company === "xi") {
    return "xiaomi";
  }
  if (company === "pi") {
    return "pixel";
  }
  return "oneplus";
}

function getCompanyCodeByBrand(brand) {
  const normalized = normalizeBrand(brand);
  if (normalized === "oneplus") {
    return "op";
  }
  if (normalized === "xiaomi") {
    return "xi";
  }
  if (normalized === "google") {
    return "pi";
  }
  return "";
}

function toTitleCaseModel(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/[0-9]/.test(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function getApiModelCandidates(info) {
  const result = [];
  const push = (value) => {
    const text = String(value || "").trim();
    if (!text) {
      return;
    }
    if (!result.some((item) => item.toLowerCase() === text.toLowerCase())) {
      result.push(text);
    }
  };

  const model = String(info?.model || "").trim();
  const rawModel = String(info?.rawModel || "").trim();
  const product = String(info?.product || "").trim();
  push(rawModel);
  push(model);
  push(toTitleCaseModel(model));
  push(model.toUpperCase());
  push(model.toLowerCase());
  if (product) {
    push(product);
    push(product.toUpperCase());
  }

  return result;
}

function getFamilyLabel(family) {
  if (family === "xiaomi") {
    return "Xiaomi";
  }
  if (family === "pixel") {
    return "Pixel";
  }
  if (family === "oneplus") {
    return "OnePlus";
  }
  return "Android";
}

function getFileNameFromUrl(url) {
  if (!url) {
    return "";
  }
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "");
  } catch (_) {
    return "";
  }
}

async function fetchRomBootDecision(company, model, version) {
  const params = new URLSearchParams({
    company,
    model,
    version
  });
  const url = `${ROM_BOOT_API_URL}?${params.toString()}`;
  appendLog(`API request: ${url}`);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const status = Number(payload?.status || response.status || 0);
  appendLog(`API response: status=${status}, type=${payload?.type || "-"}, msg=${payload?.msg || "-"}`);
  return {
    status,
    type: String(payload?.type || ""),
    link: String(payload?.link || ""),
    msg: String(payload?.msg || ""),
    raw: payload
  };
}

function formatVersionFromCompact(compact) {
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) {
    return "";
  }

  const major = Number.parseInt(digits.slice(0, 2), 10);
  const minor = Number.parseInt(digits.slice(2, 3), 10);
  const patch = Number.parseInt(digits.slice(3, 4), 10);
  const build = Number.parseInt(digits.slice(4), 10);

  if ([major, minor, patch, build].some(Number.isNaN)) {
    return "";
  }

  return `${major}.${minor}.${patch}.${build}`;
}

function extractVersion(text) {
  if (!text) {
    return "";
  }

  const raw = String(text).trim();
  const withDots = raw.match(/(\d+\.\d+\.\d+\.\d+)/);
  if (withDots) {
    return withDots[1];
  }

  const compact = raw.match(/\b(\d{7,8})\b/);
  if (compact) {
    return formatVersionFromCompact(compact[1]);
  }

  const pixelLike = raw.match(/\b([A-Z]{2,6}\d[A-Z0-9]*(?:\.\d+){1,}[A-Z0-9.]*)\b/i);
  if (pixelLike) {
    return pixelLike[1];
  }

  const miLike = raw.match(/\b((?:OS|V)\d+(?:\.\d+){2,}[A-Z0-9.]*)\b/i);
  if (miLike) {
    return miLike[1];
  }

  const token = raw.split(/\s+/).find((part) => /[0-9]/.test(part));
  if (token && token.length <= 48) {
    return token.replace(/[),.;:]+$/, "");
  }

  return "";
}

function getRecommendedFlashEntry() {
  if (state.actionRecommendation?.type === "flash-ready" && state.actionRecommendation.entry) {
    return state.actionRecommendation.entry;
  }
  return null;
}

function detectFlashPartition(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.includes("init_boot")) {
    return "init_boot";
  }
  if (lower.includes("_boot.img") || lower.endsWith("boot.img")) {
    return "boot";
  }
  return "init_boot";
}

function resolveFlashPartition(entry, fileName = "") {
  const declared = String(entry?.partition || "").trim().toLowerCase();
  if (declared === "boot" || declared === "init_boot") {
    return declared;
  }
  return detectFlashPartition(fileName || entry?.imageFile || "");
}

function resolveImageDownloadUrl(entry) {
  if (entry?.imageUrl) {
    try {
      const resolved = new URL(entry.imageUrl, window.location.href).toString();
      if (/^https?:\/\//i.test(resolved)) {
        return resolved;
      }
    } catch (_) {}
  }

  const imageFile = entry?.imageFile || "";
  if (imageFile) {
    return new URL(`images/${imageFile}`, window.location.href).toString();
  }

  return "";
}

function parseDeviceMap(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [productRaw, modelRaw] = trimmed.split("=", 2);
    const product = productRaw.trim();
    const model = normalizeModel(modelRaw.trim());

    if (!product || !model) {
      continue;
    }

    if (!map.has(product)) {
      map.set(product, []);
    }

    map.get(product).push(model);
  }

  return map;
}

async function loadDeviceMap() {
  const candidates = ["./device_map.txt", "../device_map.txt"];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      state.deviceMap = parseDeviceMap(text);
      appendLog(`device_map נטען מ-${url}.`);
      return;
    } catch (error) {
      continue;
    }
  }

  appendLog("לא ניתן לטעון device_map.txt, זיהוי לפי codename יהיה מוגבל.", "WARN");
}

function inferUsbModeFromInterfaces(device) {
  if (!device || !Array.isArray(device.configurations)) {
    return "unknown";
  }

  for (const config of device.configurations) {
    if (!Array.isArray(config.interfaces)) {
      continue;
    }

    for (const iface of config.interfaces) {
      if (!Array.isArray(iface.alternates)) {
        continue;
      }

      for (const alt of iface.alternates) {
        if (alt.interfaceClass === 0xff && alt.interfaceSubclass === 0x42) {
          if (alt.interfaceProtocol === 0x01) {
            return "adb";
          }
          if (alt.interfaceProtocol === 0x03) {
            return "fastboot";
          }
        }
      }
    }
  }

  return "unknown";
}

function updateDevicePanel(info) {
  els.model.textContent = info?.model || "-";
  els.product.textContent = info?.product || "-";
  els.version.textContent = info?.version || "-";
  els.serial.textContent = info?.serial || "-";
}

function pickModelByProduct(productCode) {
  if (!productCode) {
    return "";
  }

  const mapped = state.deviceMap.get(productCode);
  if (!mapped || mapped.length === 0) {
    return "";
  }

  if (mapped.length === 1) {
    return mapped[0];
  }

  return "";
}

async function recommendAction() {
  setSupportLink("");
  const requestId = ++state.recommendationRequestId;

  if (!state.deviceInfo || !state.deviceInfo.model) {
    setDeviceSupportStatus(null, "", "");
    setActionMessage("חברו מכשיר ב-ADB כדי לקבל הנחיה אוטומטית.", "neutral");
    renderProgressTracker();
    refreshButtons();
    return;
  }

  const model = normalizeModel(state.deviceInfo.model);
  const version = state.deviceInfo.version;
  const brand = normalizeBrand(state.deviceInfo.brand);
  const company = getCompanyCodeByBrand(brand);

  if (!version) {
    state.actionRecommendation = null;
    state.selectedUpdateZipHandle = null;
    state.selectedUpdateZipName = "";
    setActionMessage(
      `הדגם ${model} נתמך, אבל גרסת המערכת לא זוהתה עדיין. ודאו שהמכשיר פתוח ומאושר ADB, ואז נסו שוב.`,
      "warning"
    );
    updateStatus(els.pushStatus, "גרסה לא זוהתה עדיין.");
    updateStatus(els.downloadsStatus, "התחברו ב-ADB כדי לזהות גרסה לפני החלטה על עדכון.");
    renderProgressTracker();
    refreshButtons();
    return;
  }

  if (!company) {
    const reason = `לא זוהה brand נתמך מהמכשיר (brand='${state.deviceInfo.brand || "-"}'). נדרש OnePlus/Xiaomi/Google.`;
    setDeviceSupportStatus(false, model, reason);
    state.actionRecommendation = null;
    setActionMessage(reason, "error");
    updateStatus(els.downloadsStatus, "לא ניתן לבחור company ל-API בלי brand ברור.");
    updateStatus(els.pushStatus, "בדקו שהמכשיר מחובר ב-ADB ושזיהוי brand תקין.");
    appendLog(`API selection blocked: brand='${state.deviceInfo.brand || "-"}' -> no company`, "WARN");
    renderProgressTracker();
    refreshButtons();
    return;
  }

  let chosenCompany = company;
  let chosenModel = model;
  let apiDecision = null;
  let last404 = null;
  const apiModels = getApiModelCandidates(state.deviceInfo);
  appendLog(`API selection: brand=${brand}; company=${company}; models=${apiModels.join(" | ")}`);

  for (const modelCandidate of apiModels) {
    try {
      const result = await fetchRomBootDecision(company, modelCandidate, version);
      if (requestId !== state.recommendationRequestId) {
        return;
      }

      if (result.status === 404) {
        last404 = result;
        continue;
      }

      chosenModel = modelCandidate;
      apiDecision = result;
      break;
    } catch (error) {
      if (requestId !== state.recommendationRequestId) {
        return;
      }
      const reason = `לא הצלחנו לקבל החלטה מהשרת (${error.message}). נסו שוב בעוד כמה שניות.`;
      setDeviceSupportStatus(false, model, reason);
      state.actionRecommendation = null;
      setActionMessage(reason, "error");
      updateStatus(els.downloadsStatus, "שגיאת תקשורת מול API.");
      updateStatus(els.pushStatus, "אין החלטה בטוחה לצריבה כרגע.");
      appendLog(`קריאת API rom_boot_link נכשלה: ${error.message}`, "ERROR");
      renderProgressTracker();
      refreshButtons();
      return;
    }
  }

  if (requestId !== state.recommendationRequestId) {
    return;
  }

  if (!apiDecision) {
    const triedModels = apiModels.join(" | ");
    const reason = last404?.msg || `הדגם ${model} לא נמצא בשרת ה-API.`;
    setDeviceSupportStatus(false, model, reason);
    state.actionRecommendation = null;
    setActionMessage(`${reason} (נוסו מודלים: ${triedModels})`, "error");
    updateStatus(els.downloadsStatus, "לא נמצא דגם תואם בשרת.");
    updateStatus(els.pushStatus, "בדקו שם דגם או הוסיפו אותו בצד השרת.");
    appendLog(`API model not found after variants: ${triedModels}`, "WARN");
    renderProgressTracker();
    refreshButtons();
    return;
  }

  const family = getFamilyFromCompanyCode(chosenCompany);
  const familyLabel = getFamilyLabel(family);

  if (apiDecision.status === 200 && apiDecision.link) {
    const sourceName = getFileNameFromUrl(apiDecision.link) || `${chosenModel}-${version}-boot.img`;
    state.actionRecommendation = {
      type: "flash-ready",
      entry: {
        family,
        model: chosenModel,
        version,
        imageFile: sourceName,
        imageUrl: apiDecision.link,
        partition: detectFlashPartition(sourceName)
      }
    };
    state.selectedUpdateZipHandle = null;
    state.selectedUpdateZipName = "";
    setDeviceSupportStatus(true, model, "");
    setActionMessage(
      `המכשיר (${familyLabel}) על גרסה ${version}. נמצא קובץ צריבה תואם מה-API (${sourceName}). אפשר לעבור ל-Fastboot ולצרוב.`,
      "success"
    );
    updateStatus(els.flashStatus, `קובץ מומלץ מוכן לצריבה אוטומטית: ${sourceName}`);
    updateStatus(els.pushStatus, "אין צורך בעדכון. אפשר להמשיך לשלב Fastboot.");
    updateStatus(els.downloadsStatus, "אין צורך בהורדת ZIP למכשיר הזה.");
    if (state.deviceInfo?.serial) {
      updateDeviceRecord(state.deviceInfo.serial, (record) => {
        record.steps.updateInstalled = true;
      });
    }
    renderProgressTracker();
    refreshButtons();
    return;
  }

  if (apiDecision.status === 202 && apiDecision.type === "full_flash" && apiDecision.link) {
    const message = apiDecision.msg || "קיימת גרסה חדשה יותר. נדרש עדכון ביניים לפני צריבה.";
    state.actionRecommendation = {
      type: "update-required",
      entry: {
        family,
        model: chosenModel,
        version,
        updateUrl: apiDecision.link
      }
    };
    state.selectedUpdateZipHandle = null;
    state.selectedUpdateZipName = "";
    setDeviceSupportStatus(true, model, "");
    setActionMessage(`${message} הורידו והתקינו ידנית ואז בדקו שוב גרסה ב-ADB.`, "warning", apiDecision.link);
    updateStatus(els.downloadsStatus, "נדרש עדכון ביניים ידני לפי ה-API.");
    updateStatus(els.pushStatus, "הורידו מהקישור, התקינו דרך Local install, ואז לחצו 'בדוק שוב גרסה ב-ADB'.");
    if (state.deviceInfo?.serial) {
      updateDeviceRecord(state.deviceInfo.serial, (record) => {
        record.steps.updateInstalled = false;
      });
    }
    renderProgressTracker();
    refreshButtons();
    return;
  }

  if (apiDecision.status === 202 && apiDecision.type === "need_build") {
    const reason = apiDecision.msg || `הגרסה ${version} לא נתמכת כרגע עבור ${model}.`;
    setDeviceSupportStatus(false, model, reason);
    state.actionRecommendation = {
      type: "version-unsupported",
      entry: null
    };
    setActionMessage(`${reason} פנו לקבוצת הצריבות בוואטסאפ לבניית גרסה מתאימה.`, "error");
    setSupportLink(SUPPORT_WHATSAPP_URL);
    updateStatus(els.downloadsStatus, "ה-API סימן שהגרסה דורשת בנייה.");
    updateStatus(els.pushStatus, "לא ניתן להמשיך עד בניית קובץ תואם.");
    renderProgressTracker();
    refreshButtons();
    return;
  }

  const reason = `תגובה לא מזוהה מה-API (${apiDecision.status}/${apiDecision.type || "-"})`;
  setDeviceSupportStatus(false, model, reason);
  state.actionRecommendation = null;
  setActionMessage(reason, "error");
  updateStatus(els.downloadsStatus, "לא התקבלה החלטה תקינה מהשרת.");
  updateStatus(els.pushStatus, "עצרנו את התהליך כדי למנוע צריבה שגויה.");
  appendLog(`API rom_boot_link החזיר מצב לא צפוי: ${JSON.stringify(apiDecision.raw || apiDecision)}`, "ERROR");
  renderProgressTracker();
  refreshButtons();
}

function refreshButtons() {
  const hasAdb = Boolean(state.adb);
  const hasFastboot = Boolean(state.fastboot);
  const hasFile = Boolean(els.flashFile.files && els.flashFile.files.length > 0);
  const unlocked = state.fastbootInfo?.unlocked === "yes";
  const needsUpdate = state.actionRecommendation?.type === "update-required";
  const autoFlashReady = state.actionRecommendation?.type === "flash-ready";
  const flowEnabled = state.deviceSupport.supported !== false;

  els.btnRebootBootloader.disabled = !hasAdb || !flowEnabled;
  els.btnRebootBootloaderFastboot.disabled = !hasAdb || !flowEnabled;
  els.btnPickDownloads.disabled = true;
  els.btnFindUpdateZip.disabled = true;
  els.btnPushUpdateZip.disabled = true;
  els.btnMarkUpdateInstalled.disabled = true;
  if (els.btnRecheckUpdate) {
    els.btnRecheckUpdate.disabled = !(flowEnabled && needsUpdate);
  }
  els.btnConnectFastboot.disabled = !flowEnabled;
  els.btnRebootDeviceFastboot.disabled = !(flowEnabled && hasFastboot);
  els.btnUnlock.disabled = !(flowEnabled && hasFastboot && state.fastbootInfo?.unlocked === "no");
  els.btnFlashAuto.disabled = !(flowEnabled && hasFastboot && unlocked && autoFlashReady);
  els.btnFlash.disabled = !(flowEnabled && hasFastboot && hasFile && unlocked);
  els.btnRebootDevice.disabled = !(flowEnabled && hasFastboot);
  const stage = computeUiStage();
  els.btnAutoContinue.textContent = getAutoContinueLabel(stage);
  const autoAllowed = flowEnabled && stage !== "unsupported" && stage !== "done";
  els.btnAutoContinue.disabled = !autoAllowed || state.autoContinueRunning;
  renderStageFlow();
}

async function importFirstAvailable(urls, label) {
  let lastError = null;

  for (const url of urls) {
    try {
      const mod = await import(url);
      appendLog(`נטענה ספריה ${label} מ-${url}.`);
      return mod;
    } catch (error) {
      lastError = error;
      appendLog(`טעינת ${label} נכשלה מ-${url}: ${error.message}`, "WARN");
    }
  }

  throw new Error(`לא ניתן לטעון את ${label}. שגיאה אחרונה: ${lastError?.message || "Unknown error"}`);
}

function resolveCredentialStoreFactory(credentialModule) {
  const directCtor = credentialModule.AdbWebCredentialStore
    || credentialModule.AdbWebCryptoCredentialManager
    || credentialModule.default;

  if (typeof directCtor === "function") {
    return () => {
      if (directCtor === credentialModule.AdbWebCryptoCredentialManager && credentialModule.TangoIndexedDbStorage) {
        return new directCtor(new credentialModule.TangoIndexedDbStorage(), "android-web-flasher");
      }
      return new directCtor();
    };
  }

  if (credentialModule.AdbWebCryptoCredentialManager && credentialModule.TangoIndexedDbStorage) {
    return () => new credentialModule.AdbWebCryptoCredentialManager(
      new credentialModule.TangoIndexedDbStorage(),
      "android-web-flasher"
    );
  }

  throw new Error("לא נמצא credential store תואם לחבילת ADB.");
}

function resolveWebUsbManager(webUsbModule) {
  const managerHolder = webUsbModule.AdbDaemonWebUsbDeviceManager
    || webUsbModule.default?.AdbDaemonWebUsbDeviceManager
    || webUsbModule.default;

  const manager = managerHolder?.BROWSER || webUsbModule.BROWSER;
  if (!manager) {
    throw new Error("AdbDaemonWebUsbDeviceManager.BROWSER לא זמין.");
  }

  return manager;
}

function humanizeConnectError(error, mode) {
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();

  if (error?.name === "NotFoundError") {
    return "לא נבחר מכשיר בחלון ההרשאות של Chrome.";
  }

  if (lower.includes("claim interface") || lower.includes("busy") || lower.includes("in use")) {
    return `החיבור ל-${mode} נכשל כי ממשק ה-USB תפוס. סגור לשוניות WebADB אחרות, נתק/חבר מחדש USB ונסה שוב.`;
  }

  if (lower.includes("failed to fetch dynamically imported module") || lower.includes("importing a module script failed")) {
    return "טעינת ספריות ה-Web נכשלה (CDN). בדוק חיבור אינטרנט/חסימת רשת ונסה לרענן את העמוד.";
  }

  if (lower.includes("secure") || lower.includes("context")) {
    return "WebUSB דורש הרצה ב-HTTPS או localhost.";
  }

  if (lower.includes("access denied") || lower.includes("permission")) {
    return "אין הרשאת USB למכשיר. אשר את החלון של Chrome ונסה שוב.";
  }

  return raw || `חיבור ${mode} נכשל מסיבה לא ידועה.`;
}

async function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function ensureAdbStack() {
  if (state.adbStackPromise) {
    return state.adbStackPromise;
  }

  state.adbStackPromise = Promise.all([
    importFirstAvailable(MODULE_CANDIDATES.adb, "ADB"),
    importFirstAvailable(MODULE_CANDIDATES.adbWebUsb, "ADB WebUSB"),
    importFirstAvailable(MODULE_CANDIDATES.adbCredential, "ADB Credential")
  ]).then(([adbModule, webUsbModule, credentialModule]) => {
    const manager = resolveWebUsbManager(webUsbModule);
    const createCredentialStore = resolveCredentialStoreFactory(credentialModule);

    return {
      Adb: adbModule.Adb,
      AdbDaemonTransport: adbModule.AdbDaemonTransport,
      manager,
      createCredentialStore
    };
  });

  return state.adbStackPromise;
}

async function ensureFastbootCtor() {
  if (state.fastbootCtorPromise) {
    return state.fastbootCtorPromise;
  }

  state.fastbootCtorPromise = importFirstAvailable(MODULE_CANDIDATES.fastboot, "Fastboot").then((mod) => {
    return mod.FastbootDevice || mod.default?.FastbootDevice || mod.default;
  });

  return state.fastbootCtorPromise;
}

async function runAdbShell(adb, command) {
  if (adb?.subprocess?.noneProtocol?.spawnWaitText) {
    const result = await adb.subprocess.noneProtocol.spawnWaitText(command);
    if (typeof result === "string") {
      return result.trim();
    }

    if (result?.stdout) {
      return String(result.stdout).trim();
    }
  }

  if (adb?.subprocess?.noneProtocol?.spawn) {
    const spawned = adb.subprocess.noneProtocol.spawn(command);
    if (spawned && typeof spawned.wait === "function") {
      const waited = await spawned.wait();
      if (typeof waited === "string") {
        return waited.trim();
      }

      if (waited?.stdout) {
        return decodeBytes(waited.stdout).trim();
      }
    }
  }

  if (adb?.subprocess?.shellProtocol?.spawn) {
    const spawned = adb.subprocess.shellProtocol.spawn(command);
    if (spawned && typeof spawned.wait === "function") {
      const waited = await spawned.wait();
      if (typeof waited === "string") {
        return waited.trim();
      }

      if (waited?.stdout) {
        return decodeBytes(waited.stdout).trim();
      }
    }
  }

  throw new Error("לא נמצאה שיטה להריץ ADB shell command.");
}

function decodeBytes(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new TextDecoder().decode(new Uint8Array(value.buffer));
  }

  if (value && typeof value.toString === "function") {
    return value.toString();
  }

  return "";
}

async function getAdbProp(adb, prop) {
  try {
    if (typeof adb?.getProp === "function") {
      const value = await adb.getProp(prop);
      if (value) {
        return String(value).trim();
      }
    }
  } catch (error) {
    appendLog(`adb.getProp נכשל עבור ${prop}: ${error.message}`, "WARN");
  }

  try {
    return await runAdbShell(adb, `getprop ${prop}`);
  } catch (error) {
    appendLog(`getprop shell נכשל עבור ${prop}: ${error.message}`, "WARN");
    return "";
  }
}

async function readDeviceInfoFromAdb(adb, serialFallback = "") {
  const [modelProp, vendorModelProp, nameProp, brandProp, manufacturerProp, vendorBrandProp] = await Promise.all([
    getAdbProp(adb, "ro.product.model"),
    getAdbProp(adb, "ro.product.vendor.model"),
    getAdbProp(adb, "ro.product.name"),
    getAdbProp(adb, "ro.product.brand"),
    getAdbProp(adb, "ro.product.manufacturer"),
    getAdbProp(adb, "ro.product.vendor.brand")
  ]);

  const product = (await getAdbProp(adb, "ro.product.device")).trim();
  const versionDisplay = await getAdbProp(adb, "persist.sys.oplus.ota_ver_display");
  const buildDisplay = await getAdbProp(adb, "ro.build.display.id");
  const serial = (await getAdbProp(adb, "ro.serialno")) || serialFallback;
  const rawModel = String(modelProp || vendorModelProp || nameProp || "").trim();
  const brand = normalizeBrand(brandProp || manufacturerProp || vendorBrandProp || "");

  const modelCandidates = [modelProp, vendorModelProp, nameProp];

  let model = modelCandidates.map((item) => normalizeModel(item)).find(Boolean) || "";

  if (!model && product) {
    const mapped = pickModelByProduct(product);
    if (mapped) {
      model = mapped;
    }
  }

  const version = extractVersion(versionDisplay) || extractVersion(buildDisplay);

  return {
    model,
    rawModel,
    brand,
    product,
    version,
    serial: serial || ""
  };
}

async function handleCheckUsbMode() {
  if (!navigator.usb) {
    updateStatus(els.usbStatus, "הדפדפן לא תומך ב-WebUSB. יש להשתמש ב-Chrome/Edge.", true);
    appendLog("navigator.usb לא זמין.", "ERROR");
    return;
  }

  try {
    const usbDevice = await navigator.usb.requestDevice({ filters: USB_FILTERS });
    const mode = inferUsbModeFromInterfaces(usbDevice);
    state.lastUsbMode = mode;
    if (mode === "adb" || mode === "fastboot") {
      setDeviceSupportStatus(null, "", "");
    }
    let message = `נבחר: ${usbDevice.productName || "Unknown USB Device"}. `;

    if (mode === "adb") {
      message += "מצב זוהה: ADB";
    } else if (mode === "fastboot") {
      message += "מצב זוהה: Fastboot";
      const serial = (usbDevice.serialNumber || "").trim();
      if (serial) {
        if (state.deviceInfo?.serial && state.deviceInfo.serial !== serial) {
          state.deviceInfo = null;
        }
        setActiveSerial(serial);
        mergeRecordIntoDeviceInfo(serial);
        message += ` | סריאלי: ${serial}`;
        if (state.deviceInfo) {
          updateDevicePanel(state.deviceInfo);
          await recommendAction();
        } else {
          setActionMessage(
            "זוהה Fastboot. לא נמצאה היסטוריה לסריאלי הזה, לכן מומלץ להתחבר קודם ב-ADB לזיהוי גרסה.",
            "warning"
          );
          updateStatus(els.pushStatus, "אין גרסה שמורה לסריאלי הזה. כדי לוודא התאמה, התחברו ב-ADB לפחות פעם אחת.");
        }
      } else {
        setActionMessage(
          "זוהה Fastboot, אבל הסריאלי לא נקרא בבדיקת USB. לחצו 'חיבור Fastboot' כדי לזהות סריאלי.",
          "warning"
        );
      }
      updateStatus(els.fastbootStatus, "זוהה מצב Fastboot. לחצו 'חיבור Fastboot' או 'המשך אוטומטי'.");
    } else {
      message += "מצב לא זוהה אוטומטית. אפשר להמשיך עם כפתורי החיבור.";
    }

    updateStatus(els.usbStatus, message);
    appendLog(message);
    refreshButtons();
  } catch (error) {
    if (error?.name === "NotFoundError") {
      updateStatus(els.usbStatus, "לא נבחר מכשיר.");
      appendLog("משתמש ביטל בחירת USB.", "WARN");
      return;
    }

    updateStatus(els.usbStatus, `בדיקת USB נכשלה: ${error.message}`, true);
    appendLog(`בדיקת USB נכשלה: ${error.message}`, "ERROR");
  }
}

async function handleConnectAdb() {
  if (!navigator.usb) {
    updateStatus(els.adbStatus, "WebUSB לא זמין. הפעילו Chrome/Edge.", true);
    return;
  }

  updateStatus(els.adbStatus, "מתחבר ל-ADB...");

  try {
    const { Adb, AdbDaemonTransport, manager, createCredentialStore } = await ensureAdbStack();
    appendLog("ADB step: בקשת בחירת מכשיר.");

    if (state.adbTransport?.close) {
      await state.adbTransport.close().catch(() => {});
    }

    const adbUsbDevice = await withTimeout(
      manager.requestDevice(),
      20000,
      "בחירת המכשיר ארכה יותר מדי זמן. נסה שוב ולחץ על המכשיר בחלון שנפתח."
    );
    if (!adbUsbDevice) {
      throw new Error("לא נבחר מכשיר ADB.");
    }
    appendLog(`ADB step: נבחר מכשיר ${adbUsbDevice.serial || adbUsbDevice.raw?.productName || "-"}.`);
    updateStatus(els.adbStatus, "מכשיר נבחר. פותח חיבור USB...");

    const connection = await withTimeout(
      adbUsbDevice.connect(),
      15000,
      "פתיחת חיבור USB נכשלה/נתקעה. נתק וחבר כבל USB ונסה שוב."
    );
    appendLog("ADB step: חיבור USB נפתח.");
    updateStatus(els.adbStatus, "מאמת חיבור ADB... אשר בקשת USB Debugging במסך הטלפון אם מופיעה.");

    const transport = await withTimeout(
      AdbDaemonTransport.authenticate({
        serial: adbUsbDevice.serial,
        connection,
        credentialStore: createCredentialStore()
      }),
      30000,
      "אימות ADB נתקע. ודא שמסך המכשיר פתוח ואשר חלון 'Allow USB debugging'."
    );
    appendLog("ADB step: אימות ADB הושלם.");

    state.adbTransport = transport;
    state.adbUsbDevice = adbUsbDevice;
    state.adb = new Adb(transport);
    state.lastUsbMode = "adb";

    const info = await readDeviceInfoFromAdb(state.adb, adbUsbDevice.serial || "");
    state.deviceInfo = info;
    if (info.serial) {
      setActiveSerial(info.serial);
      updateDeviceRecord(info.serial, (record) => {
        const previousVersion = record.version;
        record.model = normalizeModel(info.model || record.model || "");
        record.brand = normalizeBrand(info.brand || record.brand || "");
        record.product = info.product || record.product || "";
        record.version = info.version || record.version || "";
        record.steps.adbDetected = true;

        if (previousVersion && info.version && previousVersion !== info.version) {
          record.steps.updatePushed = false;
          record.steps.updateInstalled = false;
          record.steps.bootloaderUnlocked = false;
          record.steps.flashed = false;
        }
      });
    }

    updateDevicePanel(info);
    await recommendAction();
    refreshButtons();

    const labelModel = info.model || "לא זוהה";
    const labelVersion = info.version || "לא זוהתה";
    const labelBrand = info.brand || "לא זוהה";

    updateStatus(els.adbStatus, `מחובר ל-ADB. brand=${labelBrand}, דגם: ${labelModel}, גרסה: ${labelVersion}`);
    appendLog(`ADB connected. brand=${labelBrand}, model=${labelModel}, version=${labelVersion}, product=${info.product || "-"}`);
    refreshButtons();
  } catch (error) {
    const message = humanizeConnectError(error, "ADB");
    updateStatus(els.adbStatus, `חיבור ADB נכשל: ${message}`, true);
    appendLog(`חיבור ADB נכשל: ${error?.message || error}`, "ERROR");
  }
}

function getExpectedZipNames() {
  const entry = state.actionRecommendation?.entry;
  const model = normalizeModel(state.deviceInfo?.model || entry?.model || "");
  const version = entry?.version || state.deviceInfo?.version || "";

  const set = new Set();
  if (entry?.updateUrl) {
    try {
      const name = decodeURIComponent(new URL(entry.updateUrl).pathname.split("/").pop() || "");
      if (name.toLowerCase().endsWith(".zip")) {
        set.add(name);
      }
    } catch (_) {}
  }

  const imageFile = String(entry?.imageFile || "");
  if (imageFile) {
    const byImageBase = imageFile.match(/^(.+?)-0\.0\.4-\d+_(?:init_)?boot\.img$/i);
    if (byImageBase?.[1]) {
      set.add(`${byImageBase[1]}.zip`);
      set.add(`${byImageBase[1]}(EX01).zip`);
    }
  }

  if (model && version) {
    const modelLower = model.toLowerCase();
    const clean = version.replace(/\D/g, "");
    const head = clean.slice(0, 2);
    const tail = clean.slice(2);
    set.add(`${modelLower}_${head}_${tail}.zip`);
    set.add(`${modelLower}_${clean}.zip`);
    set.add(`${modelLower}_${tail}.zip`);
    set.add(`${modelLower}-${version}.zip`);
    set.add(`${modelLower}_${version}.zip`);
    set.add(`${model}-${version}.zip`);
    set.add(`op_${modelLower}-${version}.zip`);
    set.add(`op_${modelLower}-${version}(EX01).zip`);
    set.add(`${modelLower}-${version}(EX01).zip`);
    set.add(`${model}-${version}(EX01).zip`);
  }

  return Array.from(set).filter(Boolean);
}

function normalizeZipNameForLooseMatch(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isLikelyUpdateZipName(name) {
  const entry = state.actionRecommendation?.entry;
  const model = normalizeModel(state.deviceInfo?.model || entry?.model || "").toLowerCase();
  const version = String(entry?.version || state.deviceInfo?.version || "").trim();
  const lower = String(name || "").toLowerCase();

  if (!lower.endsWith(".zip")) {
    return false;
  }

  if (model && !lower.includes(model)) {
    return false;
  }

  if (!version) {
    return false;
  }

  const nameKey = normalizeZipNameForLooseMatch(name);
  const versionKey = normalizeZipNameForLooseMatch(version);
  const dotted = version.toLowerCase();
  const underscored = dotted.replace(/\./g, "_");
  const dashed = dotted.replace(/\./g, "-");

  return (
    lower.includes(dotted)
    || lower.includes(underscored)
    || lower.includes(dashed)
    || (versionKey && nameKey.includes(versionKey))
  );
}

async function ensureReadPermission(dirHandle) {
  if (!dirHandle) {
    return false;
  }

  if (typeof dirHandle.queryPermission !== "function") {
    return true;
  }

  const current = await dirHandle.queryPermission({ mode: "read" });
  if (current === "granted") {
    return true;
  }

  const requested = await dirHandle.requestPermission({ mode: "read" });
  return requested === "granted";
}

async function handlePickDownloadsFolder() {
  if (!("showDirectoryPicker" in window)) {
    updateStatus(els.downloadsStatus, "הדפדפן לא תומך בגישה לתיקיית קבצים (File System Access API).", true);
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: "read" });
    const permissionOk = await ensureReadPermission(dirHandle);
    if (!permissionOk) {
      throw new Error("לא ניתנה הרשאה לקריאת התיקייה.");
    }

    state.downloadsDirHandle = dirHandle;
    state.selectedUpdateZipHandle = null;
    state.selectedUpdateZipName = "";
    updateStatus(els.downloadsStatus, `נבחרה תיקייה: ${dirHandle.name}`);
    updateStatus(els.pushStatus, "בחרת תיקייה. לחץ 'חפש ZIP עדכון בתיקייה'.");
    appendLog(`נבחרה תיקיית הורדות: ${dirHandle.name}`);
    await handleFindUpdateZip({ silent: true });
    refreshButtons();
  } catch (error) {
    if (error?.name === "AbortError") {
      appendLog("בחירת תיקיית הורדות בוטלה על ידי המשתמש.", "WARN");
      return;
    }

    updateStatus(els.downloadsStatus, `בחירת תיקיית הורדות נכשלה: ${error.message}`, true);
    appendLog(`בחירת תיקיית הורדות נכשלה: ${error.message}`, "ERROR");
  }
}

async function handleFindUpdateZip(options = {}) {
  const silent = Boolean(options.silent);
  const fromAuto = Boolean(options.fromAuto);
  if (!state.downloadsDirHandle) {
    updateStatus(els.downloadsStatus, "יש לבחור קודם תיקיית הורדות.", true);
    return;
  }

  if (state.actionRecommendation?.type !== "update-required") {
    updateStatus(els.pushStatus, "כרגע אין דרישת עדכון גרסה למכשיר הזה.");
    stopAutoUpdateZipWatch();
    refreshButtons();
    return;
  }

  const expected = getExpectedZipNames();
  if (!expected.length) {
    updateStatus(els.pushStatus, "לא הצלחנו לבנות שם ZIP צפוי עבור הדגם/גרסה.");
    return;
  }

  if (!silent) {
    appendLog(`מחפש ZIP בתיקייה לפי שמות צפויים: ${expected.join(", ")}`);
  }

  try {
    const permissionOk = await ensureReadPermission(state.downloadsDirHandle);
    if (!permissionOk) {
      throw new Error("אין הרשאה לקריאת התיקייה שנבחרה.");
    }

    let foundHandle = null;
    let foundName = "";
    const expectedLower = new Set(expected.map((name) => name.toLowerCase()));

    for await (const [name, handle] of state.downloadsDirHandle.entries()) {
      if (handle.kind !== "file") {
        continue;
      }
      if (!name.toLowerCase().endsWith(".zip")) {
        continue;
      }
      if (expectedLower.has(name.toLowerCase()) || isLikelyUpdateZipName(name)) {
        foundHandle = handle;
        foundName = name;
        break;
      }
    }

    if (!foundHandle) {
      state.selectedUpdateZipHandle = null;
      state.selectedUpdateZipName = "";
      if (!fromAuto) {
        updateStatus(
          els.pushStatus,
          `לא נמצא ZIP תואם בתיקייה. הורד/י את קובץ העדכון ואז לחץ/י 'חפש ZIP עדכון בתיקייה'.`
        );
      }
      if (!silent) {
        appendLog("לא נמצא ZIP תואם בתיקייה שנבחרה.", "WARN");
      }
      refreshButtons();
      return;
    }

    state.selectedUpdateZipHandle = foundHandle;
    state.selectedUpdateZipName = foundName;
    updateStatus(els.pushStatus, `נמצא קובץ עדכון: ${foundName}. אפשר לבצע ADB push.`);
    if (!silent) {
      appendLog(`נמצא ZIP לעדכון: ${foundName}`);
    }
    refreshButtons();
  } catch (error) {
    updateStatus(els.pushStatus, `חיפוש ZIP נכשל: ${error.message}`, true);
    appendLog(`חיפוש ZIP נכשל: ${error.message}`, "ERROR");
  }
}

function getSpawnBinaryWriter(spawned) {
  const stdin = spawned?.stdin;
  if (!stdin) {
    throw new Error("תהליך ADB shell לא מספק stdin להעברת נתונים.");
  }

  if (typeof stdin.getWriter === "function") {
    const writer = stdin.getWriter();
    return {
      write: async (chunk) => writer.write(chunk),
      close: async () => writer.close()
    };
  }

  if (typeof stdin.write === "function") {
    return {
      write: async (chunk) => stdin.write(chunk),
      close: async () => {
        if (typeof stdin.close === "function") {
          await stdin.close();
        }
      }
    };
  }

  throw new Error("stdin של תהליך ADB לא נתמך להעברת בינארי.");
}

function shellQuoteSingle(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function adbPushFileViaShell(adb, file, remotePath, onProgress) {
  const command = `cat > ${shellQuoteSingle(remotePath)}`;
  const spawned = adb?.subprocess?.noneProtocol?.spawn?.(command);
  if (!spawned) {
    throw new Error("לא ניתן לפתוח תהליך shell להעברת קובץ.");
  }

  const writer = getSpawnBinaryWriter(spawned);
  const reader = file.stream().getReader();
  let uploaded = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      await writer.write(value);
      uploaded += value.byteLength || value.length || 0;
      if (onProgress) {
        onProgress(uploaded, file.size || 0);
      }
    }
  } finally {
    try {
      await writer.close();
    } catch (_) {}
    try {
      reader.releaseLock();
    } catch (_) {}
  }

  if (typeof spawned.wait === "function") {
    await spawned.wait();
  }
}

async function remoteFileExists(fileName) {
  const escaped = fileName.replace(/"/g, '\\"');
  const out = await runAdbShell(state.adb, `ls "/sdcard/${escaped}"`);
  return out.includes(fileName);
}

async function handlePushUpdateZip() {
  if (!state.adb) {
    updateStatus(els.pushStatus, "יש להתחבר קודם ב-ADB.", true);
    return;
  }

  if (!state.selectedUpdateZipHandle) {
    updateStatus(els.pushStatus, "לא נבחר קובץ ZIP לעדכון.");
    return;
  }

  try {
    const file = await state.selectedUpdateZipHandle.getFile();
    const remoteName = file.name;
    const remotePath = `/sdcard/${remoteName}`;

    if (await remoteFileExists(remoteName).catch(() => false)) {
      const skip = window.confirm(`הקובץ ${remoteName} כבר קיים במכשיר. לדלג על push?`);
      if (skip) {
        updateStatus(els.pushStatus, "הקובץ כבר קיים במכשיר. דילגנו על push.");
        appendLog(`הקובץ ${remoteName} כבר קיים ב-/sdcard. push דולג.`);
        const serial = getCurrentSerial();
        if (serial) {
          updateDeviceRecord(serial, (record) => {
            record.steps.adbDetected = true;
            record.steps.updatePushed = true;
          });
        }
        refreshButtons();
        return;
      }
    }

    updateStatus(els.pushStatus, `מבצע ADB push של ${remoteName}...`);
    appendLog(`ADB push התחיל: ${remoteName} -> ${remotePath}`);
    showPushProgress(true);
    setPushProgress(0);

    await adbPushFileViaShell(state.adb, file, remotePath, (uploaded, total) => {
      if (total > 0) {
        setPushProgress(Math.round((uploaded / total) * 100));
      }
    });

    setPushProgress(100);
    updateStatus(els.pushStatus, "ADB push הסתיים. התקן את העדכון מתוך Local Install במכשיר.");
    appendLog(`ADB push הסתיים בהצלחה עבור ${remoteName}.`);
    const serial = getCurrentSerial();
    if (serial) {
      updateDeviceRecord(serial, (record) => {
        record.steps.adbDetected = true;
        record.steps.updatePushed = true;
      });
    }
    refreshButtons();
  } catch (error) {
    updateStatus(els.pushStatus, `ADB push נכשל: ${error.message}`, true);
    appendLog(`ADB push נכשל: ${error.message}`, "ERROR");
  }
}

function handleMarkUpdateInstalled() {
  const serial = getCurrentSerial();
  if (!serial) {
    updateStatus(els.pushStatus, "לא זוהה סריאלי פעיל. התחברו ב-ADB קודם.", true);
    return;
  }

  updateDeviceRecord(serial, (record) => {
    record.steps.adbDetected = true;
    record.steps.updatePushed = true;
    record.steps.updateInstalled = true;
  });

  updateStatus(
    els.pushStatus,
    "עודכן: המשתמש סימן שהעדכון הותקן. עכשיו עברו ל-Bootloader ואז חיבור Fastboot."
  );
  appendLog("המשתמש סימן 'סיימתי להתקין עדכון במכשיר'.");
  refreshButtons();
}

async function handleRecheckUpdate() {
  const serial = getCurrentSerial();
  if (serial) {
    updateDeviceRecord(serial, (record) => {
      record.steps.updatePushed = true;
    });
  }

  updateStatus(els.pushStatus, "בודק שוב גרסה ב-ADB...");
  await handleConnectAdb();
  if (state.adb) {
    updateStatus(els.pushStatus, "בדיקת גרסה הושלמה. אם הגרסה מתאימה, אפשר להמשיך לשלב Fastboot.");
  } else {
    updateStatus(els.pushStatus, "בדיקת גרסה נכשלה. נסו שוב להתחבר ב-ADB.", true);
  }
}

async function handleRebootToBootloader() {
  if (!state.adb) {
    updateStatus(els.adbStatus, "יש להתחבר קודם ב-ADB.", true);
    return;
  }

  try {
    if (state.adb?.power?.reboot) {
      await state.adb.power.reboot("bootloader");
    } else {
      await runAdbShell(state.adb, "reboot bootloader");
    }

    updateStatus(els.adbStatus, "נשלחה פקודת מעבר ל-Bootloader. עכשיו התחברו ב-Fastboot.");
    appendLog("נשלחה פקודת reboot bootloader.");
  } catch (error) {
    updateStatus(
      els.adbStatus,
      `לא הצלחנו להעביר אוטומטית ל-Bootloader: ${error.message}. עברו ידנית ל-Fastboot ואז לחצו חיבור Fastboot.`,
      true
    );
    appendLog(`ADB reboot bootloader נכשל: ${error.message}`, "ERROR");
  }
}

async function readFastbootInfo(device) {
  const product = (await device.getVariable("product").catch(() => "")).trim();
  const unlocked = (await device.getVariable("unlocked").catch(() => "")).trim().toLowerCase();
  const currentSlot = (await device.getVariable("current-slot").catch(() => "")).trim();
  const serial = (await device.getVariable("serialno").catch(() => "")).trim()
    || (state.deviceInfo?.serial || "").trim();
  const savedRecord = serial ? state.deviceHistory[serial] : null;

  let model = "";
  if (state.deviceInfo?.model) {
    model = normalizeModel(state.deviceInfo.model);
  }

  if (!model && savedRecord?.model) {
    model = normalizeModel(savedRecord.model);
  }

  if (!model && product) {
    const mappedModels = state.deviceMap.get(product) || [];
    if (mappedModels.length === 1) {
      model = mappedModels[0];
    }
  }

  return {
    serial,
    product,
    unlocked,
    currentSlot,
    model,
    brand: normalizeBrand(state.deviceInfo?.brand || savedRecord?.brand || ""),
    version: state.deviceInfo?.version || savedRecord?.version || ""
  };
}

async function handleConnectFastboot() {
  updateStatus(els.fastbootStatus, "מתחבר ל-Fastboot...");

  try {
    const FastbootDevice = await ensureFastbootCtor();
    if (!FastbootDevice) {
      throw new Error("FastbootDevice לא זמין.");
    }

    const fastboot = new FastbootDevice();
    await fastboot.connect();

    state.fastboot = fastboot;
    state.fastbootInfo = await readFastbootInfo(fastboot);
    state.lastUsbMode = "fastboot";
    const fastbootSerial = (state.fastbootInfo.serial || "").trim();
    if (fastbootSerial) {
      setActiveSerial(fastbootSerial);
      mergeRecordIntoDeviceInfo(fastbootSerial);
    }

    const savedRecord = fastbootSerial ? state.deviceHistory[fastbootSerial] : null;
    const previousInfo = state.deviceInfo;
    const canReusePrevious = Boolean(previousInfo && (!fastbootSerial || previousInfo.serial === fastbootSerial));

    state.deviceInfo = {
      model: normalizeModel(
        state.fastbootInfo.model
          || (canReusePrevious ? previousInfo?.model : "")
          || savedRecord?.model
          || ""
      ),
      brand: normalizeBrand(
        state.fastbootInfo.brand
          || (canReusePrevious ? previousInfo?.brand : "")
          || savedRecord?.brand
          || ""
      ),
      product: state.fastbootInfo.product
        || (canReusePrevious ? previousInfo?.product : "")
        || savedRecord?.product
        || "",
      version: state.fastbootInfo.version
        || (canReusePrevious ? previousInfo?.version : "")
        || savedRecord?.version
        || "",
      serial: fastbootSerial || (canReusePrevious ? previousInfo?.serial : "") || ""
    };

    if (state.deviceInfo.serial) {
      updateDeviceRecord(state.deviceInfo.serial, (record) => {
        record.model = normalizeModel(state.deviceInfo.model || record.model || "");
        record.brand = normalizeBrand(state.deviceInfo.brand || record.brand || "");
        record.product = state.deviceInfo.product || record.product || "";
        record.version = state.deviceInfo.version || record.version || "";
        if (state.fastbootInfo.unlocked === "yes") {
          record.steps.bootloaderUnlocked = true;
        }
      });
    }

    updateDevicePanel(state.deviceInfo);
    await recommendAction();

    const unlockText = state.fastbootInfo.unlocked || "לא ידוע";
    updateStatus(
      els.fastbootStatus,
      `מחובר ל-Fastboot. serial=${state.fastbootInfo.serial || "-"}, product=${state.fastbootInfo.product || "-"}, unlocked=${unlockText}`
    );

    if (unlockText === "no") {
      setActionMessage(
        "ה-Bootloader נעול. יש לפתוח אותו לפני צריבה (פעולה שמוחקת נתונים).",
        "warning"
      );
      updateStatus(
        els.fastbootStatus,
        "Bootloader נעול. לחץ Unlock, אשר עם Volume Plus, ואז לחץ ארוך על Power + Volume Minus כדי לחזור ל-Fastboot מיד."
      );
    } else if (unlockText === "yes" && state.deviceInfo?.serial) {
      updateDeviceRecord(state.deviceInfo.serial, (record) => {
        record.steps.bootloaderUnlocked = true;
      });
    }

    refreshButtons();
    appendLog(`Fastboot connected. serial=${state.fastbootInfo.serial || "-"}, product=${state.fastbootInfo.product || "-"}, unlocked=${unlockText}`);
  } catch (error) {
    const message = humanizeConnectError(error, "Fastboot");
    updateStatus(els.fastbootStatus, `חיבור Fastboot נכשל: ${message}`, true);
    appendLog(`חיבור Fastboot נכשל: ${error?.message || error}`, "ERROR");
  }
}

async function handleUnlockBootloader() {
  if (!state.fastboot) {
    updateStatus(els.fastbootStatus, "יש להתחבר קודם ל-Fastboot.", true);
    return;
  }

  const ok = window.confirm(
    "פתיחת Bootloader תמחק את כל הנתונים במכשיר. האם להמשיך?"
  );

  if (!ok) {
    appendLog("פתיחת Bootloader בוטלה ע" + "י המשתמש.", "WARN");
    return;
  }

  try {
    updateStatus(
      els.fastbootStatus,
      "שולח Unlock... אשרו במכשיר עם Volume Plus. מיד אחרי האישור: לחיצה ארוכה על Power + Volume Minus כדי לחזור ל-Fastboot."
    );

    try {
      await state.fastboot.runCommand("flashing unlock");
    } catch (_) {
      await state.fastboot.runCommand("flashing:unlock");
    }

    appendLog("פקודת unlock נשלחה. נדרש אישור ידני במכשיר.");
    updateStatus(
      els.fastbootStatus,
      "פקודת unlock נשלחה. אשרו עם Volume Plus, ואז לחיצה ארוכה על Power + Volume Minus וחיבור מחדש ל-Fastboot."
    );
  } catch (error) {
    updateStatus(els.fastbootStatus, `פתיחת Bootloader נכשלה: ${error.message}`, true);
    appendLog(`fastboot unlock נכשל: ${error.message}`, "ERROR");
  }
}

function extractProgressPercent(value) {
  if (typeof value === "number") {
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }

  if (value && typeof value === "object") {
    if (typeof value.progress === "number") {
      return value.progress <= 1 ? Math.round(value.progress * 100) : Math.round(value.progress);
    }

    if (
      typeof value.uploadedBytes === "number" &&
      typeof value.totalBytes === "number" &&
      value.totalBytes > 0
    ) {
      return Math.round((value.uploadedBytes / value.totalBytes) * 100);
    }
  }

  return 0;
}

async function downloadImageBlobWithProgress(url, onProgress) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`הורדת קובץ נכשלה (${response.status})`);
  }

  const total = Number.parseInt(response.headers.get("content-length") || "0", 10) || 0;
  if (!response.body || typeof response.body.getReader !== "function") {
    const blob = await response.blob();
    if (onProgress) {
      onProgress(1, 1);
    }
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    chunks.push(value);
    loaded += value.byteLength || value.length || 0;
    if (onProgress && total > 0) {
      onProgress(loaded, total);
    }
  }

  if (onProgress && total <= 0) {
    onProgress(1, 1);
  }

  return new Blob(chunks, { type: "application/octet-stream" });
}

async function performFlash(blobOrFile, sourceName, partition) {
  if (!state.fastboot) {
    updateStatus(els.flashStatus, "יש להתחבר קודם ב-Fastboot.", true);
    return false;
  }

  if (state.fastbootInfo?.unlocked !== "yes") {
    updateStatus(els.flashStatus, "ה-Bootloader נעול. יש לבצע unlock לפני צריבה.", true);
    return false;
  }

  const serial = getCurrentSerial();
  const needsUpdate = state.actionRecommendation?.type === "update-required";
  const record = serial ? state.deviceHistory[serial] : null;
  if (needsUpdate && !record?.steps?.updateInstalled) {
    updateStatus(
      els.flashStatus,
      "לפני צריבה צריך להשלים עדכון גרסה ידני ואז ללחוץ 'בדוק שוב גרסה ב-ADB'.",
      true
    );
    return false;
  }

  updateStatus(els.flashStatus, `מתחיל צריבה למחיצת ${partition}: ${sourceName}`);
  appendLog(`Starting flash ${partition} from ${sourceName}`);
  showProgress(true);
  setProgress(0);

  try {
    await state.fastboot.flashBlob(partition, blobOrFile, (progressInfo) => {
      setProgress(extractProgressPercent(progressInfo));
    });

    setProgress(100);
    updateStatus(els.flashStatus, "הצריבה הסתיימה בהצלחה.");
    appendLog("Flash finished successfully.");
    if (serial) {
      updateDeviceRecord(serial, (deviceRecord) => {
        deviceRecord.steps.bootloaderUnlocked = true;
        deviceRecord.steps.flashed = true;
      });
    }
    refreshButtons();
    return true;
  } catch (error) {
    updateStatus(els.flashStatus, `צריבה נכשלה: ${error.message}`, true);
    appendLog(`Flash failed: ${error.message}`, "ERROR");
    return false;
  }
}

async function handleAutoFlash() {
  const entry = getRecommendedFlashEntry();
  if (!entry) {
    updateStatus(
      els.flashStatus,
      "לא נמצא קובץ צריבה אוטומטי תואם לגרסה הנוכחית. אפשר להשתמש באפשרות ידנית.",
      true
    );
    return;
  }

  const url = resolveImageDownloadUrl(entry);
  if (!url) {
    updateStatus(els.flashStatus, "כתובת קובץ הצריבה לא תקינה.", true);
    return;
  }

  const sourceName = entry.imageFile || getFileNameFromUrl(url) || "boot.img";
  const partition = resolveFlashPartition(entry, sourceName);
  updateStatus(els.flashStatus, `מוריד קובץ צריבה מומלץ: ${sourceName}`);
  appendLog(`Downloading recommended image: ${sourceName} (${url})`);
  showProgress(true);
  setProgress(0);

  try {
    const blob = await downloadImageBlobWithProgress(url, (loaded, total) => {
      if (total > 0) {
        setProgress(Math.round((loaded / total) * 35));
      }
    });
    setProgress(40);
    await performFlash(blob, sourceName, partition);
  } catch (error) {
    updateStatus(els.flashStatus, `הורדת קובץ אוטומטי נכשלה: ${error.message}`, true);
    appendLog(`Auto image download failed: ${error.message}`, "ERROR");
  }
}

async function handleFlash() {
  const file = els.flashFile.files?.[0];
  if (!file) {
    updateStatus(els.flashStatus, "יש לבחור קובץ IMG לפני צריבה ידנית.", true);
    return;
  }

  const partition = detectFlashPartition(file.name);
  await performFlash(file, file.name, partition);
}

async function handleRebootDevice() {
  if (!state.fastboot) {
    updateStatus(els.fastbootStatus, "יש להתחבר קודם ל-Fastboot.", true);
    return;
  }

  try {
    await state.fastboot.reboot("");
    updateStatus(els.fastbootStatus, "נשלחה פקודת reboot למכשיר.");
    appendLog("Reboot command sent through fastboot.");
  } catch (error) {
    updateStatus(els.fastbootStatus, `reboot נכשל: ${error.message}`, true);
    appendLog(`fastboot reboot נכשל: ${error.message}`, "ERROR");
  }
}

function handleFileSelection() {
  const file = els.flashFile.files?.[0];
  if (file) {
    updateStatus(els.flashStatus, `קובץ נבחר: ${file.name}`);
  } else {
    updateStatus(els.flashStatus, "טרם בוצעה צריבה.");
  }

  refreshButtons();
}

function wireEvents() {
  els.preDevMode.addEventListener("change", (event) => setPreflightValue("devMode", event.target.checked));
  els.preDevOptions.addEventListener("change", (event) => setPreflightValue("devOptions", event.target.checked));
  els.preUsbDebug.addEventListener("change", (event) => setPreflightValue("usbDebug", event.target.checked));
  els.preOemUnlock.addEventListener("change", (event) => setPreflightValue("oemUnlock", event.target.checked));
  els.preRsa.addEventListener("change", (event) => setPreflightValue("rsa", event.target.checked));
  els.btnPreflightReset.addEventListener("click", resetPreflightChecklist);
  els.btnAutoContinue.addEventListener("click", handleAutoContinue);
  els.btnCheckUsb.addEventListener("click", handleCheckUsbMode);
  els.btnConnectAdb.addEventListener("click", handleConnectAdb);
  els.btnRebootBootloader.addEventListener("click", handleRebootToBootloader);
  els.btnRebootBootloaderFastboot.addEventListener("click", handleRebootToBootloader);
  els.btnPickDownloads.addEventListener("click", handlePickDownloadsFolder);
  els.btnFindUpdateZip.addEventListener("click", handleFindUpdateZip);
  els.btnPushUpdateZip.addEventListener("click", handlePushUpdateZip);
  els.btnMarkUpdateInstalled.addEventListener("click", handleMarkUpdateInstalled);
  els.btnDownloadUpdate.addEventListener("click", () => {
    const serial = getCurrentSerial();
    if (serial) {
      updateDeviceRecord(serial, (record) => {
        record.steps.updatePushed = true;
      });
    }
    updateStatus(els.pushStatus, "ההורדה התחילה. התקינו ידנית דרך Local install ואז לחצו 'בדוק שוב גרסה ב-ADB'.");
    appendLog("נלחץ כפתור הורדת ZIP עדכון.");
  });
  if (els.btnOpenUpdateGuide) {
    els.btnOpenUpdateGuide.addEventListener("click", () => {
      appendLog("נפתח דף הוראות עדכון ידני.");
    });
  }
  if (els.btnRecheckUpdate) {
    els.btnRecheckUpdate.addEventListener("click", handleRecheckUpdate);
  }
  els.btnConnectFastboot.addEventListener("click", handleConnectFastboot);
  els.btnRebootDeviceFastboot.addEventListener("click", handleRebootDevice);
  els.btnUnlock.addEventListener("click", handleUnlockBootloader);
  els.btnFlashAuto.addEventListener("click", handleAutoFlash);
  els.btnFlash.addEventListener("click", handleFlash);
  els.btnRebootDevice.addEventListener("click", handleRebootDevice);
  els.flashFile.addEventListener("change", handleFileSelection);
  els.btnClearLog.addEventListener("click", () => {
    els.logOutput.textContent = "";
  });
}

async function init() {
  if (!window.isSecureContext) {
    appendLog("האפליקציה חייבת לרוץ ב-HTTPS או localhost כדי להשתמש ב-WebUSB.", "ERROR");
    setActionMessage("צריך להריץ את האתר ב-HTTPS או localhost.", "error");
    els.btnCheckUsb.disabled = true;
    els.btnConnectAdb.disabled = true;
    els.btnConnectFastboot.disabled = true;
  } else {
    appendLog(`Secure context OK: ${window.location.origin}`);
  }

  updateStatus(els.downloadsStatus, "הכלי עובד במסלול עדכון ידני (ללא ADB push).");

  loadDeviceHistory();
  loadPreflightState();
  const knownCount = Object.keys(state.deviceHistory).length;
  if (knownCount > 0) {
    appendLog(`נטענה היסטוריית מכשירים: ${knownCount} רשומות.`);
  }

  wireEvents();
  if (els.btnOpenUpdateGuide) {
    els.btnOpenUpdateGuide.href = UPDATE_GUIDE_URL;
  }
  setSupportLink("");
  appendLog(`API mode active: ${ROM_BOOT_API_URL}`);
  await loadDeviceMap();
  renderPreflightChecklist();
  renderProgressTracker();
  refreshButtons();
  appendLog("הממשק מוכן. התחילו משלב 'בדיקת חיבור USB'.");
}

void init();
