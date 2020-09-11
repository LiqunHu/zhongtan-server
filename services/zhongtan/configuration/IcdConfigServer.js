const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_icd = model.zhongtan_icd

exports.initAct = async () => {
  let returnData = {}
  returnData['ICD_EDI_TYPE'] = GLBConfig.ICD_EDI_TYPE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_icd where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (icd_name like ? or icd_code like ?)'
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

  let addIcd = await tb_icd.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ icd_name: doc.icd_name }, { icd_code: doc.icd_code }]
    }
  })
  if (addIcd) {
    return common.error('icd_02')
  }

  let icd = await tb_icd.create({
    icd_name: doc.icd_name,
    icd_code: doc.icd_code,
    icd_email: doc.icd_email,
    icd_tel: doc.icd_tel,
    icd_edi_type: doc.icd_edi_type
  })

  return common.success(icd)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let icd = await tb_icd.findOne({
    where: {
      icd_id: doc.old.icd_id,
      state: GLBConfig.ENABLE
    }
  })
  if (icd) {
    let updateIcd = await tb_icd.findOne({
      where: {
        icd_id: {[Op.ne]: doc.old.icd_id},
        [Op.or]: [{ icd_name: doc.new.icd_name }, { icd_code: doc.new.icd_code }]
      }
    })
    if (updateIcd) {
      return common.error('icd_02')
    }

    icd.icd_name = doc.new.icd_name
    icd.icd_code = doc.new.icd_code
    icd.icd_email = doc.new.icd_email
    icd.icd_tel = doc.new.icd_tel
    icd.icd_edi_type = doc.new.icd_edi_type
    await icd.save()
    return common.success(icd)
  } else {
    return common.error('icd_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let icd = await tb_icd.findOne({
    where: {
      icd_id: doc.icd_id,
      state: GLBConfig.ENABLE
    }
  })
  if (icd) {
    icd.state = GLBConfig.DISABLE
    await icd.save()

  } else {
    return common.error('icd_01')
  }
}
