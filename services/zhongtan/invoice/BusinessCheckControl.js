const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./BusinessCheckServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if(method === 'approve') {
      ret = await srv.approveAct(req)
    } else if(method === 'decline') {
      ret = await srv.declineAct(req)
    } else if(method === 'getInvoiceDetail') {
      ret = await srv.getInvoiceDetailAct(req)
    }

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
