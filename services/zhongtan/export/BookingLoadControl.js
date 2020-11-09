const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./BookingLoadServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'uploadBooking') {
      ret = await srv.uploadBookingAct(req)
    } else if (method === 'searchVessel') {
      ret = await srv.searchVesselAct(req)
    } else if (method === 'searchBl') {
      ret = await srv.searchBlAct(req)
    } else if (method === 'searchContainer') {
      ret = await srv.searchContainerAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
