const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_discharge_port = model.zhongtan_discharge_port

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_discharge_port where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (discharge_port_code like ? or discharge_port_name like ?)'
    let search_text = '%' + doc.search_text + '%'
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

  let addObj = await tb_discharge_port.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ discharge_port_name: doc.discharge_port_name }, { discharge_port_code: doc.discharge_port_code }]
    }
  })
  if (addObj) {
    return common.error('discharge_port_02')
  }

  let obj = await tb_discharge_port.create({
    discharge_port_name: doc.discharge_port_name,
    discharge_port_code: doc.discharge_port_code
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_discharge_port.findOne({
    where: {
      discharge_port_id: doc.old.discharge_port_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_discharge_port.findOne({
      where: {
        discharge_port_id: {[Op.ne]: doc.old.discharge_port_id},
        [Op.or]: [{ discharge_port_name: doc.new.discharge_port_name }, { discharge_port_code: doc.new.discharge_port_code }]
      }
    })
    if (updateObj) {
      return common.error('discharge_port_02')
    }

    obj.discharge_port_name = doc.new.discharge_port_name
    obj.discharge_port_code = doc.new.discharge_port_code
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('discharge_port_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_discharge_port.findOne({
    where: {
      discharge_port_id: doc.discharge_port_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('discharge_port_01')
  }
}
