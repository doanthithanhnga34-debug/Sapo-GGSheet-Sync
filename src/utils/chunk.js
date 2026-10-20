

'use strict'


function chunk(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}


const toApiTime = (date) =>{
    new Date(date).toISOString().replace(/\.\d{3}Z$/,'Z')
}

module.exports ={
    chunk,
    toApiTime
}