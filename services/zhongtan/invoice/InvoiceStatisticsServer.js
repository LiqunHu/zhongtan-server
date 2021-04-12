const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_user = model.common_user
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let VESSEL_VOYAGE = []
  let queryStr = `SELECT invoice_vessel_id, concat(invoice_vessel_name, ' / ', invoice_vessel_voyage) as invoice_vessel FROM tbl_zhongtan_invoice_vessel WHERE state = '1' ORDER BY invoice_vessel_id DESC;`
  let replacements = []
  let vessels = await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let d of vessels) {
      VESSEL_VOYAGE.push(d)
    }
  }

  let CUSTOMER = []
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  let deliverys = await model.simpleSelect(queryStr, replacements)
  if(deliverys) {
    for(let d of deliverys) {
      CUSTOMER.push(d)
    }
  }

  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO,
    COLLECT_FLAG: GLBConfig.COLLECT_FLAG,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE,
    VESSEL_VOYAGE: VESSEL_VOYAGE,
    CUSTOMER: CUSTOMER
  }

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select
      a.*, b.user_name, v.*
    from
      tbl_zhongtan_invoice_masterbl a
    LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
    LEFT JOIN tbl_zhongtan_invoice_vessel v ON v.invoice_vessel_id = a.invoice_vessel_id
    WHERE a.state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.ata_date && doc.ata_date.length > 1 && doc.ata_date[0] && doc.ata_date[1]) {  
    queryStr += ' and STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") < ? '
    replacements.push(doc.ata_date[0])
    replacements.push(moment(doc.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  if (doc.invoice_vessel_id) {
    queryStr += ' and a.invoice_vessel_id = ? '
    replacements.push(doc.invoice_vessel_id)
  }
  let customer = {}
  if(doc.invoice_customer_id) {
    customer = await tb_user.findOne({
      where: {
        user_id: doc.invoice_customer_id
      }
    })
    queryStr += ` AND (a.invoice_masterbi_customer_id = ? OR a.invoice_masterbi_delivery_to = ? OR EXISTS (SELECT 1 FROM tbl_zhongtan_uploadfile WHERE uploadfile_index1 = a.invoice_masterbi_id AND uploadfile_received_from = ? AND state ='1')) `
    replacements.push(doc.invoice_customer_id)
    replacements.push(customer.user_name.trim())
    replacements.push(customer.user_name.trim())
  }
  if (doc.bl) {
    queryStr += ' and a.invoice_masterbi_bl like ? '
    replacements.push('%' + doc.bl + '%')
  }
  if(doc.do_status && doc.do_status === '1') {
    queryStr += ` and a.invoice_masterbi_do_date IS NOT NULL and  a.invoice_masterbi_do_date <> '' `
    if(doc.do_date && doc.do_date.length > 1 && doc.do_date[0] && doc.do_date[1]) {
      queryStr += ' and a.invoice_masterbi_do_date >= ? and a.invoice_masterbi_do_date < ? '
      replacements.push(doc.do_date[0])
      replacements.push(moment(doc.do_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  } else if(doc.do_status && doc.do_status === '2') {
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or  a.invoice_masterbi_do_date = '') `
  } else if(doc.do_status && doc.do_status === '3') {
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or a.invoice_masterbi_do_date = '') 
                  and ((a.invoice_masterbi_deposit_date IS NOT NULL and a.invoice_masterbi_deposit_date <> '') 
                        or (a.invoice_masterbi_fee_date IS NOT NULL and a.invoice_masterbi_fee_date <> '') 
                        or (a.invoice_masterbi_deposit_receipt_date IS NOT NULL and a.invoice_masterbi_deposit_receipt_date <> '') 
                        or (a.invoice_masterbi_invoice_receipt_date IS NOT NULL and a.invoice_masterbi_invoice_receipt_date <> '')) `
    if(doc.invoice_date && doc.invoice_date.length > 1 && doc.invoice_date[0] && doc.invoice_date[1]) {
      queryStr += ' and ((a.invoice_masterbi_deposit_date >= ? and a.invoice_masterbi_deposit_date < ?) or (a.invoice_masterbi_fee_date >= ? and a.invoice_masterbi_fee_date < ?)) '
      replacements.push(doc.invoice_date[0])
      replacements.push(moment(doc.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      replacements.push(doc.invoice_date[0])
      replacements.push(moment(doc.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if(doc.receipt_date && doc.receipt_date.length > 1 && doc.receipt_date[0] && doc.receipt_date[1]) {
      queryStr += ' and ((a.invoice_masterbi_deposit_receipt_date >= ? and a.invoice_masterbi_deposit_receipt_date < ?) or (a.invoice_masterbi_invoice_receipt_date >= ? and a.invoice_masterbi_invoice_receipt_date < ?)) '
      replacements.push(doc.receipt_date[0])
      replacements.push(moment(doc.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      replacements.push(doc.receipt_date[0])
      replacements.push(moment(doc.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  } else if(doc.do_status && doc.do_status === '4'){
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or a.invoice_masterbi_do_date = '') 
                  and (a.invoice_masterbi_deposit_date IS NULL or a.invoice_masterbi_deposit_date = '' 
                        or a.invoice_masterbi_fee_date IS NULL or a.invoice_masterbi_fee_date = '') `
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") desc, a.invoice_masterbi_bl'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for (let b of result.data) {
    let d = JSON.parse(JSON.stringify(b))
    d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
    d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
    // Carrier
    if(!d.invoice_masterbi_carrier) {
      if(d.invoice_masterbi_bl.indexOf('COS') >= 0) {
        d.invoice_masterbi_carrier  = 'COSCO'
      } else if(d.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
        d.invoice_masterbi_carrier  = 'OOCL'
      }
    }
    // default invoice currency
    d.invoice_container_deposit_currency = 'USD'
    d.invoice_masterbi_of_currency = 'USD'
    d.invoice_fee_currency = 'USD'
    // file info
    d = await this.getMasterbiFiles(d)
    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.getMasterbiFiles = async d => {
  d.files = []
  let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.uploadfile_index1 = ?`
  let replacements = [d.invoice_masterbi_id]
  let files = await model.simpleSelect(queryStr, replacements)
  for (let f of files) {
    let filetype = ''
    if (f.api_name === 'RECEIPT-DEPOSIT') {
      filetype = 'Deposit'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      d.invoice_masterbi_deposit_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_container_deposit_currency = f.uploadfile_currency
      }
      d.invoice_masterbi_deposit_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_deposit_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
      }
    } else if (f.api_name === 'RECEIPT-FEE') {
      filetype = 'Fee'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      d.invoice_fee_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_fee_currency = f.uploadfile_currency
      }
      d.invoice_fee_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_fee_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
      }
    } else if (f.api_name === 'RECEIPT-OF') {
      filetype = 'Freight'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      d.invoice_ocean_freight_fee_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_masterbi_of_currency = f.uploadfile_currency
      }
      d.invoice_masterbi_of_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_fee_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
      }
    } else if (f.api_name === 'RECEIPT-DO') {
      filetype = 'DO'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name,
        edi_state: d.invoice_masterbi_do_edi_state
      })
    } else if (f.api_name === 'RECEIPT-RECEIPT') {
      filetype = 'Receipt'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        receipt_type: f.uploadfile_acttype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      if(f.uploadfile_acttype === 'deposit') {
        d.invoice_masterbi_deposit_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      } else if(f.uploadfile_acttype === 'fee') {
        d.invoice_masterbi_invoice_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      }
    }
  }
  return d
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `select
      a.*, b.user_name, v.*
    from
      tbl_zhongtan_invoice_masterbl a
    LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
    LEFT JOIN tbl_zhongtan_invoice_vessel v ON v.invoice_vessel_id = a.invoice_vessel_id
    WHERE a.state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.ata_date && doc.ata_date.length > 1 && doc.ata_date[0] && doc.ata_date[1]) {  
    queryStr += ' and STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") < ? '
    replacements.push(doc.ata_date[0])
    replacements.push(moment(doc.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  if (doc.invoice_vessel_id) {
    queryStr += ' and a.invoice_vessel_id = ? '
    replacements.push(doc.invoice_vessel_id)
  }
  let customer = {}
  if(doc.invoice_customer_id) {
    customer = await tb_user.findOne({
      where: {
        user_id: doc.invoice_customer_id
      }
    })
    queryStr += ` AND (a.invoice_masterbi_customer_id = ? OR a.invoice_masterbi_delivery_to = ? OR EXISTS (SELECT 1 FROM tbl_zhongtan_uploadfile WHERE uploadfile_index1 = a.invoice_masterbi_id AND uploadfile_received_from = ? AND state ='1')) `
    replacements.push(doc.invoice_customer_id)
    replacements.push(customer.user_name.trim())
    replacements.push(customer.user_name.trim())
  }
  if (doc.bl) {
    queryStr += ' and a.invoice_masterbi_bl like ? '
    replacements.push('%' + doc.bl + '%')
  }
  if(doc.do_status && doc.do_status === '1') {
    queryStr += ` and a.invoice_masterbi_do_date IS NOT NULL and  a.invoice_masterbi_do_date <> '' `
    if(doc.do_date && doc.do_date.length > 1 && doc.do_date[0] && doc.do_date[1]) {
      queryStr += ' and a.invoice_masterbi_do_date >= ? and a.invoice_masterbi_do_date < ? '
      replacements.push(doc.do_date[0])
      replacements.push(moment(doc.do_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  } else if(doc.do_status && doc.do_status === '2') {
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or  a.invoice_masterbi_do_date = '') `
  } else if(doc.do_status && doc.do_status === '3') {
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or a.invoice_masterbi_do_date = '') 
                  and ((a.invoice_masterbi_deposit_date IS NOT NULL and a.invoice_masterbi_deposit_date <> '') 
                        or (a.invoice_masterbi_fee_date IS NOT NULL and a.invoice_masterbi_fee_date <> '') 
                        or (a.invoice_masterbi_deposit_receipt_date IS NOT NULL and a.invoice_masterbi_deposit_receipt_date <> '') 
                        or (a.invoice_masterbi_invoice_receipt_date IS NOT NULL and a.invoice_masterbi_invoice_receipt_date <> '')) `
    if(doc.invoice_date && doc.invoice_date.length > 1 && doc.invoice_date[0] && doc.invoice_date[1]) {
      queryStr += ' and ((a.invoice_masterbi_deposit_date >= ? and a.invoice_masterbi_deposit_date < ?) or (a.invoice_masterbi_fee_date >= ? and a.invoice_masterbi_fee_date < ?)) '
      replacements.push(doc.invoice_date[0])
      replacements.push(moment(doc.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      replacements.push(doc.invoice_date[0])
      replacements.push(moment(doc.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if(doc.receipt_date && doc.receipt_date.length > 1 && doc.receipt_date[0] && doc.receipt_date[1]) {
      queryStr += ' and ((a.invoice_masterbi_deposit_receipt_date >= ? and a.invoice_masterbi_deposit_receipt_date < ?) or (a.invoice_masterbi_invoice_receipt_date >= ? and a.invoice_masterbi_invoice_receipt_date < ?)) '
      replacements.push(doc.receipt_date[0])
      replacements.push(moment(doc.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
      replacements.push(doc.receipt_date[0])
      replacements.push(moment(doc.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  } else if(doc.do_status && doc.do_status === '4'){
    queryStr += ` and (a.invoice_masterbi_do_date IS NULL or a.invoice_masterbi_do_date = '') 
                  and (a.invoice_masterbi_deposit_date IS NULL or a.invoice_masterbi_deposit_date = '' 
                        or a.invoice_masterbi_fee_date IS NULL or a.invoice_masterbi_fee_date = '') `
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") desc, a.invoice_masterbi_bl'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    let row = {}
    row.bl = r.invoice_masterbi_bl
    row.vessel = r.invoice_vessel_name + '/' + r.invoice_vessel_voyage
    row.vessel_ata = r.invoice_vessel_ata
    row.deposit_date = r.invoice_masterbi_deposit_date ? moment(r.invoice_masterbi_deposit_date).format('YYYY-MM-DD') : ''
    row.deposit_receipt_date = r.invoice_masterbi_deposit_receipt_date ? moment(r.invoice_masterbi_deposit_receipt_date).format('YYYY-MM-DD') : ''
    row.invoice_date = r.invoice_masterbi_fee_date ? moment(r.invoice_masterbi_fee_date).format('YYYY-MM-DD') : ''
    row.invoice_receipt_date = r.invoice_masterbi_invoice_receipt_date ? moment(r.invoice_masterbi_invoice_receipt_date).format('YYYY-MM-DD') : ''
    row.cargo = r.invoice_masterbi_cargo_type
    row.bl_type = r.invoice_masterbi_bl_type
    row.destination = r.invoice_masterbi_destination
    row.delivery = r.invoice_masterbi_delivery
    row.freight_terms = r.invoice_masterbi_freight
    row.loading = r.invoice_masterbi_loading
    row.containers_number = r.invoice_masterbi_container_no
    queryStr = `SELECT GROUP_CONCAT(DISTINCT invoice_containers_size SEPARATOR ',') AS containers_size_type FROM tbl_zhongtan_invoice_containers WHERE invoice_containers_bl = ? AND invoice_vessel_id = ? AND state = ? ORDER BY invoice_containers_size`
    replacements = [r.invoice_masterbi_bl, r.invoice_vessel_id, GLBConfig.ENABLE]
    let cons = await model.simpleSelect(queryStr, replacements)
    if(cons && cons.length > 0) {
      row.containers_size_type = cons[0].containers_size_type
    }
    row.exporter_name = r.invoice_masterbi_exporter_name
    row.exporter_address = r.invoice_masterbi_exporter_address
    row.consignee_name = r.invoice_masterbi_consignee_name
    row.consignee_address = r.invoice_masterbi_consignee_address
    row.notify_name = r.invoice_masterbi_notify_name
    row.notify_address = r.invoice_masterbi_notify_address
    row.do_release_party = r.invoice_masterbi_delivery_to ? r.invoice_masterbi_delivery_to.trim() : ''
    if(doc.invoice_customer_id && doc.invoice_customer_id === r.invoice_masterbi_customer_id) { 
      row.container_deposit_party = r.invoice_masterbi_customer_id ? customer.user_name.trim() : ''
    } else if(r.invoice_masterbi_customer_id){
      let customer = await tb_user.findOne({
        where: {
          user_id: r.invoice_masterbi_customer_id
        }
      })
      if(customer) {
        row.container_deposit_party = customer.user_name.trim()
      }
    }
    row.do_date = r.invoice_masterbi_do_date
    if(r.invoice_masterbi_do_date) {
      let file = await tb_uploadfile.findOne({
        where: {
          state: GLBConfig.ENABLE,
          api_name: 'RECEIPT-DO',
          uploadfile_index1: r.invoice_masterbi_id
        },
        order: [['uploadfile_id', 'DESC']]
      })
      if(file && file.user_id) {
        let user = await tb_user.findOne({
          where: {
            user_id: file.user_id
          }
        })
        if(user) {
          row.do_user = user.user_name
        }
      }
    }
    row.empty_return_depot = r.invoice_masterbi_do_return_depot
    renderData.push(row)
  }
  if(doc.do_status && doc.do_status === GLBConfig.DISABLE) {
    let filepath = await common.ejs2xlsx('exportUnReleaseStatisticsTemplate.xlsx', renderData)
    res.sendFile(filepath)
  } else {
    let filepath = await common.ejs2xlsx('exportReceiptTemplate.xlsx', renderData)
    res.sendFile(filepath)
  }
}
