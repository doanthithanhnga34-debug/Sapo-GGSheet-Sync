const config = require("../../../../config/config");
const sheetServices = require("../../sheet.service");

const SHEET_NAME = "SyncLog";
const spreadsheetId = config.sheetProduct.id;

const HEADERS = [
  "Run ID",
  "Thời gian bắt đầu",
  "Chi nhánh",
  "Trạng thái",
  "Modified on min",
  "Variants",
  "Thêm mới",
  "Cập nhật",
  "Bỏ qua",
  "Thời gian",
  "Thông báo lỗi",
];

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function ensureSyncLogSheet() {
  await sheetServices.ensureSheet(
    SHEET_NAME,
    1000,
    HEADERS.length,
    spreadsheetId,
  );
  await sheetServices.ensureHeaders(SHEET_NAME, HEADERS, spreadsheetId);
  await sheetServices.ensureSheetSize(
    SHEET_NAME,
    1000,
    HEADERS.length,
    spreadsheetId,
  );
}

async function writeSyncLog({
  runId,
  locationId,
  locationName,
  status,
  modifiedOnMin = "",
  modifiedVariants = 0,
  inserted = 0,
  updated = 0,
  skipped = 0,
  durationSeconds = 0,
  error = "",
}) {
  const row = [
    runId,
    formatDate(),
    locationName,
    status,
    modifiedOnMin,
    modifiedVariants,
    inserted,
    updated,
    skipped,
    Number(durationSeconds.toFixed(3)),
    error,
  ];

  await sheetServices.appendValue(`'${SHEET_NAME}'!A:N`, [row], spreadsheetId);
}

const KEEP_LATEST_RUNS = 2;

async function cleanUpOldSyncLogs() {
  const values = await sheetServices.getValues(
    `'${SHEET_NAME}'!A2:K`,
    spreadsheetId,
  );

  const rows = Array.isArray(values) ? values : (values?.values ?? []);
  const runIds = [];
  const seen = new Set();

  for (const row of rows) {
    const runId = String(row[0] ?? "").trim();
    if (!runId || seen.has(runId)) continue;
    seen.add(runId);
    runIds.push(runId);
  }

  const keepIds = new Set(runIds.slice(-KEEP_LATEST_RUNS));
  const rowsToDelete = [];
  rows.forEach((row, index) => {
    const runId = String(row[0] ?? "").trim();
    if (runId && !keepIds.has(runId)) {
      rowsToDelete.push(index + 2);
    }
  });

  if (rowsToDelete.length === 0) {
    return {
      deleted: 0,
      keptRuns: keepIds.size,
    };
  }
  const deleted = await sheetServices.deleteRowsBatch(
    rowsToDelete,
    SHEET_NAME,
    spreadsheetId,
  );
  return {
    deleted,
    keptRuns: keepIds.size,
  };
}
async function appendRunSeparator(runId) {
  const row = [
    `RUN:${runId}`,
    new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    }),
    "START SYNC",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  await sheetServices.appendValue(
    "'SyncLog'!A:K",
    [row],
    config.sheetProduct.id,
  );
}

const logService = {
  ensureSyncLogSheet,
  writeSyncLog,
  cleanUpOldSyncLogs,
  appendRunSeparator,
};
module.exports = logService;
