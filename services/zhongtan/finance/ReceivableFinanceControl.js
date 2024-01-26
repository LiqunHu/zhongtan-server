const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ReceivableFinanceServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'queryReceivable') {
      ret = await srv.queryReceivableAct(req)
    } else if (method === 'submitReceivable') {
      ret = await srv.submitReceivableAct(req)
    } else if (method === 'skip2Received') {
      ret = await srv.skip2ReceivedAct(req)
    } else if (method === 'queryReceived') {
        ret = await srv.queryReceivedAct(req)
    } else if (method === 'submitReceivedBankInfo') {
        ret = await srv.submitReceivedBankInfoAct(req)
    } else if (method === 'submitReceived') {
        ret = await srv.submitReceivedAct(req)
    } else if (method === 'watchU8Receviable') {
      ret = await srv.watchU8ReceviableAct(req)
    } else if (method === 'queryComplete') {
      ret = await srv.queryCompleteAct(req)
    } else if (method === 'watchU8Receved') {
      ret = await srv.watchU8ReceviedAct(req)
    } else if (method === 'watchU8SplitReceved') {
      ret = await srv.watchU8SplitReceviedAct(req)
    } else if (method === 'submitSplitReceived') {
      ret = await srv.submitSplitReceivedAct(req)
    } else if (method === 'syncU8Receivable') {
      ret = await srv.syncU8ReceivableAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'removeReceivable') {
      ret = await srv.removeReceivableAct(req)
    } else if (method === 'removeReceived') {
      ret = await srv.removeReceivedAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
