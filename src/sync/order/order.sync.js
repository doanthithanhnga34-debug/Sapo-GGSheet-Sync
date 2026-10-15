const config = require("../../config/config");
const orderService = require("../../services/sapo/orders/orders.service");
const {
  formatDateTimeColumn,
  insertRowsAtTop,
} = require("../../services/sheet/cashFund/cashFund.service");
const sheetServices = require("../../services/sheet/sheet.service");
const orderSyncState = require("../../services/syncState/orderSyncState.service");
const { excludeOrder } = require("../../utils/filter.helper");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const { normalizeVersion, planUpsert } = require("../../utils/upsert.helper");
const orderMapper = require("./order.mapper");

const ID_COLUMN = 0;

function getTarget() {
  const headers = orderMapper.HEADERS;
  const updatedAtCol = headers.indexOf("Ngày cập nhật");
  if (updatedAtCol === -1) {
    throw new Error("No found ngày cập nhật column");
  }

  return {
    maxPages: 5,
    sheetName: String(config.sheetOrder.name).trim(),
    sheetId: config.sheetOrder.id,
    limit: config.sapo.orderLimit,
    headers,
    updatedAtCol,
    lastColumn: columnNumberToLetter(headers.length),
  };
}
let setupPromise = null;
function ensureSetup(t) {
  if (!setupPromise) {
    setupPromise = (async () => {
      await sheetServices.ensureSheet(
        t.sheetName,
        1000,
        t.headers.length,
        t.sheetId,
      );
      await sheetServices.ensureHeaders(t.sheetName, t.headers, t.sheetId);
      const orderDateCol = t.headers.indexOf("Ngày đặt hàng");
      const updateOrderDateCol = t.headers.indexOf("Ngày cập nhật");
      if (orderDateCol === -1) {
        throw new Error('Không tìm thấy cột "Ngày đặt hàng"');
      }
      if (updateOrderDateCol === -1) {
        throw new Error('Không tìm thấy cột "Ngày cập nhật"');
      }
      await formatDateTimeColumn(t.sheetName, orderDateCol, t.sheetId);
      await formatDateTimeColumn(t.sheetName, updateOrderDateCol, t.sheetId);
    })().catch((e) => {
      setupPromise = null;
      throw e;
    });
  }
  return setupPromise;
}

