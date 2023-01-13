const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ImportDemurrageStatisticsInvoiceServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'exportDemurrageReport') {
      return await srv.exportDemurrageReportAct(req, res)
    } else if (method === 'exportDemurrageAdminReport') {
      return await srv.exportDemurrageAdminReportAct(req, res)
    } else if (method === 'getConsignee') {
      ret = await srv.getConsigneeAct(req)
    } 
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
