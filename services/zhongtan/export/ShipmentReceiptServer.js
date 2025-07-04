const moment = require('moment')
const numberToText = require('number2text')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const tb_user = model.common_user
const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_container = model.zhongtan_export_proforma_container
const tb_uploadfile = model.zhongtan_uploadfile
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_bank_info = model.zhongtan_bank_info

exports.initAct = async () => {
  let returnData = {}
  returnData.CASH_BANK_INFO = GLBConfig.CASH_BANK_INFO
  returnData.RECEIPT_TYPE_INFO= GLBConfig.RECEIPT_TYPE_INFO
  let queryStr = `SELECT user_id, TRIM(user_name) AS user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  let customers = await model.simpleSelect(queryStr, replacements)
  returnData.CUSTOMER = customers

  queryStr = `SELECT export_vessel_id, CONCAT(export_vessel_name, '/', export_vessel_voyage) AS export_vessel FROM tbl_zhongtan_export_proforma_vessel WHERE state = ? ORDER BY export_vessel_etd DESC, export_vessel_name, export_vessel_voyage`
  replacements = [GLBConfig.ENABLE]
  let vessels = await model.simpleSelect(queryStr, replacements)
  returnData.VESSEL = vessels

  let BANK_INFOS = []
  let banks = await tb_bank_info.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  if(banks && banks.length > 0) {
    for(let b of banks) {
      BANK_INFOS.push({
        bank_code: b.bank_code,
        bank_name: b.bank_name
      })
    }
  }
  returnData.BANK_INFOS = BANK_INFOS
  return common.success(returnData)
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_name = doc.vessel_name
  let masterbi_bl = doc.masterbi_bl
  let invoice_no = doc.invoice_no
  let receipt_no = doc.receipt_no
  let reference_no = doc.reference_no
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_proforma_vessel v WHERE v.state = '1'`
  let replacements = []
  if(masterbi_bl) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_proforma_masterbl b WHERE b.state = '1' AND b.export_masterbl_bl like ?) `
    replacements.push('%' + masterbi_bl + '%')
  }
  if(invoice_no) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_proforma_masterbl WHERE export_masterbl_id IN (SELECT DISTINCT(export_masterbl_id) FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_invoice_no LIKE ?))`
    replacements.push('%' + invoice_no + '%')
  }
  if(receipt_no) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_proforma_masterbl WHERE export_masterbl_id IN (SELECT DISTINCT(export_masterbl_id) FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_receipt_no LIKE ?))`
    replacements.push('%' + receipt_no + '%')
  }
  if(reference_no) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_proforma_masterbl WHERE export_masterbl_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state =1 AND api_name = 'SHIPMENT-RECEIPT' AND ((uploadfile_check_cash = 'CHEQUE' AND uploadfile_check_no LIKE ?) OR (uploadfile_check_cash != 'CHEQUE' AND uploadfile_bank_reference_no LIKE ?)) ))`
    replacements.push('%' + reference_no + '%')
    replacements.push('%' + reference_no + '%')
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
  let invoice_no = doc.invoice_no
  let receipt_no = doc.receipt_no
  let reference_no = doc.reference_no
  let queryStr =  `select * from tbl_zhongtan_export_proforma_masterbl b WHERE b.export_vessel_id = ? AND b.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbl_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  if(invoice_no) {
    queryStr = queryStr + ` AND b.export_masterbl_id IN (SELECT DISTINCT(export_masterbl_id) FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_invoice_no LIKE ?)`
    replacements.push('%' + invoice_no + '%')
  }
  if(receipt_no) {
    queryStr = queryStr + ` AND b.export_masterbl_id IN (SELECT DISTINCT(export_masterbl_id) FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_receipt_no LIKE ?)`
    replacements.push('%' + receipt_no + '%')
  }
  if(reference_no) {
    queryStr = queryStr + ` AND b.export_masterbl_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state =1 AND api_name = 'SHIPMENT-RECEIPT' AND ((uploadfile_check_cash = 'CHEQUE' AND uploadfile_check_no LIKE ?) OR (uploadfile_check_cash != 'CHEQUE' AND uploadfile_bank_reference_no LIKE ?)))`
    replacements.push('%' + reference_no + '%')
    replacements.push('%' + reference_no + '%')
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
  let queryStr =  `select * from tbl_zhongtan_export_proforma_container c WHERE c.export_vessel_id = ? AND c.state = ?`
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
  
  if(doc.shipment_receipt_check_cash === 'TRANSFER' && !doc.shipment_receipt_bank_info) {
    // && moment().isAfter(moment('2023-12-31', 'YYYY/MM/DD'))
    return common.error('import_14')
  }
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
  renderData.shipment_receipt_bl = bl.export_masterbl_bl
  if (doc.shipment_receipt_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (doc.shipment_receipt_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer(' + doc.shipment_receipt_bank_info + ')/ ' + doc.shipment_receipt_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + doc.shipment_receipt_check_no
  }
  renderData.shipment_receipt_sum_fee = parseFloat(invoice.uploadfile_amount.replace(/,/g, '') || 0)
  if(renderData.shipment_receipt_sum_fee >= 0) {
    renderData.shipment_receipt_sum_fee_str = numberToText(renderData.shipment_receipt_sum_fee, 'english')
  } else {
    renderData.shipment_receipt_sum_fee_str = 'MINUS ' + numberToText(new Decimal(renderData.shipment_receipt_sum_fee).absoluteValue(), 'english')
  }

  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  try {
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
      uploadfile_bank_reference_no: doc.shipment_receipt_bank_reference_no,
      uploadfile_bank_info: doc.shipment_receipt_bank_info
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
  } catch(e) {
    return common.error('generate_file_01')
  }
}

exports.exportCollectAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT b.*, v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd 
                  FROM tbl_zhongtan_export_proforma_masterbl b LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON b.export_vessel_id = v.export_vessel_id 
                  WHERE b.state = '1' AND v.state = '1' `
  let replacements = []
  if(doc.receipt_vessel) {
    queryStr = queryStr + ` AND b.export_vessel_id = ? `
    replacements.push(doc.receipt_vessel)
  }
  if(doc.receipt_party) {
    queryStr = queryStr + ` AND export_masterbl_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = '1' AND uploadfile_customer_id = ? )`
    replacements.push(doc.receipt_party)
  }
  if(doc.carrier) {
    queryStr = queryStr + ` AND b.export_masterbl_bl_carrier = ? `
    replacements.push(doc.carrier)
  }
  if(doc.collect_etd && doc.collect_etd.length > 1 && doc.collect_etd[0] && doc.collect_etd[1]) {
    queryStr += ' and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") < ? '
    replacements.push(moment(doc.collect_etd[0]).local().format('YYYY-MM-DD'))
    replacements.push(moment(doc.collect_etd[1]).local().add(1, 'days').format('YYYY-MM-DD'))
  }
  if(doc.collect_date && doc.collect_date.length > 1 && doc.collect_date[0] && doc.collect_date[1]) {
    queryStr = queryStr + ` AND export_masterbl_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = '1' AND created_at > ? AND created_at < ? AND api_name = 'SHIPMENT-RECEIPT')`
    replacements.push(moment(doc.collect_date[0]).local().format('YYYY-MM-DD'))
    replacements.push(moment(doc.collect_date[1]).local().add(1, 'days').format('YYYY-MM-DD'))
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") ASC, b.export_masterbl_bl ASC `
  let result = await model.simpleSelect(queryStr, replacements)
  if(result) {
    let receivable_map = new Map()
    receivable_map.set('B/L FEE', 'receivable_bl')
    receivable_map.set('OCEAN FREIGHT', 'receivable_ocean')
    receivable_map.set('TASAC FEE', 'receivable_tasac')
    receivable_map.set('DEMURRAGE FEE', 'receivable_demurrage')
    receivable_map.set('LIFT ON/OFF', 'receivable_lofo')
    receivable_map.set('AMENDMENT FEE', 'receivable_amf')
    receivable_map.set('ADJUSTMENT', 'receivable_adj')
    receivable_map.set('TELEX RELEASE FEE', 'receivable_telex')
    receivable_map.set('FAF', 'receivable_faf')
    receivable_map.set('DESTINATION CHANGE', 'receivable_cod')
    receivable_map.set('ROLLOVER CHARGE/SPACE LOSS', 'receivable_rlc')
    receivable_map.set('LATE PAYMENT FEE', 'receivable_lpf')
    let payable_map = new Map()
    payable_map.set('B/L FEE', 'payable_bl')
    payable_map.set('OCEAN FREIGHT', 'payable_ocean')
    payable_map.set('TASAC FEE', 'payable_tasac')
    payable_map.set('DEMURRAGE FEE', 'payable_demurrage')
    payable_map.set('AMENDMENT FEE', 'payable_amf')
    payable_map.set('TELEX RELEASE FEE', 'payable_telex')
    payable_map.set('FAF', 'payable_faf')
    payable_map.set('DESTINATION CHANGE', 'payable_cod')
    payable_map.set('ROLLOVER CHARGE/SPACE LOSS', 'payable_rlc')
    let renderData = []
    for(let r of result) {
      queryStr = `SELECT u.*, c.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user c ON u.uploadfile_customer_id = c.user_id 
                  WHERE u.state = '1' AND u.uploadfile_index1 = ? AND u.api_name = 'SHIPMENT-RECEIPT'`
      replacements = []
      replacements.push(r.export_masterbl_id)
      if(doc.collect_date && doc.collect_date.length > 1 && doc.collect_date[0] && doc.collect_date[1]) {
        queryStr = queryStr + ` AND u.created_at > ? AND u.created_at < ? `
        replacements.push(moment(doc.collect_date[0]).local().format('YYYY-MM-DD'))
        replacements.push(moment(doc.collect_date[1]).local().add(1, 'days').format('YYYY-MM-DD'))
      }
      queryStr = queryStr + ` ORDER by u.uploadfile_id`
      let files = await model.simpleSelect(queryStr, replacements)
      if(files && files.length > 0) {
        for(let f of files) {
          let row = {}
          row.receipt_date = moment(f.created_at).format('YYYY/MM/DD')
          row.receipt_no = f.uploadfile_receipt_no
          if(f.uploadfile_index3) {
            let invoice = await tb_uploadfile.findOne({
              where: {
                uploadfile_id: f.uploadfile_index3,
                state: GLBConfig.ENABLE
              }
            })
            if(invoice) {
              row.invoice_no = invoice.uploadfile_invoice_no
            }
          }
          row.receipt_currency = f.uploadfile_currency
          row.receipt_amount = f.uploadfile_amount
          // row.check_bank = f.uploadfile_check_cash
          // row.bank = f.uploadfile_bank_reference_no
          // row.check = f.uploadfile_check_no
          row.check_bank = ''
          if(f.uploadfile_bank_info) {
            row.check_bank = f.uploadfile_bank_info
            row.bank = f.uploadfile_bank_reference_no
          } else {
            if (f.uploadfile_check_cash === 'CASH') {
              row.check_bank = '1'
            } else if (f.uploadfile_check_cash === 'CHEQUE') {
              row.check_bank = '2'
              row.check = f.uploadfile_check_no
            } else if (f.uploadfile_check_cash === 'TRANSFER') {
              row.check_bank = '3'
              row.bank = f.uploadfile_bank_reference_no
            }
          }


          row.bank_detail = ''
          row.receipt_party = f.user_name
          row.receipt_bl = r.export_masterbl_bl
          row.vessel_voyage = r.export_vessel_name + '/' + r.export_vessel_voyage
          // 添加对应收据的应付
          queryStr = `SELECT f.*, d.fee_data_name FROM tbl_zhongtan_export_shipment_fee f 
                      LEFT JOIN (SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = 1 GROUP BY fee_data_code) d ON f.fee_data_code = d.fee_data_code 
                      WHERE f.state = '1' AND f.shipment_fee_type = 'R' AND f.shipment_fee_receipt_id = ?`
          replacements = []
          replacements.push(f.uploadfile_id)
          let receivables = await model.simpleSelect(queryStr, replacements)
          if(receivables) {
            let receivable_others = 0
              for(let ra of receivables) {
                if(receivable_map.get(ra.fee_data_name)) {
                  if(row[receivable_map.get(ra.fee_data_name)]) {
                    row[receivable_map.get(ra.fee_data_name)] = new Decimal(row[receivable_map.get(ra.fee_data_name)]).plus(new Decimal(ra.shipment_fee_amount))
                  } else {
                    row[receivable_map.get(ra.fee_data_name)] = ra.shipment_fee_amount
                  }
                }else {
                  if(ra.shipment_fee_amount) {
                    receivable_others = new Decimal(receivable_others).plus(new Decimal(ra.shipment_fee_amount))
                  }
                }
                if(ra.fee_data_name === 'DEMURRAGE FEE') {
                  if(row[payable_map.get(ra.fee_data_name)]) {
                    row[payable_map.get(ra.fee_data_name)] = new Decimal(row[payable_map.get(ra.fee_data_name)]).plus(new Decimal(ra.shipment_fee_amount))
                  } else {
                    row[payable_map.get(ra.fee_data_name)] = ra.shipment_fee_amount
                  }
                }
              }
              if(Decimal.isDecimal(receivable_others) && receivable_others.toNumber() !== 0) {
                row.receivable_others = receivable_others.toNumber()
              }
          }
          // 添加应付费用
          queryStr = `SELECT f.*, d.fee_data_name FROM tbl_zhongtan_export_shipment_fee f 
          LEFT JOIN (SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data GROUP BY fee_data_code) d ON f.fee_data_code = d.fee_data_code 
          WHERE f.state = '1' AND f.shipment_fee_type = 'P' AND f.shipment_fee_status = 'AP' AND f.export_masterbl_id = ? `
          replacements = []
          replacements.push(r.export_masterbl_id)
          let payables = await model.simpleSelect(queryStr, replacements)
          if(payables) {
            let payable_others = 0
            for(let pa of payables) {
              if(pa.fee_data_name === 'DEMURRAGE FEE') {
                delete row[payable_map.get(pa.fee_data_name)]
              }
              if(payable_map.get(pa.fee_data_name)) {
                if(row[payable_map.get(pa.fee_data_name)]) {
                  row[payable_map.get(pa.fee_data_name)] = new Decimal(row[payable_map.get(pa.fee_data_name)]).plus(new Decimal(pa.shipment_fee_amount))
                } else {
                  row[payable_map.get(pa.fee_data_name)] = pa.shipment_fee_amount
                }
              } else {
                if(pa.shipment_fee_amount) {
                  payable_others = new Decimal(payable_others).plus(new Decimal(pa.shipment_fee_amount))
                }
              }
            }
            if(Decimal.isDecimal(payable_others) && payable_others.toNumber() !== 0) {
              row.payable_others = payable_others.toNumber()
            }
          }
          renderData.push(row)
        }
      } else {
        let row = {}
        row.receipt_bl = r.export_masterbl_bl
        row.vessel_voyage = r.export_vessel_name + '/' + r.export_vessel_voyage
        renderData.push(row)
      }
    }
    let filepath = await common.ejs2xlsx('ShipmentReceiptTemplate.xlsx', renderData)
    res.sendFile(filepath)
  } else {
    return common.error('export_01')
  }
}
