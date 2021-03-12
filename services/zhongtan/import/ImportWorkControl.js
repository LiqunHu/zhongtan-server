const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ImportWorkServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'uploadImport') {
      ret = await srv.uploadImportAct(req)
    } else if (method === 'searchCustomer') {
      ret = await srv.searchCustomerAct(req)
    } else if (method === 'assignCustomer') {
      ret = await srv.assignCustomerAct(req)
    } else if (method === 'exportMBL') {
      return await srv.exportMBLAct(req, res)
    } else if (method === 'exportCBL') {
      return await srv.exportCBLAct(req, res)
    } else if (method === 'downloadBL') {
      return await srv.downloadBLAct(req, res)
    } else if (method === 'released') {
      ret = await srv.releasedAct(req, res)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'exportShipmentList') {
      return await srv.exportShipmentListAct(req, res)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
