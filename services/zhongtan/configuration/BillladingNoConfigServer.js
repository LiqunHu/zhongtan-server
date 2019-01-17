const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
// const Op = model.Op

// const tb_billladingno_batch = model.zhongtan_billladingno_batch
// const tb_billladingno_pool = model.zhongtan_billladingno_pool

exports.initAct = async () => {
  let returnData = {
    VesselServiceINFO: GLBConfig.VesselServiceINFO,
    STATUSINFO: GLBConfig.STATUSINFO
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_billladingno_batch where '1' = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (billladingno_batch_fix_string like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  logger.debug('add success')
  return common.success(doc)
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  return common.success(doc)
}
