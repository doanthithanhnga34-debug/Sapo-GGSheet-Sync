

function subtractMinutes(isoDate, minutes) {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid checkpoint date: ${isoDate}`);
  }

  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function getLatestModifiedOn(customers, fallback) {
  let latest = fallback || "";
  let latestTime = latest ? Date.parse(latest) : 0;

  for (const customer of customers) {
    const value = customer.modified_on;
    if (!value) {
      continue;
    }
    const time = Date.parse(value);

    if (Number.isFinite(time) && time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }
  return latest;
}

function subtractMonthFromISO(isoString, months=1){
  const date = new Date(isoString);

  if(Number.isNaN(date.getTime())){
    throw new Error(`Invalid date: ${isoString}`);
  }

  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth()-months);

  const lastDayOfMonth = new Date( Date.UTC(date.get))
}

function formatNumberAmount(value){
  return Number(value).toLocaleString('en-US')
}
module.exports ={
    subtractMinutes,
    getLatestModifiedOn,
    formatNumberAmount
}