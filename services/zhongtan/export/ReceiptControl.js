const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ReceiptServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'searchCustomer') {
      ret = await srv.searchCustomerAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'receipt') {
      ret = await srv.receiptAct(req)
    } else if (method === 'downdReceiptReport') {
      return await srv.downdReceiptReportAct(req, res)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
