const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { sapoGet } = require("../sapo.service");

async function getVariantByLocation({ page = 1, limit = 250 , locationId=''}) {
  const params = new URLSearchParams({
    page: page,
    limit: limit,
    location_ids:locationId,
    sort_direction:'desc',
    inventory_management:'bizweb',
    fields:'product',
    types:'normal'
  });

  const data = await sapoGet(
    `/admin/products.json?${params.toString()}`,
  );
  await sleep(config.sync.requestDelay);

  return Array.isArray(data?.products) ? data.products : [];
}

const productServices = { getVariantByLocation };
module.exports = productServices;
