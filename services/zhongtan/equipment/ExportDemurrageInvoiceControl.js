const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ExportDemurrageInvoiceServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'calculation') {
      ret = await srv.calculationAct(req)
    } else if (method === 'demurrageCalculationSave') {
      ret = await srv.demurrageCalculationSaveAct(req)
    } else if (method === 'searchCustomer') {
      ret = await srv.searchCustomerAct(req)
    } else if (method === 'demurrageInvoice') {
      ret = await srv.demurrageInvoiceAct(req)
    } else if (method === 'demurrageReInvoice') {
      ret = await srv.demurrageReInvoiceAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } else if (method === 'actuallyOverdueCopy') {
      ret = await srv.actuallyOverdueCopyAct(req)
    } else if (method === 'containerInvoiceDetail') {
      ret = await srv.containerInvoiceDetailAct(req)
    } else if (method === 'issuingStoringOrder') {
      ret = await srv.issuingStoringOrderAct(req)
    } else if (method === 'ediCalculationSave') {
      ret = await srv.ediCalculationSaveAct(req)
    } else if (method === 'getInvoiceSelection') {
      ret = await srv.getInvoiceSelectionAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
