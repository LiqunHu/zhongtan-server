const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./ObsFileServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'search') {
      ret = await srv.searchAct(req)
    } else if (method === 'createFolder') {
      ret = await srv.createFolderAct(req)
    } else if (method === 'saveFiles') {
      ret = await srv.saveFilesAct(req)
    } else if (method === 'uploadFile') {
      ret = await srv.uploadFileAct(req)
    } else if (method === 'changeAuth') {
      ret = await srv.changeAuthAct(req)
    } else if (method === 'downloadFile') {
      return await srv.downloadFileAct(req, res)
    } else if (method === 'searchAdmin') {
      ret = await srv.searchAdminAct(req)
    } else if (method === 'downloadFileAdmin') {
      return await srv.downloadFileAdminAct(req, res)
    } 
    
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
