const { Firestore } = require("@google-cloud/firestore");



const COLLECTION = "inventory_item_mapping";
const BATCH_SIZE=50;

const db = new Firestore({
    projectId:'solar-catfish-508808-p7'
})

async function saveMappings(mappings){
    if(!Array.isArray(mappings)){
        throw new Error("Mapping must be an array")
    }

    let saved = 0;

    for(let i =0 ; i<mappings.length; i+=BATCH_SIZE){
        const batch = db.batch();
        const items = mappings.slice(i, i+BATCH_SIZE);

        for(const item of items){
            const ref = db.collection(COLLECTION).doc(String(item.inventoryItemId));
            batch.set(ref, {
                inventoryItemId:String(item.inventoryItemId),
                variantId:String(item.variantId),
                productId:String(item.productId)
            },{
                merge:true
            })
        }
        await batch.commit();
        saved +=items.length;
        console.log(`[Inventory Mapping] saved ${saved}/${mappings.length}`)
    }
    return {saved}
}

async function getAllMappings(){
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data())
}
const inventoryItemFS ={
    saveMappings,
    getAllMappings
}
module.exports = inventoryItemFS