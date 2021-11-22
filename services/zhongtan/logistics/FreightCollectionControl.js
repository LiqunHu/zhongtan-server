const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./FreightCollectionServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if(method === 'export') {
      return await srv.exportAct(req, res)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if(method === 'getInvoiceData') {
      ret = await srv.getInvoiceDataAct(req)
    } else if(method === 'calculationInvoice') {
      ret = await srv.calculationInvoiceAct(req)
    } else if(method === 'freightInvoice') {
      ret = await srv.freightInvoiceAct(req)
    } else if (method === 'undoFreight') {
      ret = await srv.undoFreightAct(req)
    } else if(method === 'getExtraData') {
      ret = await srv.getExtraDataAct(req)
    } else if(method === 'freightExtra') {
      ret = await srv.freightExtraAct(req)
    } else if(method === 'editFreight') {
      ret = await srv.editFreightAct(req)
    } 

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
