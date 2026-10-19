const config = require("../../config/config");
const locationFS = require("../../services/firestore/location.firestore");
const locationService = require("../../services/sapo/product/location.service");
const productServices = require("../../services/sapo/product/product.service");

async function buildLocations() {
  const data = await locationService.getAllLocations({
    page: 0,
    limit: config.sapo.limit,
  });
  const locations = data.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  await Promise.all(
    locations.map((location) =>
      locationFS.set(String(location.id), location)
    )
  )
  return locations;
}

async function buildProductSync() {
  const page = 1;
  const limit = config.sapo.limit;

  const products = await productServices.getProducts({ page, limit });

  console.log("Products", products);
}

const productSync = {
  buildProductSync,
  buildLocations,
};

module.exports = productSync;
