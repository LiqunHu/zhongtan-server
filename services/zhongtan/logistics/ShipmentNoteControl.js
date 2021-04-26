const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ShipmentNoteServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'searchShipmentList') {
      ret = await srv.searchShipmentListAct(req)
    } else if(method === 'add') {
      ret = await srv.addAct(req)
    } else if(method === 'modify') {
      ret = await srv.modifyAct(req)
    } else if(method === 'export') {
      return await srv.exportAct(req, res)
    } else if (method === 'delete') {
      ret = await srv.deleteAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'applyPaymentSearch') {
      ret = await srv.applyPaymentSearchAct(req)
    } else if (method === 'applyPayment') {
      ret = await srv.applyPaymentAct(req)
    } else if (method === 'undoPayment') {
      ret = await srv.undoPaymentAct(req)
    } else if(method === 'paymentBalanceEdit') {
      ret = await srv.paymentBalanceEditAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if(method === 'applyPaymentExtra') {
      ret = await srv.applyPaymentExtraAct(req)
    } 

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
