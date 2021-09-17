const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ExportStatisticsServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'searchForwarder') {
      ret = await srv.searchForwarderAct(req)
    } else if (method === 'exportStatistics') {
      return await srv.exportStatisticsAct(req, res)
    }
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
