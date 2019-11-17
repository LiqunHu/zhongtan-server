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
    } else if (method === 'getVoyageDetail') {
      ret = await srv.getVoyageDetailAct(req)
    } else if (method === 'downloadDo') {
      return await srv.downloadDoAct(req, res)
    } else if (method === 'doRelease') {
      ret = await srv.doReleaseAct(req)
    }

    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
