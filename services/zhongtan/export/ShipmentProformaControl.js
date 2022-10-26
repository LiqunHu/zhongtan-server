const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ShipmentProformaServer')

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
    } else if (method === 'uploadShipment') {
      ret = await srv.uploadShipmentAct(req)
    } else if (method === 'importFreight') {
      ret = await srv.importFreightAct(req)
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
    } else if (method === 'getEmptyReleaseAgents') {
      ret = await srv.getEmptyReleaseAgentsAct(req)
    } else if (method === 'bookingDataSave') {
      ret = await srv.bookingDataSaveAct(req)
    } else if (method === 'bookingDataDelete') {
      ret = await srv.bookingDataDeleteAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
