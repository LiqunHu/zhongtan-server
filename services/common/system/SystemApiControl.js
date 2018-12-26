const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./SystemApiServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'addFolder') {
      ret = await srv.addFolderAct(req)
    } else if (method === 'modifyFolder') {
      ret = await srv.modifyFolderAct(req)
    } else if (method === 'addMenu') {
      ret = await srv.addMenuAct(req)
    } else if (method === 'modifyMenu') {
      ret = await srv.modifyMenuAct(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
