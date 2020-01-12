const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./InvoiceServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'uploadImport') {
      ret = await srv.uploadImportAct(req)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'searchVoyage') {
      ret = await srv.searchVoyageAct(req)
    } else if (method === 'getMasterbiData') {
      ret = await srv.getMasterbiDataAct(req)
    } else if (method === 'getContainersData') {
      ret = await srv.getContainersDataAct(req)
    } else if (method === 'downloadDo') {
      ret = await srv.downloadDoAct(req)
    } else if (method === 'doRelease') {
      ret = await srv.doReleaseAct(req)
    } else if (method === 'searchCustomer') {
      ret = await srv.searchCustomerAct(req)
    } else if (method === 'depositDo') {
      ret = await srv.depositDoAct(req)
    } else if (method === 'changeCollect') {
      ret = await srv.changeCollectAct(req)
    }

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
