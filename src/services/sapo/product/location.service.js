const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { sapoGet } = require("../sapo.service");

const SHEET_NAME_BY_LOCATION_ID = {
  925710: "Quận 10",
};
async function getAllLocations({
  page = 0,
  limit = 0,
  inventoryManagement = true,
}) {
  const params = new URLSearchParams();
  params.set("page", page);
  params.set("limit", limit);
  params.set("inventory_management", inventoryManagement);

  const data = await sapoGet(`/admin/locations.json?${params.toString()}`);
  await sleep(config.sync.requestDelay);

  return Array.isArray(data?.locations) ? data.locations : [];
}

function getSheetName(locationId, locationName) {
  return SHEET_NAME_BY_LOCATION_ID[String(locationId)] ?? locationName;
}

const locationService = {
  getAllLocations,
  getSheetName
};

module.exports = locationService;
