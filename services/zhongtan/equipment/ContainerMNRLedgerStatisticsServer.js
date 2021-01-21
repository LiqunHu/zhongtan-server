const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_container_size = model.zhongtan_container_size
const tb_uploadfile = model.zhongtan_uploadfile
const tb_user = model.common_user
const tb_discharge_port = model.zhongtan_discharge_port

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['DESTINATION'] = await tb_discharge_port.findAll({
    attributes: ['discharge_port_code', 'discharge_port_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['discharge_port_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  returnData['MNR_CARGO_TYPE'] = GLBConfig.MNR_CARGO_TYPE
  returnData['MNR_DESCRIPTION'] = GLBConfig.MNR_DESCRIPTION
  returnData['CASH_BANK_INFO'] = GLBConfig.CASH_BANK_INFO
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' AND ((mnr_ledger_invoice_date IS NOT NULL AND mnr_ledger_invoice_date != '') OR (mnr_ledger_receipt_date IS NOT NULL AND mnr_ledger_receipt_date != '')) `
  let replacements = []
  if(doc.search_data) {
    if(doc.search_data.invoice_date && doc.search_data.invoice_date.length > 1) {
      let start_date = doc.search_data.invoice_date[0]
      let end_date = doc.search_data.invoice_date[1]
      queryStr += ` AND mnr_ledger_invoice_date >= ? and mnr_ledger_invoice_date < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if(doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1) {
      let start_date = doc.search_data.receipt_date[0]
      let end_date = doc.search_data.receipt_date[1]
      queryStr += ` AND mnr_ledger_receipt_date >= ? and mnr_ledger_receipt_date < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.mnr_ledger_bl) {
      queryStr += ' and mnr_ledger_bl like ? '
      replacements.push('%' + doc.search_data.mnr_ledger_bl + '%')
    }
    if (doc.search_data.container_no) {
      queryStr += ' and mnr_ledger_container_no like ? '
      replacements.push('%' + doc.search_data.container_no + '%')
    }
  }
  queryStr += ' ORDER BY container_mnr_ledger_id DESC'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for(let r of result.data) {
    r.mnr_atts = await tb_uploadfile.findAll({
      where: {
        api_name: 'MNR-LEDGER',
        uploadfile_index1: r.container_mnr_ledger_id
      }
    })

    queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.uploadfile_index1 = ? and (api_name = ? or api_name = ?) order by a.uploadfile_id desc`
    replacements = [r.container_mnr_ledger_id, 'MNR-INVOICE', 'MNR-RECEIPT']
    r.mnr_files = []
    let files = await model.simpleSelect(queryStr, replacements)
    if(files) {
      for(let f of files) {
        let filetype = 'MNR Invoice'
        if(f.api_name === 'MNR-RECEIPT') {
          filetype = 'MNR Receipt'
        }
        r.mnr_files.push({
          container_mnr_ledger_id: r.container_mnr_ledger_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
      }
    }

    queryStr = `SELECT * FROM tbl_zhongtan_uploadfile WHERE uploadfile_index1 = ? AND api_name = 'MNR-INVOICE' AND uploadfile_state = 'AP' 
      AND uploadfile_id > IFNULL((SELECT MAX(uploadfile_id) FROM tbl_zhongtan_uploadfile WHERE uploadfile_index1 = ? AND api_name = 'MNR-RECEIPT'), 0) ORDER BY uploadfile_id DESC LIMIT 1`
    replacements = [r.container_mnr_ledger_id, r.container_mnr_ledger_id]
    let apFiles = await model.simpleSelect(queryStr, replacements)
    if(apFiles && apFiles.length > 0) {
      r.receipt_disabled =  false
      r.receipts = JSON.parse(JSON.stringify(apFiles[0]))
      if(r.receipts.uploadfile_customer_id) {
        let customer = await tb_user.findOne({
          where: {
            user_id: r.receipts.uploadfile_customer_id
          }
        })
        r.receipts.customers = [{
          user_id: customer.user_id,
          user_name: customer.user_name
        }]
      }
    } else {
      // 没有满足条件可开收据的invoice
      r.receipt_disabled =  true
    }
    returnData.rows.push(r)
  }
  return common.success(returnData)
}

exports.exportAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' AND ((mnr_ledger_invoice_date IS NOT NULL AND mnr_ledger_invoice_date != '') OR (mnr_ledger_receipt_date IS NOT NULL AND mnr_ledger_receipt_date != '')) `
  let replacements = []
  if(doc.search_data) {
    if(doc.search_data.invoice_date && doc.search_data.invoice_date.length > 1) {
      let start_date = doc.search_data.invoice_date[0]
      let end_date = doc.search_data.invoice_date[1]
      queryStr += ` AND mnr_ledger_invoice_date >= ? and mnr_ledger_invoice_date < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if(doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1) {
      let start_date = doc.search_data.receipt_date[0]
      let end_date = doc.search_data.receipt_date[1]
      queryStr += ` AND mnr_ledger_receipt_date >= ? and mnr_ledger_receipt_date < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.mnr_ledger_bl) {
      queryStr += ' and mnr_ledger_bl like ? '
      replacements.push('%' + doc.search_data.mnr_ledger_bl + '%')
    }
    if (doc.search_data.containers_no) {
      queryStr += ' and mnr_ledger_container_no like ? '
      replacements.push('%' + doc.search_data.containers_no + '%')
    }
  }
  queryStr += ' ORDER BY container_mnr_ledger_id DESC'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []

  let siezeTypes = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  for (let r of result) {
    if(r.mnr_ledger_dv_amount) {
      r.mnr_ledger_dv_amount_display = formatCurrency(r.mnr_ledger_dv_amount)
    }
    if(r.mnr_ledger_actual_charge_amount) {
      r.mnr_ledger_actual_charge_amount_display = formatCurrency(r.mnr_ledger_actual_charge_amount)
    }
    if(siezeTypes && r.mnr_ledger_container_size) {
      for(let s of siezeTypes) {
        if(s.container_size_code === r.mnr_ledger_container_size || s.container_size_name === r.mnr_ledger_container_size) {
          r.mnr_ledger_container_size = s.container_size_name
          break
        }
      }
    }
    if(r.mnr_ledger_vessel_ata) {
      r.mnr_ledger_vessel_ata = moment(r.mnr_ledger_vessel_ata, 'DD/MM/YYYY').format('YYYYMMDD')
    }
    if(r.mnr_ledger_loss_declaring_date) {
      r.mnr_ledger_loss_declaring_date = moment(r.mnr_ledger_loss_declaring_date, 'DD/MM/YYYY').format('YYYYMMDD')
    }
    if(r.mnr_ledger_payment_date) {
      r.mnr_ledger_payment_date = moment(r.mnr_ledger_payment_date, 'DD/MM/YYYY').format('YYYYMMDD')
    }

    if(r.mnr_ledger_check_cash) {
      if (r.mnr_ledger_check_cash === 'CASH') {
        r.mnr_ledger_receipt_remark = 'Cash'
      } else if (r.mnr_ledger_check_cash === 'TRANSFER') {
        r.mnr_ledger_receipt_remark = 'Bank transfer/ ' + r.mnr_ledger_bank_reference_no
      } else {
        r.mnr_ledger_receipt_remark = 'Cheque/ ' + r.mnr_ledger_check_no
      }
    }
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('MNRTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

function formatCurrency(num) {
  num = num.toString().replace(/[^\d.-]/g, '') //转成字符串并去掉其中除数字, . 和 - 之外的其它字符。
  if (isNaN(num)) num = '0' //是否非数字值
  let sign = num == (num = Math.abs(num))
  num = Math.floor(num * 100 + 0.50000000001) //下舍入
  let cents = num % 100 //求余 余数 = 被除数 - 除数 * 商
  cents = cents < 10 ? '0' + cents : cents //小于2位数就补齐
  num = Math.floor(num / 100).toString()
  for (let i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
    //每隔三位小数分始开隔
    //4 ==> 三位小数加一个分隔符，
    num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3))
  }
  return (sign ? '' : '-') + num + '.' + cents
}