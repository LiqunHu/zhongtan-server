const common = require('../../../util/CommonUtil')
const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_unusual_invoice = model.zhongtan_unusual_invoice
const tb_unusual_verification = model.zhongtan_unusual_verification
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {}
  returnData.CARGO_TYPE = GLBConfig.MNR_CARGO_TYPE
  returnData.UNUSUAL_STATUS = GLBConfig.UNUSUAL_STATUS
  let queryStr = `SELECT user_id, user_name, user_address, user_tin FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData.COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)

  queryStr = `SELECT payment_items_code, payment_items_name FROM tbl_zhongtan_payment_items WHERE state = '1' ORDER BY payment_items_code`
  replacements = []
  returnData.UNUSUAL_ITEMS = await model.simpleSelect(queryStr, replacements)

  returnData.VESSELS = []
  queryStr = `SELECT CONCAT(invoice_vessel_name, '/',invoice_vessel_voyage) AS vessel_voyage FROM tbl_zhongtan_invoice_vessel WHERE state = 1 GROUP BY invoice_vessel_name, invoice_vessel_voyage ORDER BY STR_TO_DATE(invoice_vessel_ata, '%d/%m/%Y') DESC;`
  replacements = []
  let imVs = await model.simpleSelect(queryStr, replacements)
  if(imVs) {
    for(let i of imVs) {
      returnData.VESSELS.push(i)
    }
  }
  queryStr = `SELECT CONCAT(export_vessel_name, '/',export_vessel_voyage) AS vessel_voyage FROM tbl_zhongtan_export_vessel WHERE state = 1 GROUP BY export_vessel_name, export_vessel_voyage ORDER BY STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') DESC;`
  replacements = []
  let exVs = await model.simpleSelect(queryStr, replacements)
  if(exVs) {
    for(let e of exVs) {
      returnData.VESSELS.push(e)
    }
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select ui.*, CONCAT(ui.unusual_invoice_vessel, '/', ui.unusual_invoice_voyaga) AS unusual_invoice_vessel_voyage, cb.user_name as unusual_invoice_party_name, cb.user_address as unusual_invoice_party_address, cb.user_tin as unusual_invoice_party_tin, pi.payment_items_name as unusual_invoice_items_name
                  from tbl_zhongtan_unusual_invoice ui left join tbl_common_user cb on ui.unusual_invoice_party = cb.user_id 
                  left join tbl_zhongtan_payment_items pi on ui.unusual_invoice_items = pi.payment_items_code
                  where ui.state = '1' `
  let replacements = []

  let search_data = doc.search_data
  if(search_data) {
    if (search_data.unusual_invoice_no) {
      queryStr += ' and unusual_invoice_no like ?'
      replacements.push('%' + search_data.unusual_invoice_no + '%')
    }
    if(search_data.unusual_invoice_date && search_data.unusual_invoice_date.length == 2) {
      if(search_data.unusual_invoice_date[0] && search_data.unusual_invoice_date[1]) {
        queryStr += ` and DATE_FORMAT(ui.unusual_invoice_date, '%Y-%m-%d') >= ? and DATE_FORMAT(ui.unusual_invoice_date, '%Y-%m-%d') < ? `
        replacements.push(doc.search_data.unusual_invoice_date[0])
        replacements.push(moment(doc.search_data.unusual_invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      }
    }
    if (search_data.unusual_invoice_bl) {
      queryStr += ' and unusual_invoice_bl like ?'
      replacements.push('%' + search_data.unusual_invoice_bl + '%')
    }
  
    if (search_data.unusual_invoice_cargo_type) {
      queryStr += ' and unusual_invoice_cargo_type = ?'
      replacements.push(search_data.unusual_invoice_cargo_type)
    }
  
    if (search_data.unusual_invoice_items) {
      queryStr += ' and unusual_invoice_items = ?'
      replacements.push(search_data.unusual_invoice_items)
    }
  
    if (search_data.unusual_invoice_party) {
      queryStr += ' and unusual_invoice_party = ?'
      replacements.push(search_data.unusual_invoice_party)
    }
  }

  queryStr = queryStr + ` ORDER BY unusual_invoice_id DESC`
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      if(d.unusual_invoice_status === '2' || d.unusual_invoice_status === '3') {
        d.unusual_files = await tb_uploadfile.findOne({
          where: {
            uploadfile_index1: d.unusual_invoice_id,
            api_name: 'UNUSUAL INVOICE',
            state: GLBConfig.ENABLE
          }
        })
      }
      d.atta_files = await tb_uploadfile.findAll({
        where: {
          uploadfile_index1: d.unusual_invoice_id,
          api_name: 'UNUSUAL INVOICE ATTACHMENT',
          state: GLBConfig.ENABLE
        }
      })
      rows.push(d)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let unusual_invoice_vessel = null
  let unusual_invoice_voyaga = null
  if(doc.unusual_invoice_vessel_voyage) {
    unusual_invoice_vessel = doc.unusual_invoice_vessel_voyage.split('/')[0]
    unusual_invoice_voyaga = doc.unusual_invoice_vessel_voyage.split('/')[1]
  }
  let coscoBl = doc.unusual_invoice_bl
  let ooclBl = doc.unusual_invoice_bl
  if(common.isNumber(doc.unusual_invoice_bl)) {
    coscoBl = 'COSU' + doc.unusual_invoice_bl
    ooclBl = 'OOLU' + doc.unusual_invoice_bl
  }
  let numberBl = common.fileterN(doc.unusual_invoice_bl)
  let queryStr = `SELECT * FROM tbl_zhongtan_unusual_invoice WHERE state = ? AND unusual_invoice_items = ? AND (unusual_invoice_bl = ? OR unusual_invoice_bl = ?  OR unusual_invoice_bl = ?)`
  let replacements = [GLBConfig.ENABLE, doc.unusual_invoice_items, coscoBl, ooclBl, numberBl]
  let sameUnusuals = await model.simpleSelect(queryStr, replacements)
  if(sameUnusuals && sameUnusuals.length > 0) {
    return common.error('unusual_03')
  }
  let obj = await tb_unusual_invoice.create({
    unusual_invoice_party: doc.unusual_invoice_party,
    unusual_invoice_items: doc.unusual_invoice_items,
    unusual_invoice_cargo_type: doc.unusual_invoice_cargo_type,
    unusual_invoice_amount: doc.unusual_invoice_amount,
    unusual_invoice_bl: doc.unusual_invoice_bl,
    unusual_invoice_vessel: unusual_invoice_vessel,
    unusual_invoice_voyaga: unusual_invoice_voyaga,
    unusual_invoice_status: '1'
  })

  if(doc.unusual_atta_files && doc.unusual_atta_files.length > 0) {
    for(let f of doc.unusual_atta_files) {
      let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
      await tb_uploadfile.create({
        api_name: 'UNUSUAL INVOICE ATTACHMENT',
        user_id: user.user_id,
        uploadfile_index1: obj.unusual_invoice_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_state: 'AP',
        uploadfile_amount: doc.unusual_invoice_amount,
        uploadfile_currency: 'USD'
      })
    }
  }

  await tb_unusual_verification.create({
    unusual_invoice_id: obj.unusual_invoice_id,
    unusual_verification_state: 'PC',
    unusual_verification_create_user: user.user_id
  })
  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let obj = await tb_unusual_invoice.findOne({
    where: {
      unusual_invoice_id: doc.old.unusual_invoice_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let ver = await tb_unusual_verification.findOne({
      where: {
        unusual_invoice_id: doc.old.unusual_invoice_id
      },
      order: [['unusual_verification_id', 'DESC']]
    })
    if(ver && ver.unusual_verification_state === 'AP') {
      return common.error('unusual_01')
    }

    let coscoBl = doc.new.unusual_invoice_bl
    let ooclBl = doc.new.unusual_invoice_bl
    if(common.isNumber(doc.new.unusual_invoice_bl)) {
      coscoBl = 'COSU' + doc.new.unusual_invoice_bl
      ooclBl = 'OOLU' + doc.new.unusual_invoice_bl
    }
    let numberBl = common.fileterN(doc.new.unusual_invoice_bl)
    let queryStr = `SELECT * FROM tbl_zhongtan_unusual_invoice WHERE state = ? AND unusual_invoice_id <> ? AND unusual_invoice_items = ? AND (unusual_invoice_bl = ? OR unusual_invoice_bl = ?  OR unusual_invoice_bl = ?)`
    let replacements = [GLBConfig.ENABLE, obj.unusual_invoice_id, doc.new.unusual_invoice_items, coscoBl, ooclBl, numberBl]
    let sameUnusuals = await model.simpleSelect(queryStr, replacements)
    if(sameUnusuals && sameUnusuals.length > 0) {
      return common.error('unusual_03')
    }

    let unusual_invoice_vessel = null
    let unusual_invoice_voyaga = null
    if(doc.new.unusual_invoice_vessel_voyage) {
      unusual_invoice_vessel = doc.new.unusual_invoice_vessel_voyage.split('/')[0]
      unusual_invoice_voyaga = doc.new.unusual_invoice_vessel_voyage.split('/')[1]
    }

    obj.unusual_invoice_party = doc.new.unusual_invoice_party
    obj.unusual_invoice_items = doc.new.unusual_invoice_items
    obj.unusual_invoice_cargo_type = doc.new.unusual_invoice_cargo_type
    obj.unusual_invoice_amount = doc.new.unusual_invoice_amount
    obj.unusual_invoice_bl = doc.new.unusual_invoice_bl
    obj.unusual_invoice_vessel = unusual_invoice_vessel
    obj.unusual_invoice_voyaga = unusual_invoice_voyaga

    if(doc.new.unusual_atta_files && doc.new.unusual_atta_files.length > 0) {
      for(let f of doc.new.unusual_atta_files) {
        let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'UNUSUAL INVOICE ATTACHMENT',
          user_id: user.user_id,
          uploadfile_index1: obj.unusual_invoice_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_state: 'AP',
          uploadfile_amount: doc.new.unusual_invoice_amount,
          uploadfile_currency: 'USD'
        })
      }
    }
    await obj.save()
    if(ver) {
      ver.unusual_verification_state = 'PC'
      await ver.save()
    }
    return common.success(obj)
  } else {
    return common.error('unusual_02')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_unusual_invoice.findOne({
    where: {
      unusual_invoice_id: doc.unusual_invoice_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    if(obj.unusual_invoice_status === '2' || obj.unusual_invoice_status === '3') {
      return common.error('unusual_01')
    }
    obj.state = GLBConfig.DISABLE
    await obj.save()

    let vers = await tb_unusual_verification.findAll({
      where: {
        unusual_invoice_id: doc.unusual_invoice_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vers) {
      for(let v of vers) {
        v.state = GLBConfig.DISABLE
        await v.save()
      }
    }
  } else {
    return common.error('unusual_02')
  }
}

exports.deleteInvoiceAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_unusual_invoice.findOne({
    where: {
      unusual_invoice_id: doc.unusual_invoice_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    if(obj.unusual_invoice_status === '2') {
      obj.unusual_invoice_status = '1'
      obj.unusual_invoice_no = null
      obj.unusual_invoice_date = null
      await obj.save()
      let invoice = await tb_uploadfile.findOne({
        where: {
          uploadfile_index1: obj.unusual_invoice_id,
          api_name: 'UNUSUAL INVOICE',
          state: GLBConfig.ENABLE
        }
      })
      if(invoice) {
        invoice.state = GLBConfig.DISABLE
        await invoice.save()
      }
    }
  } else {
    return common.error('unusual_02')
  }
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `select ui.*, CONCAT(ui.unusual_invoice_vessel, '/', ui.unusual_invoice_voyaga) AS unusual_invoice_vessel_voyage, cb.user_name as unusual_invoice_party_name, cb.user_address as unusual_invoice_party_address, cb.user_tin as unusual_invoice_party_tin, pi.payment_items_name as unusual_invoice_items_name
                  from tbl_zhongtan_unusual_invoice ui left join tbl_common_user cb on ui.unusual_invoice_party = cb.user_id 
                  left join tbl_zhongtan_payment_items pi on ui.unusual_invoice_items = pi.payment_items_code
                  where ui.state = '1' `
  let replacements = []

  let search_data = doc.search_data
  if(search_data) {
    if (search_data.unusual_invoice_no) {
      queryStr += ' and unusual_invoice_no like ?'
      replacements.push('%' + search_data.unusual_invoice_no + '%')
    }

    if(search_data.unusual_invoice_date && search_data.unusual_invoice_date.length == 2) {
      if(search_data.unusual_invoice_date[0] && search_data.unusual_invoice_date[1]) {
        queryStr += ` and DATE_FORMAT(ui.unusual_invoice_date, '%Y-%m-%d') >= ? and ui.unusual_invoice_date < ? `
        replacements.push(doc.search_data.unusual_invoice_date[0])
        replacements.push(moment(doc.search_data.unusual_invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      }
    }
    if (search_data.unusual_invoice_bl) {
      queryStr += ' and unusual_invoice_bl like ?'
      replacements.push('%' + search_data.unusual_invoice_bl + '%')
    }
  
    if (search_data.unusual_invoice_cargo_type) {
      queryStr += ' and unusual_invoice_cargo_type = ?'
      replacements.push(search_data.unusual_invoice_cargo_type)
    }
  
    if (search_data.unusual_invoice_items) {
      queryStr += ' and unusual_invoice_items = ?'
      replacements.push(search_data.unusual_invoice_items)
    }
  
    if (search_data.unusual_invoice_party) {
      queryStr += ' and unusual_invoice_party = ?'
      replacements.push(search_data.unusual_invoice_party)
    }
  }

  let result = await model.simpleSelect(queryStr, replacements)
  let filepath = await common.ejs2xlsx('UnusualInvoice.xlsx', result)
  res.sendFile(filepath)
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.removeAttachmentAct = async req => {
  let doc = common.docValidate(req)
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.uploadfile_id
    }
  })
  if(file) {
    file.state = GLBConfig.DISABLE
    await file.save()
  }

  let atta_files = await tb_uploadfile.findAll({
    where: {
      uploadfile_index1: doc.uploadfile_index1,
      api_name: 'UNUSUAL INVOICE ATTACHMENT',
      state: GLBConfig.ENABLE
    }
  })
  let ret = {
    atta_files: atta_files
  }
  return common.success(ret)
}