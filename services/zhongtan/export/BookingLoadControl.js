const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./BookingLoadServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'uploadBooking') {
      ret = await srv.uploadBookingAct(req)
    } else if (method === 'searchVessel') {
      ret = await srv.searchVesselAct(req)
    } else if (method === 'searchBl') {
      ret = await srv.searchBlAct(req)
    } else if (method === 'searchContainer') {
      ret = await srv.searchContainerAct(req)
    } else if (method === 'modifyVessel') {
      ret = await srv.modifyVesselAct(req)
    } else if (method === 'deleteVessel') {
      ret = await srv.deleteVesselAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'getEmptyReleaseData') {
      ret = await srv.getEmptyReleaseDataAct(req)
    } else if (method === 'getEmptyReleaseAgents') {
      ret = await srv.getEmptyReleaseAgentsAct(req)
    } else if (method === 'emptyRelease') {
      ret = await srv.emptyReleaseAct(req)
    } else if (method === 'bookingDataSave') {
      ret = await srv.bookingDataSaveAct(req)
    } else if (method === 'bkCancellationFeeSave') {
      ret = await srv.bkCancellationFeeSave(req)
    } else if (method === 'frimBooking') {
      ret = await srv.frimBookingAct(req)
    } else if (method === 'bookingExport') {
      return await srv.bookingExportAct(req, res)
    } else if (method === 'deleteBooking') {
      ret = await srv.deleteBookingAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
