const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./EmptyStockManagementServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'saveContainer') {
      ret = await srv.saveContainerAct(req)
    } else if (method === 'exportEmptyStock') {
      return await srv.exportEmptyStockAct(req, res)
    } else if (method === 'refreshSizeType') {
      return await srv.refreshEmptyStockSizeTypeAct(req, res)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
