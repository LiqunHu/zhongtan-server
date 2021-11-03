const schedule_srv = require('./ScheduleServer')

module.exports = {
  readEdiMailSchedule: schedule_srv.readEdiMailSchedule,
  readBookingMailSchedule: schedule_srv.readBookingMailSchedule,
  resetDemurrageReceiptSeq: schedule_srv.resetDemurrageReceiptSeq,
  calculationCurrentOverdueDays: schedule_srv.calculationCurrentOverdueDays,
  expireFixedDepositCheck: schedule_srv.expireFixedDepositCheck ,
  importEmptyStockContainer : schedule_srv.importEmptyStockContainer,
  resetPaymentAdviceNo : schedule_srv.resetPaymentAdviceNo,
  calculationExportShipmentFee : schedule_srv.calculationExportShipmentFee
}
