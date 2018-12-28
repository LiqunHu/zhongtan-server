const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./SailScheduleServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'add') {
      ret = await srv.addAct(req)
    } else if (method === 'delete') {
      ret = await srv.deleteAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    }
    return common.sendData(res, ret)
  } catch (error) {
    return common.sendFault(res, error)
  }
}