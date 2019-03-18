const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./BookingServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'booking') {
      ret = await srv.bookingAct(req)
    } else if (method === 'modify') {
      ret = await srv.modifyAct(req)
    } else if (method === 'searchVoyage') {
      ret = await srv.searchVoyageAct(req)
    } else if (method === 'cancel') {
      ret = await srv.cancelAct(req)
    } else if (method === 'pickUpEmpty') {
      ret = await srv.pickUpEmptyAct(req)
    } else if (method === 'submitloading') {
      ret = await srv.submitloadingAct(req)
    } else if (method === 'clearanceOfGoods') {
      ret = await srv.clearanceOfGoodsAct(req)
    } else if (method === 'shippingInstruction') {
      ret = await srv.shippingInstructionAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'downloadBooking') {
      return await srv.downloadBookingAct(req, res)
    }
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
