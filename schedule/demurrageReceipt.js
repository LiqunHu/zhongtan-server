const model = require('../app/model')

const resetDemurrageReceiptSeq = async () => {
  try{
    let queryStr = `UPDATE seqmysql SET currentValue = 0 WHERE seqname IN ('COSCOEquipmentReceiptSeq', 'OOCLEquipmentReceiptSeq');`
    let replacements = []
    await model.simpleUpdate(queryStr, replacements)
  } finally {
    // continue regardless of error
  }
}

module.exports = {
  resetDemurrageReceiptSeq: resetDemurrageReceiptSeq
}