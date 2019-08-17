const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage

exports.initAct = async () => {
  let returnData = {
    VesselINFO: [],
    STATUSINFO: GLBConfig.STATUSINFO
  }

  let Vessels = await tb_vessel.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })

  for (let v of Vessels) {
    returnData.VesselINFO.push({
      id: v.vessel_id,
      text: v.vessel_name
    })
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_voyage where 1 = 1`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and voyage_number like ?'
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

  let voyage = await tb_voyage.findOne({
    where: {
      voyage_number: doc.voyage_number
    }
  })

  if (voyage) {
    return common.error('common_04')
  } else {
    let voyage = await tb_voyage.create({
      vessel_id: doc.vessel_id,
      voyage_number: doc.voyage_number,
      voyage_eta_date: doc.voyage_eta_date,
      voyage_atd_date: doc.voyage_atd_date
    })

    return common.success(voyage)
  }
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let voyage = await tb_voyage.findOne({
    where: {
      voyage_id: doc.old.voyage_id
    }
  })
  if (voyage) {
    voyage.vessel_id = doc.new.vessel_id
    voyage.voyage_number = doc.new.voyage_number
    voyage.voyage_eta_date = doc.new.voyage_eta_date
    voyage.voyage_atd_date = doc.new.voyage_atd_date
    voyage.state = doc.new.state

    await voyage.save()

    return common.success(voyage)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let voyage = await tb_voyage.findOne({
    where: {
      voyage_id: doc.voyage_id,
      state: GLBConfig.ENABLE
    }
  })
  if (voyage) {
    voyage.state = GLBConfig.DISABLE
    await voyage.save()

    return common.success()
  } else {
    return common.error('operator_03')
  }
}
