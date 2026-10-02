const config = require("../../config/config");
const {
  getCustomer,
  getCustomers,
} = require("../../sapo/customers/customer.service");

const {
  getCustomerSyncState,
  saveCustomerSyncState,
  markCustomerSyncStateDone,
} = require("../../sheet/customerSyncState.service");
const {
  clearRange,
  updateValues,
  getValues,
  ensureSheetSize,
  ensureHeaders,
  ensureSheet,
  appendValue,
} = require("../../sheet/sheet.service");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const { customerToRow, HEADERS } = require("./customer.mapper");

async function buildOneCustomer(id) {
  const customerId = String(id ?? "").trim();

  const customer = await getCustomer(customerId);
  const row = await customerToRow(customer);
  if (!Array.isArray(row) || row.length !== HEADERS.length) {
    throw new Error(`Data customer is not matched ${HEADERS.length} cột`);
  }

  console.log(`customer test successfully, number of column  = ${row.length}`);
  return {
    customer: customer,
    row,
  };
}

async function testWriteOneCustomerToSheet(id) {
  const customerId = String(id ?? "").trim();
  const baseNameSheet = config.ggSheetCustomer?.customerSheetName;
  const { row } = await buildOneCustomer(customerId);

  const cells = row.map((value, index) => {
    if (value == null) return "";

    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return value;
    }
    throw new Error(`Invalid value at column ${HEADERS[index]}`);
  });

  const sheetName = `${baseNameSheet.trim()} TEST`;
  const escapedName = sheetName.replace(/'/g, "''");
  const range = `'${escapedName}'!A1:P2`;

  await updateValues(range, [HEADERS, cells], config.ggSheetCustomer.sheetID);
  return {
    success: true,
    customerId,
    sheetName,
    range,
    customersWritten: 1,
    totalColumns: cells.length,
  };
}

