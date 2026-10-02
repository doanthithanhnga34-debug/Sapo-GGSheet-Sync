const config = require("../../config/config");
const { getCashFunds } = require("../../sapo/castFund/cashFund.service");
const {
  formatDateTimeColumn,
  insertRowsAtTop,
} = require("../../sheet/cashFund/cashFund.service");
const {
  getCashFundSyncState,
  setCashFundSyncState,
} = require("../../sheet/cashFund/cashFundSyncState.service");
const {
  ensureSheet,
  ensureHeaders,
  ensureSheetSize,
  updateValues,
  getValues,
} = require("../../sheet/sheet.service");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const { cashFundToRow, HEADERS_CASH_FUND } = require("./cashFund.mapper");

async function buildCashFund() {
  const page = 15;
  const limit = config.sapo.cashFundLimit;
  console.log("page, limit", page, limit);
  const data = await getCashFunds({ page, limit });
  if (!data.length) {
    return {
      success: true,
      done: true,
      page,
      message: "Data is empty",
    };
  }

  const rows = [];
  data.forEach((item) => {
    const row = cashFundToRow(item);
    rows.push(row);
  });

  const sheetName = config.ggSheetCashFund.cashFundSheetName;
  const startRow = (page - 1) * limit + 2;
  const endRow = startRow + rows.length - 1;

  await ensureSheet(
    sheetName,
    1000,
    HEADERS_CASH_FUND.length,
    config.ggSheetCashFund.sheetID,
  );
  await ensureHeaders(
    sheetName,
    HEADERS_CASH_FUND,
    config.ggSheetCashFund.sheetID,
  );

  const voucherDateIndex = HEADERS_CASH_FUND.indexOf("Ngày ghi nhận");
  if (voucherDateIndex === -1) {
    throw new Error(`Not found column voucher date`);
  }
  await formatDateTimeColumn(
    sheetName,
    voucherDateIndex,
    config.ggSheetCashFund.sheetID,
  );
  await ensureSheetSize(
    sheetName,
    endRow,
    HEADERS_CASH_FUND.length,
    config.ggSheetCashFund.sheetID,
  );

  const lastColumn = columnNumberToLetter(HEADERS_CASH_FUND.length);

  await updateValues(
    `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
    rows,
    config.ggSheetCashFund.sheetID,
  );

  console.log(`cash fund page = ${page}, wrote = ${rows.length}`);
  return {
    success: true,
    page,
    nextPage: page + 1,
    rows: rows,
    startRow,
    endRow,
  };
}

async function buildBatchCashFund() {
  const limit = config.sapo.cashFundLimit;

  const syncState = await getCashFundSyncState();
  console.log("sync_state", syncState);
  const page = Number(syncState.nextPage) || 0;

  try {
    const cashFunds = await getCashFunds({ page, limit });
    console.log(`cash fund ${cashFunds.length}`);

    if (!cashFunds.length) {
      return {
        success: true,
        done: true,
      };
    }

    const rows = [];
    for (const cashFund of cashFunds) {
      const row = cashFundToRow(cashFund);
      if (!Array.isArray(row) || row.length !== HEADERS_CASH_FUND.length) {
        throw new Error(
          `Data cashFund is not matched ${HEADERS_CASH_FUND.length}`,
        );
      }
      rows.push(row);
    }
    const sheetName = String(config.ggSheetCashFund.cashFundSheetName).trim();
    const sheetID = config.ggSheetCashFund.sheetID;
    const startRow = (page - 1) * limit + 2;
    const endRow = startRow + rows.length - 1;
    await ensureSheet(
      sheetName,
      Math.max(endRow, 1000),
      HEADERS_CASH_FUND.length,
      sheetID,
    );
    await ensureHeaders(sheetName, HEADERS_CASH_FUND, sheetID);
    const voucherDateIndex = HEADERS_CASH_FUND.indexOf("Ngày ghi nhận");
    if (voucherDateIndex === -1) {
      throw new Error(`Not found column voucher date`);
    }
    await formatDateTimeColumn(sheetName, voucherDateIndex, sheetID);
    await ensureSheetSize(sheetName, endRow, HEADERS_CASH_FUND.length, sheetID);

    const lastColumn = columnNumberToLetter(HEADERS_CASH_FUND.length);

    await updateValues(
      `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
      rows,
      sheetID,
    );
    console.log(`cash fund page = ${page}, wrote = ${rows.length}`);

    const done = cashFunds.length < limit;

    await setCashFundSyncState({
      nextPage: page + 1,
      status: done ? "done" : "idle",
    });
    return {
      success: true,
      done,
      page,
      nextPage: page + 1,
      cashFund: cashFunds.length,
      rows: rows.length,
      startRow,
      endRow,
    };
  } catch (e) {
    await setCashFundSyncState({
      status: "error",
    });
    throw e;
  }
}

