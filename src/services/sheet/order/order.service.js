/**
 * Thao tác dòng cho Google Sheets: chèn lên đầu bảng và xóa dòng.
 * Các hàm tạo yêu cầu (build*) là hàm thuần nên test được mà không cần gọi Google.
 *
 * LƯU Ý: dòng require lấy getSheetsClient ở cuối file. Nếu hàm này chưa được xuất ra từ sheet.service.js,
 * hãy thêm nó vào module.exports của sheet.service.js, hoặc sửa đường dẫn require cho đúng nơi bạn đang lấy nó.
 */

const sheetServices = require("../sheet.service")
function normalizeTitle(s) {
  return String(s ?? "").normalize("NFC").replace(/\u00a0/g, " ").trim().toLowerCase();
}

/** Giá trị -> ô Sheets. Ghi như "RAW": chuỗi vẫn là chuỗi, không bị Sheets tự đổi thành số/ngày. */
function toCellData(value) {
  if (value === null || value === undefined || value === "") return {};
  if (typeof value === "number" && Number.isFinite(value)) return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: String(value) } };
}

/** Chèn N dòng trống ngay dưới dòng tiêu đề VÀ ghi dữ liệu, trong cùng một yêu cầu (hoặc xong cả hai, hoặc không gì cả). */
function buildInsertTopRequests(sheetId, rows) {
  return [
    {
      insertDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 1 + rows.length },
        inheritFromBefore: false, // không thừa hưởng định dạng của dòng tiêu đề
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 1, columnIndex: 0 },
        rows: rows.map((r) => ({ values: r.map(toCellData) })),
        fields: "userEnteredValue",
      },
    },
  ];
}

/** rowNumbers là số dòng kiểu Sheets (dòng 1 = tiêu đề). Gộp dòng liền nhau, xóa từ DƯỚI LÊN để số dòng không bị dịch. */
function buildDeleteRowRequests(sheetId, rowNumbers) {
  for (const n of rowNumbers) {
    if (!Number.isInteger(n) || n < 2) {
      throw new RangeError(`Số dòng không hợp lệ để xóa: ${n} (dòng 1 là tiêu đề, không bao giờ được xóa)`);
    }
  }
  const sorted = [...new Set(rowNumbers)].sort((a, b) => a - b);
  const ranges = [];
  for (const n of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && n === last.end + 1) last.end = n;
    else ranges.push({ start: n, end: n });
  }
  return ranges.reverse().map(({ start, end }) => ({
    deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: start - 1, endIndex: end } },
  }));
}

function createRowOps(getClient) {
  async function resolveSheet(sheets, spreadsheetId, sheetName) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const all = meta.data.sheets.map((s) => s.properties);
    const found =
      all.find((p) => p.title === sheetName) ||
      all.find((p) => normalizeTitle(p.title) === normalizeTitle(sheetName));
    if (!found) {
      throw new Error(
        `Không tìm thấy tab ${JSON.stringify(sheetName)}. Các tab hiện có: ${all.map((p) => JSON.stringify(p.title)).join(", ")}`,
      );
    }
    return { sheetId: found.sheetId, title: found.title };
  }

  /**
   * Chèn các dòng lên ngay dưới tiêu đề. NHẬN MẢNG DÒNG (không phải số lượng) và tự ghi dữ liệu.
   * Trả về số dòng đã chèn.
   */
  async function insertRowsAtTop(sheetName, rows, spreadsheetId) {
    if (!Array.isArray(rows) || !rows.every(Array.isArray)) {
      throw new TypeError(
        `insertRowsAtTop cần một MẢNG các dòng (mỗi dòng là một mảng), nhưng nhận được: ${
          Array.isArray(rows) ? "mảng có phần tử không phải mảng" : typeof rows
        }`,
      );
    }
    if (rows.length === 0) return 0;
    const sheets = await sheetServices.getSheetsClient();
    const { sheetId } = await resolveSheet(sheets, spreadsheetId, sheetName);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: buildInsertTopRequests(sheetId, rows) },
    });
    return rows.length;
  }

  /**
   * Xóa HẲN các dòng trên Sheet. targets = [{ rowNo, id }].
   * Trước khi xóa, đọc lại cột A và kiểm tra mỗi dòng vẫn đúng ID mong đợi.
   * Nếu có dòng nào lệch (ai đó chèn/xóa/sắp xếp dòng) thì HỦY, không xóa gì.
   */
  async function deleteRowsVerified(sheetName, targets, spreadsheetId) {
    if (!Array.isArray(targets) || targets.length === 0) return 0;
    const sheets = await sheetServices.getSheetsClient();
    const { sheetId, title } = await resolveSheet(sheets, spreadsheetId, sheetName);

    // Dùng cùng chế độ đọc với getValues của bạn (mặc định là giá trị đã định dạng).
    // Nếu getValues của bạn dùng UNFORMATTED_VALUE thì thêm valueRenderOption tương ứng ở đây.
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title.replace(/'/g, "''")}'!A:A`,
    });
    const col = res.data.values || [];
    const mismatched = targets.filter((t) => String(col[t.rowNo - 1]?.[0] ?? "").trim() !== String(t.id).trim());
    if (mismatched.length > 0) {
      const sample = mismatched.slice(0, 3).map((t) => `dòng ${t.rowNo} (mong đợi ${t.id})`).join("; ");
      throw new Error(
        `Sheet đã thay đổi từ lúc đọc, ${mismatched.length} dòng không còn đúng ID. Hủy xóa, chưa xóa gì. Ví dụ: ${sample}`,
      );
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: buildDeleteRowRequests(sheetId, targets.map((t) => t.rowNo)) },
    });
    return targets.length;
  }

  return { insertRowsAtTop, deleteRowsVerified };
}

// require "lười" để file này test được mà không kéo theo cả sheet.service
const ops = createRowOps(() => require("../sheet.service").getSheetsClient());

module.exports = {
  insertRowsAtTop: ops.insertRowsAtTop,
  deleteRowsVerified: ops.deleteRowsVerified,
  createRowOps,
  buildInsertTopRequests,
  buildDeleteRowRequests,
  toCellData,
};
