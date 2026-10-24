const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { sapoGet } = require("../sapo.service");



async function getVariants({ page = 1, limit = 250 , locationId='', modifiedOnMin=''}) {
  const params = new URLSearchParams({
    page: page,
    limit: limit,
    location_ids:locationId,
    sort_direction:'desc',
    inventory_management:'bizweb',
    fields:'product',
    types:'normal',
    modified_on_min:modifiedOnMin
  });

  const data = await sapoGet(
    `/admin/variants.json?${params.toString()}`,
  );
  await sleep(config.sync.requestDelay);

  return Array.isArray(data?.variants) ? data.variants : [];
}
async function fetchBranchVariants(location) {
  const startedAt = Date.now();

  let page = 1;
  const variants = [];

  while (true) {
    const data = await getVariants({
      locationId: location.id,
      page,
      limit: config.sapo.productLimit,
    });

    variants.push(...data);

    if (data.length < config.sapo.productLimit) {
      break;
    }

    page++;
  }

  return {
    locationId: location.id,
    locationName: location.name,
    variants,
    total: variants.length,
    durationSeconds: Math.round(
      (Date.now() - startedAt) / 1000
    ),
  };
}

const variantService ={
    getVariants,
    fetchBranchVariants
}

module.exports = variantService