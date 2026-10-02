const config = require("../../config/config");
const { buildSheetCustomerIndex } = require("../../sheet/buildSheet");
const { appendValue, updateValues } = require("../../sheet/sheet.service");
const { customerToRow } = require("./customer.mapper");


async function compareCustomersWithSheet(customers, sheetName){
    const sheetMap = await buildSheetCustomerIndex(sheetName);

    const added =[];
    const updated =[];
    const unchanged =[];package
    for(const customer of customers){
        const row = await customerToRow(customer);
        const id = String(row[0]);
        const newHash = String(row[16]);
        const existing = sheetMap.get(id);

        if(!existing){
            added.push({
                id,
                row,
            })
            continue;
        }

        if(existing.hash !== newHash){
            updated.push({
                id,
                rowNumber:
                existing.rowNumber,
                row,
            })
            continue;
        }
        unchanged.push(id);
    }
    return {
        added,
        updated,
        unchanged
    }
}

async function writeAddedCustomers(sheetName, added){
    if(!added.length){
        return;
    }
    const rows = added.map(item => item.row);
    await appendValue(`'${sheetName}'!A:Q`,
        rows
    );
    console.log(`Customer added = ${rows.length}`)
}

async function writeUpdatedCustomers(sheetName, updated){
    for(const item of updated){
        await updateValues(`'${sheetName}'!A${item.rowNumber}:Q${item.rowNumber}`, [item.row], config.ggSheetCustomer.sheetID);
    }
    console.log(`Customer update = ${updated.length}`);
}

async function writeUpdatedCustomers( sheetName, updated){
   const BATCH_SIZE = 250;
   for(let i=0; i<updated.length; i+=BATCH_SIZE){
    const batch = updated.slice(i,i+BATCH_SIZE);
    
   }
}