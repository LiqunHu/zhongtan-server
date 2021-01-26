const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_allot_depot = model.zhongtan_allot_depot

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT edi_depot_id, edi_depot_name FROM tbl_zhongtan_edi_depot WHERE state = ? AND edi_depot_is_wharf = ? ORDER BY edi_depot_name`
  let replacements = [GLBConfig.ENABLE, GLBConfig.DISABLE]
  let depots = await model.simpleSelect(queryStr, replacements)
  returnData.allotRules = {
    'COSCO': [],
    'OOCL': [],
  }
  if(depots) {
    for(let d of depots) {
      returnData.allotRules.COSCO.push({
        depot_name: d.edi_depot_name,
        depot_percent: 0
      })
      returnData.allotRules.OOCL.push({
        depot_name: d.edi_depot_name,
        depot_percent: 0
      })
    }
  }
  
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_zhongtan_allot_depot where state = "1" '
  let replacements = []
  queryStr += ' order by allot_depot_enabled desc'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let ap of result.data) {
    delete ap.user_password
    returnData.rows.push(ap)
  }

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let ad = await tb_allot_depot.findOne({
    where: {
      allot_depot_enabled: doc.allot_depot_enabled
    }
  })
  if (ad) {
    ad.allot_depot_rules = doc.allot_depot_rules
    await ad.save()
  } else {
    await tb_allot_depot.create({
      allot_depot_enabled: doc.allot_depot_enabled,
      allot_depot_rules: doc.allot_depot_rules
    })
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let queryStr = 'select * from tbl_zhongtan_allot_depot where state = "1" and allot_depot_id <> ? and allot_depot_enabled = ? '
  let replacements = [doc.allot_depot_id, doc.allot_depot_enabled]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length > 0) {
    return common.error('allot_depot_02')
  }else {
    let ad = await tb_allot_depot.findOne({
      where: {
        allot_depot_id: doc.allot_depot_id
      }
    })
    if (ad) {
      ad.allot_depot_enabled = doc.allot_depot_enabled
      ad.allot_depot_rules = doc.allot_depot_rules
      await ad.save()
      return common.success()
    } else {
      return common.error('allot_depot_01')
    }
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let ad = await tb_allot_depot.findOne({
    where: {
      allot_depot_id: doc.allot_depot_id
    }
  })
  if (ad) {
    ad.state = GLBConfig.DISABLE
    await ad.save()
    return common.success()
  } else {
    return common.error('allot_depot_01')
  }
}
