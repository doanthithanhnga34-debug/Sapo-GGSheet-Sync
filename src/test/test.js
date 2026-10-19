async function* fetchAllProducts(sapoJson) {
  let prevFirst;
  for (let page = 1; page <= 500; page++) {
    const { products } = await sapoJson(`/admin/products.json?limit=250&page=${page}`);
    if (!products || products.length === 0) return;
    if (products[0].id === prevFirst) throw new Error('Phân trang trả lại cùng một trang');
    prevFirst = products[0].id;
    yield products;
    if (products.length < 250) return;
  }
}

async function fetchProductsByIds(sapoJson, ids) {
  const out = [];
  for (const part of chunk([...new Set(ids)], 250)) {
    const { products } = await sapoJson(`/admin/products.json?limit=250&ids=${part.join(',')}`);
    out.push(...products);
  }
  return out;
}