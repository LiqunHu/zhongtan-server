const common = require('../../util/CommonUtil.js')
const logger = require('../../app/logger').createLogger(__filename)
const srv = require('./AuthServer')

module.exports = async (req, res) => {
  try {
    let method = common.reqTrans(req, __filename)
    let ret = 'common_01'
    logger.debug(method)
    if (method === 'signin') {
      ret = await srv.signinAct(req)
    } else if (method === 'signinBySms') {
      ret = await srv.signinBySmsAct(req)
    } else if (method === 'signinByWx') {
      ret = await srv.signinByWxAct(req)
    } else if (method === 'signout') {
      ret = await srv.signoutAct(req)
    } else if (method === 'sms') {
      ret = await srv.smsAct(req)
    } else if (method === 'captcha') {
      ret = await srv.captchaAct(req)
    }
    return common.sendData(res, ret)
  } catch (error) {
    return common.sendFault(res, error)
  }
}
