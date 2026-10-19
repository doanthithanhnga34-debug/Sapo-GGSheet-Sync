

'use strict'

const chunk = (arr,size) =>{
    Array.from({length:Math.ceil(arr.length / size)}, (_,i)=> arr.slice( i* size, i*size +size));
}

const toApiTime = (date) =>{
    new Date(date).toISOString().replace(/\.\d{3}Z$/,'Z')
}