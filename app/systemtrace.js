const model = require('./model')
const logger = require('./logger').createLogger(__filename)

// tables
const tb_common_userlog = model.common_userlog

module.exports = async (req, res, next) => {
  try {
    let user = req.user
    let patha = req.path.split('/')
    let func = patha[patha.length - 2].toUpperCase()
    let method = patha[patha.length - 1]
    if (func !== 'AUTH' && method !== 'init' && method.search(/search/i) < 0 && method.search(/upload/i) < 0 && user) {
      tb_common_userlog.create({
        user_id: user.user_id,
        api_function: func,
        userlog_method: method,
        userlog_para: JSON.stringify(req.body)
      })
    }
  } catch (error) {
    logger.error(error)
  }
  next()
}
