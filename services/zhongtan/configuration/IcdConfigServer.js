const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_icd = model.zhongtan_icd
const tb_bl = model.zhongtan_invoice_masterbl

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
  let rows = []
  if(result.data && result.data.length > 0) {
    for (let r of result.data) {
      if(r.icd_edi_type == 'SFTP') {
        r.icd_sftp_info = r.icd_server_name + ':' + r.icd_server_port + '/' + r.icd_server_path + ' (' + r.icd_server_username + ':' + r.icd_server_password + ')'
      }
      rows.push(r)
    }
  }
  returnData.rows = rows

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
  if(doc.icd_edi_type === 'SFTP') {
    let icd = await tb_icd.create({
      icd_name: doc.icd_name,
      icd_code: doc.icd_code,
      icd_email: doc.icd_email,
      icd_tel: doc.icd_tel,
      icd_edi_type: doc.icd_edi_type,
      icd_server_name: doc.icd_server_name,
      icd_server_port: doc.icd_server_port,
      icd_server_username: doc.icd_server_username,
      icd_server_password: doc.icd_server_password,
      icd_server_path: doc.icd_server_path
    })
    return common.success(icd)
  } else {
    let icd = await tb_icd.create({
      icd_name: doc.icd_name,
      icd_code: doc.icd_code,
      icd_email: doc.icd_email,
      icd_tel: doc.icd_tel,
      icd_edi_type: doc.icd_edi_type
    })
    return common.success(icd)
  }
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
    if(icd.icd_name !== doc.new.icd_name) {
      // 如果名称修改，同步修改对应提单icd名称
      let bls = await tb_bl.findAll({
        where: {
          state: GLBConfig.ENABLE,
          invoice_masterbi_do_icd: icd.icd_name,
        }
      })
      if(bls) {
        for(let bl of bls) {
          bl.invoice_masterbi_do_icd = doc.new.icd_name
          bl.save()
        }
      }
    }
    icd.icd_name = doc.new.icd_name
    icd.icd_code = doc.new.icd_code
    
    icd.icd_tel = doc.new.icd_tel
    icd.icd_edi_type = doc.new.icd_edi_type
    if(doc.new.icd_edi_type === 'SFTP') {
      icd.icd_email = doc.new.icd_email
      icd.icd_server_name = doc.new.icd_server_name
      icd.icd_server_port = doc.new.icd_server_port
      icd.icd_server_username = doc.new.icd_server_username
      icd.icd_server_password = doc.new.icd_server_password
      icd.icd_server_path = doc.new.icd_server_path
    } else {
      icd.icd_email = doc.new.icd_email
      icd.icd_server_name = ''
      icd.icd_server_port = ''
      icd.icd_server_username = ''
      icd.icd_server_password = ''
      icd.icd_server_path = ''
    }
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
