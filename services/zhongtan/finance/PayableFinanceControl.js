const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./PayableFinanceServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'queryPayable') {
      ret = await srv.queryPayableAct(req)
    } else if (method === 'submitPayable') {
      ret = await srv.submitPayableAct(req)
    } else if (method === 'queryPayment') {
        ret = await srv.queryPaymentAct(req)
    } else if (method === 'submitPayment') {
        ret = await srv.submitPaymentAct(req)
    } else if (method === 'watchU8Payable') {
      ret = await srv.watchU8PayableAct(req)
    } else if (method === 'queryComplete') {
      ret = await srv.queryCompleteAct(req)
    } else if (method === 'watchPayment') {
      ret = await srv.watchPaymentAct(req)
    } else if (method === 'submitPayableVesselInfo') {
      ret = await srv.submitPayableVesselInfoAct(req)
    }
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
