const common = require('../../../util/CommonUtil')
const srv = require('./ShipmentReleaseServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'searchBookingData') {
      ret = await srv.searchBookingDataAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'getBookingShipment') {
      ret = await srv.getBookingShipmentAct(req)
    } else if (method === 'getShipmentFeeAmount') {
      ret = await srv.getShipmentFeeAmountAct(req)
    } else if (method === 'saveShipment') {
      ret = await srv.saveShipmentAct(req)
    } else if (method === 'removeShipment') {
      ret = await srv.removeShipmentAct(req)
    } else if (method === 'submitShipment') {
      ret = await srv.submitShipmentAct(req)
    } else if (method === 'undoShipment') {
      ret = await srv.undoShipmentAct(req)
    } else if (method === 'invoiceShipment') {
      ret = await srv.invoiceShipmentAct(req)
    } else if (method === 'resetShipment') {
      ret = await srv.resetShipmentAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
