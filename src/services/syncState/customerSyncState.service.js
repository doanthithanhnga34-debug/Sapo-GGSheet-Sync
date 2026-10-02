const config = require("../../config/config");
const {
  ensureSheet,
  ensureHeaders,
  getValues,
  updateValues,
} = require("../sheet/sheet.service");

const SHEET_NAME_SYNC_STATE = "SYNC_STATE";
const sheetID = config.ggSheetCustomer.sheetID;

async function ensureCustomerSyncState() {
  await ensureSheet(SHEET_NAME_SYNC_STATE, 20, 2, sheetID);
  await ensureHeaders("SYNC_STATE", ["Key", "Value"], sheetID);
}

async function get() {
  await ensureCustomerSyncState();

  const values = await getValues(`'${SHEET_NAME_SYNC_STATE}'!A2:B20`, sheetID);

  const map = new Map();

  for (const row of values || []) {
    const key = String(row[0] ?? "").trim();

    const value = String(row[1] ?? "").trim();

    if (!key) continue;

    map.set(key, value);
  }

  const rawNextPage = Number(map.get("nextPage") || 1);

  const rawReconcilePage = Number(map.get("reconcilePage") || 1);

  const nextPage =
    Number.isInteger(rawNextPage) && rawNextPage >= 1 ? rawNextPage : 1;

  const reconcilePage =
    Number.isInteger(rawReconcilePage) && rawReconcilePage >= 1
      ? rawReconcilePage
      : 1;

  const state = {
    nextPage,
    reconcilePage,
    lastModifiedOn: map.get("lastModifiedOn") || "",
    status: map.get("status") || "idle",
    lastRunAt: map.get("lastRunAt") || "",
  };

  console.log("[STATE 4] parsed state", state);

  return state;
}
async function set(changes = {}) {
  const current = await get();

  const state = {
    ...current,
    ...changes,
    lastRunAt: new Date().toISOString(),
  };

  const nextPage = Number(state.nextPage);
  if (!Number.isInteger(nextPage) || nextPage < 1) {
    throw new Error("nextPage is integer > 1");
  }

  const reconcilePage = Number(state.reconcilePage);

  await updateValues(
    `'${SHEET_NAME_SYNC_STATE}'!A1:B6`,
    [
      ["KEY", "VALUE"],
      ["nextPage", String(nextPage)],
      ["reconcilePage", String(reconcilePage)],
      ["lastModifiedOn", state.lastModifiedOn],
      ["status", state.status],
      ["lastRunAt", new Date().toISOString()],
    ],
    config.ggSheetCustomer.sheetID,
  );
  return state;
}

async function resetCustomerSyncState() {
  return set({
    nextPage: 1,
    lastModifiedOn: "",
    status: "idle",
  });
}

async function markCustomerSyncStateDone() {
  return set({
    status: "done",
  });
}


const customerSyncState = {
  get,
  set,
  resetCustomerSyncState,
  markCustomerSyncStateDone,
};

module.exports = customerSyncState;
