const ediMail = require('./ediMail')
const schedule_srv = require('./ScheduleServer')

module.exports = {
  readEdiMail: ediMail.readEdiMail,
  resetDemurrageReceiptSeq: schedule_srv.resetDemurrageReceiptSeq,
  calculationCurrentOverdueDays: schedule_srv.calculationCurrentOverdueDays,
  expireFixedDepositCheck: schedule_srv.expireFixedDepositCheck ,
  importEmptyStockContainer : schedule_srv.importEmptyStockContainer
}
