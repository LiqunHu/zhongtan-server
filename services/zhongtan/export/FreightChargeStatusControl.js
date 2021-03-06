const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('../export/FreightChargeStatusServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'init') {
      ret = await srv.initAct(req)
    } else if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'exportFreight') {
      return await srv.exportFreightAct(req, res)
    } else if (method === 'upload') {
      ret = await srv.uploadAct(req)
    } else if (method === 'loadingListData') {
      ret = await srv.loadingListDataAct(req)
    } else if (method === 'loadingListData') {
      ret = await srv.loadingListDataAct(req)
    } else if (method === 'blPrint') {
      ret = await srv.blPrintAct(req)
    } else if (method === 'checkPassword') {
      ret = await srv.checkPasswordAct(req)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
