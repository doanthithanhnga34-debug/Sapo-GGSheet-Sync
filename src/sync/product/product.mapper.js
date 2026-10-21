const HEADERS = [
  "hss_unique_id",
  "Loại Hàng",
  "Nhóm Hàng",
  "Mã Hàng",
  "Tên Hàng",
  "Thương Hiệu",
  "Giá Bán",
  "Giá Vốn",
  "Tồn Kho",
  "KH Đặt",
  "Dự Kiến Hết",
  "Tồn Nhỏ Nhất",
  "Tồn Lớn Nhất",
  "Đơn Vị Tính",
  "Mã ĐVT Cơ Bản",
  "Quy Đổi",
  "Thuộc Tính",
  "Mã HH Liên Quan",
  "Hình Ảnh",
  "Trọng Lượng",
  "Tích Điểm",
  "Đang Kinh Doanh",
  "Được Bán Trực Tiếp",
  "Mô Tả",
  "Mẫu Ghi Chú",
  "Vị Trí",
  "Hàng Thành Phần",
  "Trạng Thái",
  "SYNC_HASH",
  "Ngày Tạo",
  "Ngày Cập Nhật",
];

const COLUMN_INDEX = Object.fromEntries(
  HEADERS.map((headers, index) => [headers, index]),
);

const SYNC_HEADERS = [
  "hss_unique_id",
  "Loại Hàng",
  "Nhóm Hàng",
  "Mã Hàng",
  "Tên Hàng",
  "Thương Hiệu",
  "Giá Bán",
  "Đơn Vị Tính",
  "Hình Ảnh",
  "Đang Kinh Doanh",
  "Mô Tả",
  "Trạng Thái",
  "Ngày Tạo",
  "Ngày Cập Nhật",
];

function toValue(value) {
  return value === null || value === undefined ? "" : value;
}

function getAttributes(variant) {
  const option = [variant.option1, variant.option2, variant.option3];
}
function generateUniqueId(variantId, locationId) {
  if (variantId == null || locationId == null) {
    throw new Error("Missing variantId or locationId");
  }

  return `${variantId}_${locationId}`;
}
function getImage(product, variant) {
  if (variant.image?.src) {
    return variant.image.src;
  }

  if (product.image?.src) {
    return product.image.src;
  }

  if (Array.isArray(product.images)) {
    return product.images[0]?.src ?? "";
  }

  return "";
}
function getProductGroup(productType) {
  if (!productType) return "";

  return String(productType).split(">>").pop().trim();
}
function stripHtml(html) {
  if (!html) return "";

  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
function mapVariantToRow(
  variant,
  locationId,
  product,
  inventoryItem,
  inventoryLevel,
) {
  if (!variant || !product) {
    throw new Error(`Missing variant or product: ${variant?.id}`);
  }

  if (!inventoryItem || !inventoryLevel) {
    throw new Error(
      `Missing inventory data for variant ${variant.id}, location ${locationId}`,
    );
  }
  const productData = variant.product || {};

  const row = Array(HEADERS.length).fill("");
  function set(header, value) {
    row[COLUMN_INDEX[header]] = toValue(value);
  }
  set("hss_unique_id", generateUniqueId(variant.id, locationId));
  set("Loại Hàng", "Hàng hóa");
  set("Nhóm Hàng", getProductGroup(productData.product_type));
  set("Mã Hàng", variant.sku || variant.barcode);
  set("Tên Hàng", productData.name);
  set("Thương Hiệu", productData.vendor);
  set("Giá Bán", variant.price);
  set("Giá Vốn", inventoryItem.cost_price);

  set("Tồn Kho", inventoryLevel.on_hand);

  set("Đơn Vị Tính", variant.unit);

  set("Hình Ảnh", getImage(product, variant));

  set("Đang Kinh Doanh", productData.status === "active");
  set("Mô Tả", stripHtml(product.content));
  set("Trạng Thái", productData.status);
  set("Ngày Tạo", variant.created_on);
  set("Ngày Cập Nhật", variant.modified_on);
  return row;
}

const productMapper = {
  COLUMN_INDEX,
  HEADERS,
  SYNC_HEADERS,
  mapVariantToRow,
};

module.exports = productMapper;
