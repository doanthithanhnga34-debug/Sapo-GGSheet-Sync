const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { sapoGet } = require("../sapo.service");

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

const locationService ={
getAllLocations
}

module.exports = locationService