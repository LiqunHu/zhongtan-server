const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_billloading = model.zhongtan_billloading

exports.BookingResource = (req, res) => {
  let method = req.query.method
  if (method === 'init') {
    initAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function initAct(req, res) {
  try {
    let doc = common.docTrim(req.body)
    let user = req.user
    let returnData = {}
    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}
