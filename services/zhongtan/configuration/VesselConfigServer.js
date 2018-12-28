const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const Op = model.Op

const tb_vessel = model.zhongtan_vessel

exports.initAct = async () => {
  let returnData = {
    VesselServiceINFO: GLBConfig.VesselServiceINFO
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_vessel where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (vessel_name like ? or vessel_operator like ? or vessel_code like ?)'
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

  let vessel = await tb_vessel.findOne({
    where: {
      [Op.or]: [{ vessel_name: doc.vessel_name }, { vessel_code: doc.vessel_code }]
    }
  })

  if (vessel) {
    return common.error('common_02')
  } else {
    vessel = await tb_vessel.create({
      vessel_service_name: doc.vessel_service_name,
      vessel_name: doc.vessel_name,
      vessel_operator: doc.vessel_operator,
      vessel_code: doc.vessel_code
    })

    return common.success(vessel)
  }
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let vessel = await tb_vessel.findOne({
    where: {
      vessel_id: doc.old.vessel_id,
      state: GLBConfig.ENABLE
    }
  })
  if (vessel) {
    vessel.vessel_service_name = doc.new.vessel_service_name
    vessel.vessel_name = doc.new.vessel_name
    vessel.vessel_operator = doc.new.vessel_operator
    vessel.vessel_code = doc.new.vessel_code

    await vessel.save()

    return common.success(vessel)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let vessel = await tb_vessel.findOne({
    where: {
      vessel_id: doc.vessel_id,
      state: GLBConfig.ENABLE
    }
  })
  if (vessel) {
    vessel.state = GLBConfig.DISABLE
    await vessel.save()

    return common.success()
  } else {
    return common.error('common_03')
  }
}
