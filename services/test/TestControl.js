const common = require('../../util/CommonUtil')
const logger = require('../../app/logger').createLogger(__filename)
const srv = require('./TestServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'search2') {
      ret = await srv.search2Act(req)
    } else if (method === 'search3') {
      ret = await srv.search3Act(req)
    } else if (method === 'search4') {
      ret = await srv.search4Act(req)
    } else if (method === 'search5') {
      ret = await srv.search5Act(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
