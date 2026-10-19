const  fireStore  = require("@google-cloud/firestore");
const fs = require("./index.firestore");

const db = new fireStore({
    projectId:'solar-catfish-508808-p7'
})

const COLLECTION = 'location'
const DOCUMENT ='locationId'

async function get(){
    return fs.getDocument(COLLECTION,DOCUMENT)
}

async function set(locationId,data={}){
    return fs.setDocument(COLLECTION,locationId,data)
}

const locationFS = {
    get,
    set
}

module.exports = locationFS