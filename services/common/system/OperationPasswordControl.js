const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./OperationPasswordServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'searchPage') {
      ret = await srv.searchPageAct(req)
    } else if (method === 'add') {
      ret = await srv.addAct(req)
    } else if (method === 'modify') {
      ret = await srv.modifyAct(req)
    } else if (method === 'delete') {
      ret = await srv.deleteAct(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
