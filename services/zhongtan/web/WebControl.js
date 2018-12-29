const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const srv = require('./WebServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'getHomePageBoard') {
      ret = await srv.getHomePageBoardAct(req)
    } else if (method === 'getMessages') {
      ret = await srv.getMessagesAct(req)
    } else if (method === 'getSchedule') {
      ret = await srv.getScheduleAct(req)
    } else if (method === 'getArticle') {
      ret = await srv.getArticleAct(req)
    }
    common.sendData(res, ret)
  } catch (error) {
    common.sendFault(res, error)
  }
}
