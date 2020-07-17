const ediMail = require('./ediMail')
const demurrageReceipt = require('./demurrageReceipt')

module.exports = {
  readEdiMail: ediMail.readEdiMail,
  resetDemurrageReceiptSeq: demurrageReceipt.resetDemurrageReceiptSeq,
  calculationCurrentOverdueDays: demurrageReceipt.calculationCurrentOverdueDays 
}
