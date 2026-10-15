
// function normalizeVersion(value) {
//   const s = String(value ?? "").trim();
//   if (!s) return "";
//   if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
//     const ms = Date.parse(s);
//     if (!Number.isNaN(ms)) return String(ms);
//   }
//   return s;
// }
// function normalizeVersion(value) {
//   if (value == null || value === "") return "";

//   const s = String(value).trim();
//   if (!s) return "";

//   // Sapo: ISO UTC hoặc ISO có timezone
//   if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
//     const ms = Date.parse(s);
//     return Number.isNaN(ms) ? s : String(ms);
//   }

//   // Google Sheets: dd/MM/yyyy HH:mm:ss (UTC+7)
//   const match = s.match(
//     /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
//   );

//   if (match) {
//     const [, day, month, year, hour, minute, second = "00"] = match;

//     const pad = (v) => String(v).padStart(2, "0");

//     const iso =
//       `${year}-${pad(month)}-${pad(day)}T` +
//       `${pad(hour)}:${minute}:${second}+07:00`;

//     const ms = Date.parse(iso);

//     return Number.isNaN(ms) ? s : String(ms);
//   }

//   return s;
// }

function normalizeVersion(value) {
  if (value == null || value === "") return "";

  const s = String(value).trim();

  if (!s) return "";

  // 1. Unix timestamp milliseconds
  // Ví dụ: 1791794709000
  if (/^\d{13}$/.test(s)) {
    return s;
  }

  // 2. Google Sheets Serial Date
  // Ví dụ: 46307.65635416667
  if (/^\d{4,6}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s);

    // Google Sheets serial thể hiện thời gian theo
    // múi giờ của bảng tính (giả định UTC+7).
    const ms = Math.round(
      (serial - 25569) * 86400000 -
      7 * 60 * 60 * 1000
    );

    return String(Math.round(ms / 1000) * 1000);
  }

  // 3. ISO UTC hoặc ISO có timezone từ Sapo
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);

    return Number.isNaN(ms)
      ? s
      : String(Math.round(ms / 1000) * 1000);
  }

  // 4. Google Sheets: dd/MM/yyyy HH:mm:ss
  const match = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (match) {
    const [, day, month, year, hour, minute, second = "00"] = match;

    const pad = (v) => String(v).padStart(2, "0");

    const iso =
      `${year}-${pad(month)}-${pad(day)}T` +
      `${pad(hour)}:${minute}:${second}+07:00`;

    const ms = Date.parse(iso);

    return Number.isNaN(ms)
      ? s
      : String(ms);
  }

  return s;
}
function planUpsert(existing, items) {

  const latestById = new Map();
  for (const item of items) latestById.set(item.id, item);

  const plan = { inserts: [], updates: [], skipped: 0 };
  for (const item of latestById.values()) {
    const found = existing.get(item.id);
    if (!found) plan.inserts.push(item);
    else if (found.version === item.version) plan.skipped++;
    else plan.updates.push({ rowNo: found.rowNo, item });
  }
  return plan;
}

module.exports = { normalizeVersion, planUpsert };