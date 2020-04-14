const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./CustomerFixedDepositServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'create') {
      ret = await srv.createAct(req)
    } else if (method === 'update') {
      ret = await srv.updateAct(req)
    } else if (method === 'invalid') {
      ret = await srv.invalidAct(req)
    } else if (method === 'invoice') {
      ret = await srv.invoiceAct(req)
    } else if (method === 'release') {
      ret = await srv.releaseAct(req)
    } else if (method === 'searchCustomer') {
      ret = await srv.searchCustomerAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
