const moment = require('moment')
const numberToText = require('number2text')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const tb_user = model.common_user
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_uploadfile = model.zhongtan_uploadfile
const tb_shipment_fee = model.zhongtan_export_shipment_fee

exports.initAct = async () => {
  let returnData = {}
  returnData['CASH_BANK_INFO'] = GLBConfig.CASH_BANK_INFO
  return common.success(returnData)
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_name = doc.vessel_name
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_vessel v `
  let replacements = []
  if(masterbi_bl) {
    queryStr = queryStr + ` LEFT JOIN tbl_zhongtan_export_masterbl b ON v.export_vessel_id = b.export_vessel_id WHERE v.state = '1' AND b.state = '1' AND b.export_masterbl_bl like ? `
    replacements.push('%' + masterbi_bl + '%')
  } else {
    queryStr = queryStr + ` WHERE v.state = '1' `
  }
  if(etd_start_date && etd_end_date) {
    queryStr = queryStr + ` AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") <= ? `
    replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
  }
  if(vessel_name) {
    queryStr = queryStr + ` AND v.export_vessel_name LIKE ? `
    replacements.push('%' + vessel_name + '%')
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC `
  let vessels =  await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let v of vessels) {
      let bcount = await tb_bl.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      let ccount = await tb_container.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      v.bl_count = bcount
      v.container_count = ccount
    }
  }
  return vessels
}

exports.searchBlAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_masterbl b WHERE b.export_vessel_id = ? AND b.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbl_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  let bls = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = bls.count
  let blRows = []
  if(bls.data && bls.data.length > 0) {
    for(let d of bls.data) {
      queryStr = `select f.*, u.user_name, c.user_name as shipment_receipt_party_name from tbl_zhongtan_uploadfile f 
                left join tbl_common_user u on f.user_id = u.user_id 
                left join tbl_common_user c on f.uploadfile_customer_id = c.user_id 
                where f.state = ? and f.api_name in (?) and f.uploadfile_index1 = ? order by f.uploadfile_id desc;`
      replacements = [GLBConfig.ENABLE, ['SHIPMENT-INVOICE', 'SHIPMENT-RECEIPT'], d.export_masterbl_id]
      let uf = await model.simpleSelect(queryStr, replacements)
      d.files = []
      if(uf && uf.length > 0) {
        for(let f of uf) {
          f.created_at = moment(f.created_at).format('YYYY-MM-DD HH:mm:ss')
          d.files.push(f)
        }
      }
      blRows.push(d)
    }
  }
  returnData.rows = blRows
  return returnData
}

exports.searchContainerAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_container c WHERE c.export_vessel_id = ? AND c.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND c.export_container_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  let cons = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = cons.count
  returnData.rows = cons.data
  return returnData
}

exports.shipmentReceiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let file_id = doc.file_id
  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })
  let invoice = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: file_id
    }
  })
  let customer = await tb_user.findOne({
    where: {
      user_id: invoice.uploadfile_customer_id
    }
  })
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: invoice.uploadfile_index1
    }
  })
  let receipt_no = await seq.genShipmentReceiptSeq(bl.export_masterbl_bl_carrier)
  let renderData = {}
  renderData.shipment_receipt_no = receipt_no
  renderData.shipment_receipt_date = moment().format('MMM DD, YYYY')
  renderData.shipment_receipt_party = customer.user_name
  renderData.shipment_receipt_currency = invoice.uploadfile_currency
  renderData.shipment_receipt_bl = bl.invoice_masterbi_bl
  if (doc.shipment_receipt_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (doc.shipment_receipt_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer/ ' + doc.shipment_receipt_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + doc.shipment_receipt_check_no
  }
  renderData.shipment_receipt_sum_fee = parseFloat(invoice.uploadfile_amount.replace(/,/g, '') || 0)
  if(renderData.shipment_receipt_sum_fee >= 0) {
    renderData.shipment_receipt_sum_fee_str = numberToText(renderData.shipment_receipt_sum_fee)
  } else {
    renderData.shipment_receipt_sum_fee_str = 'MINUS ' + numberToText(new Decimal(renderData.shipment_receipt_sum_fee).absoluteValue())
  }

  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  let fileInfo = await common.ejs2Pdf('shipmentReceipt.ejs', renderData, 'zhongtan')
  let ruf = await tb_uploadfile.create({
    api_name: 'SHIPMENT-RECEIPT',
    user_id: user.user_id,
    uploadfile_index1: invoice.uploadfile_index1,
    uploadfile_index3: invoice.uploadfile_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url,
    uploadfile_acttype: 'shipment',
    uploadfile_amount: invoice.uploadfile_amount,
    uploadfile_currency: invoice.uploadfile_currency,
    uploadfile_check_cash: doc.shipment_receipt_check_cash,
    uploadfile_check_no: doc.shipment_receipt_check_no,
    uploadfile_received_from: customer.user_name,
    uploadfile_customer_id: customer.user_id,
    uploadfile_receipt_no: receipt_no,
    uploadfil_release_date: curDate,
    uploadfil_release_user_id: user.user_id,
    uploadfile_bank_reference_no: doc.shipment_receipt_bank_reference_no
  })
  invoice.uploadfile_index3 = ruf.uploadfile_id
  invoice.uploadfile_receipt_no = receipt_no
  await invoice.save()
  let sf = await tb_shipment_fee.findAll({
    where: {
      shipment_fee_invoice_id: invoice.uploadfile_id
    }
  })
  if(sf) {
    for(let s of sf) {
      s.shipment_fee_status = 'RE'
      s.shipment_fee_receipt_by = user.user_id
      s.shipment_fee_receipt_at = curDate
      s.shipment_fee_receipt_no = receipt_no
      s.shipment_fee_receipt_id = ruf.uploadfile_id
      await s.save()
    }
  }
  return common.success({ url: fileInfo.url })
}
