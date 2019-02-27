const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./BookingWorkServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'modify') {
      ret = await srv.modifyAct(req)
    } else if (method === 'cancel') {
      ret = await srv.cancelAct(req)
    } else if (method === 'searchShipper') {
      ret = await srv.searchShipperAct(req)
    } else if (method === 'searchVoyage') {
      ret = await srv.searchVoyageAct(req)
    } else if (method === 'confirmBooking') {
      ret = await srv.confirmBookingAct(req)
    } else if (method === 'confirmPickUp') {
      ret = await srv.confirmPickUpAct(req)
    } else if (method === 'rejectLoading') {
      ret = await srv.rejectLoadingAct(req)
    } else if (method === 'submitCustoms') {
      ret = await srv.submitCustomsAct(req)
    } else if (method === 'loadingPermission') {
      ret = await srv.loadingPermissionAct(req)
    } else if (method === 'sendCDS') {
      ret = await srv.sendCDSAct(req)
    } else if (method === 'sendBL') {
      ret = await srv.sendBLAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
