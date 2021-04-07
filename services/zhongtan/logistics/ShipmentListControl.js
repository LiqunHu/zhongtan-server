const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ShipmentListServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'searchShipmentList') {
      ret = await srv.searchShipmentListAct(req)
    } else if(method === 'add') {
      ret = await srv.addAct(req)
    } else if(method === 'modify') {
      ret = await srv.modifyAct(req)
    } else if(method === 'export') {
      return await srv.exportAct(req, res)
    } else if (method === 'delete') {
      ret = await srv.deleteAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } 

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