async function syncAllCustomers() {
  const limit = config.sapo.customerLimit;
  let totalWritten = 0;
  let syncState = await getCustomerSyncState();
  let page = syncState.nextPage;
  console.log(`Customer resume from page = ${page}`);
  const sheetName = config.ggSheetCustomer.customerSheetName;
  await ensureSheet(
    sheetName,
    1000,
    HEADERS.length,
    config.ggSheetCustomer.sheetID,
  );
  await ensureHeaders(sheetName, HEADERS, config.ggSheetCustomer.sheetID);

  while (true) {
    const customers = await getCustomers({page, limit, sortKey:"id"});
    if (!customers.length) {
      break;
    }

    const rows = [];

    for (const customer of customers) {
      const row = await customerToRow(customer);
      if (!Array.isArray(row) || row.length !== HEADERS.length) {
        throw new Error("Number of columns is not match with HEADERS");
      }
      rows.push(row);
    }

    const startRow = (page - 1) * limit + 2;
    const endRow = startRow + rows.length - 1;

    await ensureSheetSize(
      sheetName,
      endRow,
      HEADERS.length,
      config.ggSheetCustomer.sheetID,
    );

    await updateValues(
      `'${sheetName}'!A${startRow}:Q${endRow}`,
      rows,
      config.ggSheetCustomer.sheetID,
    );

    console.log(`Customer page = ${page}, wrote=${rows.length}`);
    await saveCustomerSyncState({
      nextPage: page + 1,
      status: "running",
    });
    totalWritten += rows.length;
    if (customers.length < limit) {
      break;
    }
    page++;
  }
  await markCustomerSyncStateDone();
  return {
    success: true,
    totalWritten,
    nextPage: page,
  };
}
async function buildBatchCustomerSync() {
  const limit = config.sapo.customerLimit;

  const syncState = await getCustomerSyncState();

  console.log("sync_state", syncState);
  const page = Number(syncState.nextPage || 1);
  console.log(`Customer start batch page =${page}, limit =${limit}`);

  try {
    await saveCustomerSyncState({
      status: "running",
    });
    const customers = await getCustomers({ page, limit, sortKey:"id" });
    if (!customers.length) {
      await markCustomerSyncStateDone();
      return {
        success: true,
        done: true,
        page,
        customerCount: 0,
        message: "Customer full sync completed",
      };
    }

    const rows = [];
    for (const customer of customers) {
      const row = await customerToRow(customer);
      if (!Array.isArray(row) || row.length !== HEADERS.length) {
        throw new Error(`Data customer is not matched ${HEADERS.length}`);
      }
      rows.push(row);
    }
    const sheetName = String(config.ggSheetCustomer.customerSheetName).trim();
    const sheetID = String(config.ggSheetCustomer.sheetID);
    const startRow = (page - 1) * limit + 2;
    const endRow = startRow + rows.length - 1;
    await ensureSheet(
      sheetName,
      Math.max(endRow, 1000),
      HEADERS.length,
      sheetID,
    );
    await ensureHeaders(sheetName, HEADERS, sheetID);
    await ensureSheetSize(sheetName, endRow, HEADERS.length, sheetID);

    const lastColumn = columnNumberToLetter(HEADERS.length);

    await updateValues(
      `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
      rows,
      config.ggSheetCustomer.sheetID,
    );

    console.log(`[customer] page =${page}, wrote = ${rows.length}`);

    const done = customers.length < limit;
    await saveCustomerSyncState({
      page: page,
      nextPage: page + 1,
      status: done ? "done" : "idle",
    });

    return {
      success: true,
      done,
      page,
      nextPage: page + 1,
      customerCount: customers.length,
      rows: rows,
      startRow,
      endRow,
    };
  } catch (e) {
    await saveCustomerSyncState({
      status: "error",
    });
    throw e;
  }
}
async function buildCustomerIdIndex() {
  const sheetName =
    config.ggSheetCustomer.customerSheetName;

  const spreadsheetId =
    config.ggSheetCustomer.sheetID;

  const lastColumn =
    columnNumberToLetter(
      HEADERS.length
    );

  const values =
    await getValues(
      `'${sheetName}'!A2:${lastColumn}`,
      spreadsheetId
    );

  const idIndex =
    HEADERS.indexOf(
      "Mã khách hàng"
    );

  const hashIndex =
    HEADERS.indexOf(
      "Sync_hash"
    );

  if (idIndex === -1) {
    throw new Error(
      "Not found Mã khách hàng"
    );
  }

  if (hashIndex === -1) {
    throw new Error(
      "Not found Sync_hash"
    );
  }

  const index = new Map();
  const duplicates = [];

  values.forEach((row, i) => {
    const id =
      String(
        row[idIndex] ?? ""
      ).trim();

    if (!id) {
      return;
    }

    const sheetRow =
      i + 2;

    const hash =
      String(
        row[hashIndex] ?? ""
      ).trim();

    if (index.has(id)) {
      duplicates.push({
        id,
        firstRow:
          index.get(id).row,
        duplicateRow:
          sheetRow,
      });

      return;
    }

    index.set(id, {
      row: sheetRow,
      hash,
    });
  });

  return {
    index,
    duplicates,
  };
}
async function continueCustomerBatchSync() {
  const limit = config.sapo.customerLimit;

  const syncState =
    await getCustomerSyncState();

  const page =
    Number(syncState.nextPage) || 391;

  console.log(
    `Continue customer sync page=${page}`
  );

  // Build lại index sau khi đã delete duplicate
  const { index } =
    await buildCustomerIdIndex();

  const customers =
    await getCustomers({
      page,
      limit,
      sortKey:"id"
    });

  if (!customers.length) {
    await saveCustomerSyncState({
      status: "done",
    });

    return {
      success: true,
      done: true,
      page,
      message: "Customer full sync completed",
    };
  }

  const missingCustomers =
    customers.filter(customer => {
      const id =
        String(customer.id ?? "").trim();

      return id && !index.has(id);
    });

  console.log(
    `page=${page}, sapo=${customers.length}, missing=${missingCustomers.length}`
  );

  const rows = [];

  for (const customer of missingCustomers) {
    console.log(
      `[NEW CUSTOMER] id=${customer.id}, name=${customer.name || ""}`
    );

    const row =
      await customerToRow(customer);

    rows.push(row);
  }

  if (rows.length > 0) {
    const sheetName =
      config.ggSheetCustomer.customerSheetName;

    const lastColumn =
      columnNumberToLetter(
        HEADERS.length
      );

    await appendValue(
      `'${sheetName}'!A:${lastColumn}`,
      rows,
      config.ggSheetCustomer.sheetID
    );

    console.log(
      `Appended ${rows.length} customers`
    );
  }

  const done =
    customers.length < limit;

  await saveCustomerSyncState({
    nextPage: page + 1,
    status: done
      ? "done"
      : "idle",
  });

  return {
    success: true,
    done,
    page,
    nextPage: page + 1,
    sapoCount: customers.length,
    added: rows.length,
  };
}
module.exports = {
  buildOneCustomer,
  testWriteOneCustomerToSheet,
  buildBatchCustomerSync,
  syncAllCustomers,
  buildCustomerIdIndex,
  continueCustomerBatchSync
};