async function buildAddRowOnTopSheet() {
  const limit = config.sapo.cashFundLimit;

  const syncState = await getCashFundSyncState();
  console.log("sync_state", syncState);
  const page = Number(syncState.nextPage) || 0;

  try {
    const cashFunds = await getCashFunds({ page, limit });
    console.log(`cash fund ${cashFunds.length}`);

    if (!cashFunds.length) {
      return {
        success: true,
        done: true,
      };
    }

    const rows = [];
    for (const cashFund of cashFunds) {
      const row = cashFundToRow(cashFund);
      if (!Array.isArray(row) || row.length !== HEADERS_CASH_FUND.length) {
        throw new Error(
          `Data cashFund is not matched ${HEADERS_CASH_FUND.length}`,
        );
      }
      rows.push(row);
    }
    const sheetName = String(config.ggSheetCashFund.cashFundSheetName).trim();
    const sheetID = config.ggSheetCashFund.sheetID;
    const startRow = (page - 1) * limit + 2;
    const endRow = startRow + rows.length - 1;
    await ensureSheet(
      sheetName,
      Math.max(endRow, 1000),
      HEADERS_CASH_FUND.length,
      sheetID,
    );
    await ensureHeaders(sheetName, HEADERS_CASH_FUND, sheetID);
    const voucherDateIndex = HEADERS_CASH_FUND.indexOf("Ngày ghi nhận");
    if (voucherDateIndex === -1) {
      throw new Error(`Not found column voucher date`);
    }
    await formatDateTimeColumn(sheetName, voucherDateIndex, sheetID);
    await ensureSheetSize(sheetName, endRow, HEADERS_CASH_FUND.length, sheetID);

    const lastColumn = columnNumberToLetter(HEADERS_CASH_FUND.length);

    await insertRowsAtTop(sheetName, rows, sheetID);
    console.log(`cash fund page = ${page}, wrote = ${rows.length}`);

    const done = cashFunds.length < limit;

    await setCashFundSyncState({
      nextPage: page + 1,
      status: done ? "done" : "idle",
    });
    return {
      success: true,
      done,
      page,
      nextPage: page + 1,
      cashFund: cashFunds.length,
      rows: rows.length,
      startRow,
      endRow,
    };
  } catch (e) {
    await setCashFundSyncState({
      status: "error",
    });
    throw e;
  }
}

async function buildCashFundIdSet() {
  const sheetName = config.ggSheetCashFund.cashFundSheetName;
  const spreadsheetId = config.ggSheetCashFund.sheetID;

  const idIndex = HEADERS_CASH_FUND.indexOf("ID");

  if (idIndex === -1) {
    throw new Error("Not found ID column");
  }

  const idColumn = columnNumberToLetter(idIndex + 1);
  const values = await getValues(
    `'${sheetName}'!${idColumn}2:${idColumn}`,
    spreadsheetId,
  );
  const ids = new Set();
  for (const row of values || []) {
    const id = String(row[0] ?? "");
    if (id) {
      ids.add(id);
    }
  }
  console.log(`Existing cash fund IDs = ${ids.size}`);
  return ids;
}
async function incrementalCashFundSync() {
  const limit = config.sapo.cashFundLimit;
  const sheetName = config.ggSheetCashFund.cashFundSheetName;
  const spreadsheetId = config.ggSheetCashFund.sheetID;
  const state = await getCashFundSyncState();
  const runStartedAt = new Date().toISOString();

  const checkpoint =
    state.lastVoucherDate ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const voucherDateMin = new Date(
    new Date(checkpoint).getTime() - 60 * 60 * 1000,
  ).toISOString();
  const voucherDateMax = runStartedAt;
  console.log(
    `cash fund incremental min=${voucherDateMin}, max=${voucherDateMax}`,
  );

  const existingIds = await buildCashFundIdSet();

  const newItems = [];
  let page = 1;
  let totalSapo = 0;
  let totalSkip = 0;

  while (true) {
    const cashFunds = await getCashFunds({
      page,
      limit,
      voucherDateMin,
      voucherDateMax,
    });
    console.log(`cash fund page=${page}, count=${cashFunds.length}`);
    if (!cashFunds.length) {
      break;
    }
    totalSapo += cashFunds.length;

    for (const cashFund of cashFunds) {
      const id = String(cashFund.id ?? "").trim();
      if (!id) {
        continue;
      }
      if (existingIds.has(id)) {
        totalSkip++;
        continue;
      }
      console.log(
        `new bill id=${id}, code=${cashFund}, date=${cashFund.voucher_date}`,
      );
      newItems.push({
        id,
        voucherDate: cashFund.voucher_date,
        row: cashFundToRow(cashFund),
      });
      existingIds.add(id);
    }
    if (cashFunds.length < limit) {
      break;
    }
    page++;
  }
  newItems.sort((a, b) => new Date(b.voucherDate) - new Date(a.voucherDate));
  const newRows = newItems.map((item) => item.row);
  if (newRows.length > 0) {
    await insertRowsAtTop(sheetName, newRows, spreadsheetId);
  }
  await setCashFundSyncState({
    lastVoucherDate: runStartedAt,
    status: "idle",
  });
  console.log(
    `[CASH FUND DONE] ` +
      `sapo=${totalSapo}, ` +
      `added=${newRows.length}, ` +
      `skip=${totalSkip}`,
  );

  return {
    success: true,
    voucherDateMin,
    voucherDateMax,
    sapo: totalSapo,
    added: newRows.length,
    skipped: totalSkip,
  };
}
module.exports = {
  buildCashFund,
  buildBatchCashFund,
  incrementalCashFundSync,
   buildCashFundIdSet
};
