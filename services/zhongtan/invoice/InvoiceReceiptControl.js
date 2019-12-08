const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./InvoiceReceiptServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'searchVoyage') {
      ret = await srv.searchVoyageAct(req)
    } else if (method === 'getMasterbiData') {
      ret = await srv.getMasterbiDataAct(req)
    } else if (method === 'getContainersData') {
      ret = await srv.getContainersDataAct(req)
    } else if (method === 'downloadReceipt') {
      ret = await srv.downloadReceiptAct(req)
    } else if (method === 'doRelease') {
      ret = await srv.doReleaseAct(req)
    } 

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