let busy = false;
async function exclusive(name, fn) {
  if (busy) {
    console.warn(`Bỏ qua ${name}: đang có một lượt đồng bộ khác chạy`);
    return { success: false, reason: "busy" };
  }
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}
async function markError(e) {
  console.error("Đồng bộ hóa đơn thất bại:", e.message);
  try {
    await orderSyncState.set({ status: "error" });
  } catch (stateError) {
    console.error("Không lưu được trạng thái lỗi:", stateError.message);
  }
}
function findDuplicateIds(values, idColumn = 0) {
  const seen = new Map(); // id -> danh sách số dòng
  let blankIds = 0;
  let scientificIds = 0;

  values.slice(1).forEach((row, i) => {
    const id = String(row[idColumn] ?? "").trim();
    const rowNo = i + 2;
    if (!id) {
      blankIds++;
      return;
    }
    // ID dạng 1.23457E+12 là dấu hiệu Sheets đã đổi ID số dài thành số khoa học (mất chữ số)
    if (/^\d+(\.\d+)?e\+?\d+$/i.test(id)) scientificIds++;
    const rows = seen.get(id);
    if (rows) rows.push(rowNo);
    else seen.set(id, [rowNo]);
  });

  const duplicates = [];
  for (const [id, rows] of seen) {
    if (rows.length < 2) continue;
    const first = JSON.stringify(values[rows[0] - 1]);
    duplicates.push({
      id,
      rows,
      sameContent: rows.every((r) => JSON.stringify(values[r - 1]) === first),
    });
  }

  return {
    totalRows: Math.max(values.length - 1, 0),
    uniqueIds: seen.size,
    blankIds,
    scientificIds,
    duplicateGroups: duplicates.length,
    extraRows: duplicates.reduce((sum, d) => sum + d.rows.length - 1, 0),
    duplicates,
  };
}
// ---------- Ghi log chi tiết các đơn được cập nhật / thêm mới ----------
// LOG_UPDATE_VALUES=true  -> in cả giá trị cũ -> mới. Mặc định chỉ in TÊN CỘT đã đổi (an toàn hơn với dữ liệu khách hàng).
// LOG_MASK_COLUMNS="Số điện thoại,Địa chỉ" -> các cột này luôn chỉ in tên cột, không in giá trị.
const LOG_UPDATE_VALUES = process.env.LOG_UPDATE_VALUES === "true";
const MASK_COLUMNS = new Set(
  (process.env.LOG_MASK_COLUMNS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const MAX_LOGGED = 20; // tối đa số đơn in chi tiết mỗi lượt, tránh tràn log khi quét lại toàn bộ

function shorten(value, max = 60) {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** So sánh hàng cũ trên Sheet với hàng mới, trả về danh sách cột khác nhau. So theo chuỗi nên 1000 và "1000" coi như giống nhau. */
function diffRow(headers, oldRow, newRow) {
  const changes = [];
  headers.forEach((column, i) => {
    const before = String(oldRow?.[i] ?? "");
    const after = String(newRow?.[i] ?? "");
    if (before !== after) changes.push({ column, before, after });
  });
  return changes;
}

function describeChange({ column, before, after }) {
  if (!LOG_UPDATE_VALUES || MASK_COLUMNS.has(column)) return column;
  return `${column}: "${shorten(before)}" → "${shorten(after)}"`;
}

function logPlan(t, plan, index) {
  const { updates, inserts, skipped } = plan;
  console.log(
    `[Đồng bộ] ${updates.length} đơn cần cập nhật, ${inserts.length} đơn mới, ${skipped} đơn không đổi`,
  );
  for (const { rowNo, item } of updates.slice(0, MAX_LOGGED)) {
    const changes = diffRow(t.headers, index.get(item.id)?.row, item.row);
    const detail =
      changes.map(describeChange).join("; ") || "(không có cột nào khác biệt)";
    console.log(`  Cập nhật ${item.id} @dòng ${rowNo}: ${detail}`);
  }
  if (updates.length > MAX_LOGGED)
    console.log(`  ... và ${updates.length - MAX_LOGGED} đơn cập nhật khác`);
  if (inserts.length > 0) {
    const shown = inserts
      .slice(0, MAX_LOGGED)
      .map((i) => i.id)
      .join(", ");
    const more =
      inserts.length > MAX_LOGGED
        ? ` ... và ${inserts.length - MAX_LOGGED} đơn khác`
        : "";
    console.log(`  Thêm mới: ${shown}${more}`);
  }
}
async function readSheet(t) {
  const values = await sheetServices.getValues(
    `'${t.sheetName}'!A:${t.lastColumn}`,
    t.sheetId,
  );

  const dup = findDuplicateIds(values, ID_COLUMN);
  console.log(
    `[Kiểm tra ID] ${dup.totalRows} dòng, ${dup.uniqueIds} ID khác nhau, ` +
      `${dup.duplicateGroups} ID trùng, ${dup.blankIds} ID trống, ${dup.scientificIds} ID dạng số khoa học`,
  );
  for (const d of dup.duplicates.slice(0, 10)) {
    console.warn(
      `  ID trùng ${d.id}: dòng ${d.rows.join(", ")} (${d.sameContent ? "giống hệt" : "KHÁC nhau"})`,
    );
  }
  if (dup.duplicates.length > 10) {
    console.warn(`  ... và ${dup.duplicates.length - 10} ID trùng khác`);
  }

  const index = new Map(); // id -> dòng cuối cùng có ID đó (dùng để cập nhật)
  const rowsById = new Map(); // id -> TẤT CẢ các dòng có ID đó (dùng để xóa)
  values.slice(1).forEach((row, i) => {
    const id = String(row[ID_COLUMN] ?? "").trim();
    if (!id) return;
    const rowNo = i + 2;
    index.set(id, {
      rowNo,
      version: normalizeVersion(row[t.updatedAtCol]),
      row,
    });
    const list = rowsById.get(id);
    if (list) list.push(rowNo);
    else rowsById.set(id, [rowNo]);
  });
  return { index, rowsById, nextRow: Math.max(values.length + 1, 2) };
}

async function toItems(t, orders) {
  const items = [];
  for (const order of orders) {
    const id = String(order.id ?? "").trim();
    if (!id) continue;
    const row = await orderMapper.orderToRow(order);
    items.push({ id, version: normalizeVersion(row[t.updatedAtCol]), row });
  }
  return items;
}

async function applyUpdates(t, updates) {
  if (updates.length === 0) return;
  await sheetServices.batchUpdateValues(
    updates.map(({ rowNo, item }) => ({
      range: `'${t.sheetName}'!A${rowNo}:${t.lastColumn}${rowNo}`,
      values: [item.row],
    })),
    t.sheetId,
  );
}

async function insertAtTop(t, rows) {
  if (rows.length === 0) return;
  await insertRowsAtTop(t.sheetName, rows, t.sheetId);
}

async function appendRows(t, rows, startRow) {
  if (rows.length === 0) return;
  const endRow = startRow + rows.length - 1;
  await sheetServices.ensureSheetSize(
    t.sheetName,
    endRow,
    t.headers.length,
    t.sheetId,
  );
  await sheetServices.updateValues(
    `'${t.sheetName}'!A${startRow}:${t.lastColumn}${endRow}`,
    rows,
    t.sheetId,
  );
}

function buildOrdersBatch() {
  return exclusive("buildOrdersBatch", async () => {
    const t = getTarget();
    const syncState = await orderSyncState.get();
    const page = Number(syncState.nextPage) || 1;

    try {
      await ensureSetup(t);
      const { index, nextRow: startRow } = await readSheet(t);

      const orders = await orderService.getOrders({ page, limit: t.limit });
      if (orders.length === 0) return { success: true, done: true };

      const kept = orders.filter((order) => !excludeOrder(order));
      const plan = planUpsert(index, await toItems(t, kept));

      await applyUpdates(t, plan.updates);
      await appendRows(
        t,
        plan.inserts.map((i) => i.row),
        startRow,
      );

      const done = orders.length < t.limit;
      await orderSyncState.set({
        nextPage: page + 1,
        status: done ? "done" : "idle",
      });

      return {
        success: true,
        done,
        page,
        nextPage: page + 1,
        totalOrders: orders.length,
        excluded: orders.length - kept.length,
        inserted: plan.inserts.length,
        updated: plan.updates.length,
        skipped: plan.skipped,
        startRow,
        nextRow: startRow + plan.inserts.length,
      };
    } catch (e) {
      await markError(e);
      throw e;
    }
  });
}

async function fetchPages(pageCount, limit) {
  const all = [];
  for (let page = 1; page <= pageCount; page++) {
    const orders = await orderService.getOrders({ page, limit });
    all.push(...orders);
    if (orders.length < limit) break;
  }
  return all;
}
async function incremental() {
  return exclusive("incremental", async () => {
    const t = getTarget();
    await ensureSetup(t);
    const { index } = await readSheet(t);

    // const orders = await orderService.getOrders({ page: 1, limit: t.limit });
    const orders = await fetchPages(t.maxPages, t.limit);
    const kept = orders.filter((order) => !excludeOrder(order));
    const plan = planUpsert(index, await toItems(t, kept));

    logPlan(t, plan, index);

    await applyUpdates(t, plan.updates);
    await insertAtTop(
      t,
      plan.inserts.map((i) => i.row),
    );

    return {
      success: true,
      totalOrders: orders.length,
      excluded: orders.length - kept.length,
      inserted: plan.inserts.length,
      updated: plan.updates.length,
      skipped: plan.skipped,
    };
  });
}

const orderSync = {
  buildOrdersBatch,
  incremental,
};
module.exports = orderSync;
