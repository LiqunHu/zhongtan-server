const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_portinfo = model.zhongtan_portinfo

exports.initAct = async () => {
  let returnData = {
    PortCountryINFO: GLBConfig.PortCountryINFO
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_portinfo where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (portinfo_name like ? or portinfo_name_cn like ? or portinfo_code like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let portinfo = await tb_portinfo.create({
    portinfo_country: doc.portinfo_country,
    portinfo_name: doc.portinfo_name,
    portinfo_name_cn: doc.portinfo_name_cn,
    portinfo_code: doc.portinfo_code
  })

  return common.success(portinfo)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let portinfo = await tb_portinfo.findOne({
    where: {
      portinfo_id: doc.old.portinfo_id,
      state: GLBConfig.ENABLE
    }
  })
  if (portinfo) {
    portinfo.portinfo_country = doc.new.portinfo_country
    portinfo.portinfo_name = doc.new.portinfo_name
    portinfo.portinfo_name_cn = doc.new.portinfo_name_cn
    portinfo.portinfo_code = doc.new.portinfo_code

    await portinfo.save()

    return common.success(portinfo)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let portinfo = await tb_portinfo.findOne({
    where: {
      portinfo_id: doc.portinfo_id,
      state: GLBConfig.ENABLE
    }
  })
  if (portinfo) {
    portinfo.state = GLBConfig.DISABLE
    await portinfo.save()

    return common.success()
  } else {
    return common.error('operator_03')
  }
}
