const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_edi_depot = model.zhongtan_edi_depot

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_edi_depot where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and edi_depot_name like ?'
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

  let addObj = await tb_edi_depot.findOne({
    where: {
      state : GLBConfig.ENABLE,
      edi_depot_name: doc.edi_depot_name
    }
  })
  if (addObj) {
    return common.error('edi_depot_02')
  }

  let obj = await tb_edi_depot.create({
    edi_depot_name: doc.edi_depot_name,
    edi_depot_sender_email: doc.edi_depot_sender_email,
    edi_depot_cnt_regex: doc.edi_depot_cnt_regex,
    edi_depot_dmt_regex: doc.edi_depot_dmt_regex,
    edi_depot_dmt_format: doc.edi_depot_dmt_format,
    edi_depot_storing_order_email: doc.new.edi_depot_storing_order_email
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_edi_depot.findOne({
    where: {
      edi_depot_id: doc.old.edi_depot_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_edi_depot.findOne({
      where: {
        edi_depot_id: {[Op.ne]: doc.old.edi_depot_id},
        edi_depot_name: doc.new.edi_depot_name
      }
    })
    if (updateObj) {
      return common.error('edi_depot_02')
    }

    obj.edi_depot_name = doc.new.edi_depot_name
    obj.edi_depot_sender_email = doc.new.edi_depot_sender_email
    obj.edi_depot_cnt_regex = doc.new.edi_depot_cnt_regex
    obj.edi_depot_dmt_regex = doc.new.edi_depot_dmt_regex
    obj.edi_depot_dmt_format = doc.new.edi_depot_dmt_format
    obj.edi_depot_storing_order_email = doc.new.edi_depot_storing_order_email
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('edi_depot_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_edi_depot.findOne({
    where: {
      edi_depot_id: doc.edi_depot_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('edi_depot_01')
  }
}
