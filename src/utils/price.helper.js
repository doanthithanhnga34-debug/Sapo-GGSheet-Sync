function normalizePrice(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`[Price] Invalid value: ${value}`);
  }

  return Math.round(number);
}

module.exports = {
  normalizePrice,
};