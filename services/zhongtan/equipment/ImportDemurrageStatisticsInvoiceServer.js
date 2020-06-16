const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id LEFT JOIN tbl_common_user d on a.invoice_containers_customer_id = d.user_id WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_date && doc.search_data.invoice_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_invoice_date >= ? and a.invoice_containers_empty_return_invoice_date < ? '
      replacements.push(doc.search_data.invoice_date[0])
      replacements.push(moment(doc.search_data.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_receipt_date >= ? and a.invoice_containers_empty_return_receipt_date < ? '
      replacements.push(doc.search_data.receipt_date[0])
      replacements.push(moment(doc.search_data.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  if(result.data) {
    for(let d of result.data) {
      if(d.invoice_containers_bl) {
        if(d.invoice_containers_bl.indexOf('COS') >= 0) {
          d.invoice_containers_bl_line = 'COSCO'
        } else if(d.invoice_containers_bl.indexOf('OOLU') >= 0) {
          d.invoice_containers_bl_line = 'OOCL'
        }
      }
      if(d.invoice_containers_empty_return_invoice_date) {
        d.invoice_containers_empty_return_invoice_date = moment(d.invoice_containers_empty_return_invoice_date).format('YYYY-MM-DD HH:ss')
      }
      if(d.invoice_containers_empty_return_receipt_date) {
        d.invoice_containers_empty_return_receipt_date = moment(d.invoice_containers_empty_return_receipt_date).format('YYYY-MM-DD HH:ss')
      }
      if(d.invoice_containers_empty_return_overdue_amount && d.invoice_containers_actually_return_overdue_amount) {
        d.invoice_containers_actually_balance = parseFloat(d.invoice_containers_actually_balance) - parseFloat(d.invoice_containers_actually_return_overdue_amount)
      }
    }
  }
  returnData.rows = result.data
  return common.success(returnData)
}

exports.exportDemurrageReportAct = async(req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id LEFT JOIN tbl_common_user d on a.invoice_containers_customer_id = d.user_id WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_date && doc.search_data.invoice_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_invoice_date >= ? and a.invoice_containers_empty_return_invoice_date < ? '
      replacements.push(doc.search_data.invoice_date[0])
      replacements.push(moment(doc.search_data.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_receipt_date >= ? and a.invoice_containers_empty_return_receipt_date < ? '
      replacements.push(doc.search_data.receipt_date[0])
      replacements.push(moment(doc.search_data.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.simpleSelect(queryStr, replacements)

  let renderData = []

  for (let r of result) {
    let row = {}
    row.container_no = r.invoice_containers_no
    row.container_size_type = r.invoice_containers_size
    row.container_line = ''
    if(r.invoice_containers_bl) {
      if(r.invoice_containers_bl.indexOf('COS') >= 0) {
        row.container_line = 'COSCO'
      } else if(r.invoice_containers_bl.indexOf('OOLU') >= 0) {
        row.container_line = 'OOCL'
      }
    }
    row.billlading_no = r.invoice_containers_bl
    row.discharge_date = r.invoice_vessel_ata
    row.return_date = r.invoice_containers_empty_return_date_invoice
    row.invoice_amount = r.invoice_containers_empty_return_overdue_amount_invoice
    row.invoice_date = ''
    if(r.invoice_containers_empty_return_invoice_date) {
      row.invoice_date = moment(r.invoice_containers_empty_return_invoice_date).format('YYYY-MM-DD HH:ss')
    }
    row.payer = r.user_name
    row.receipt_date = ''
    if(r.invoice_containers_empty_return_receipt_date) {
      row.receipt_date = moment(r.invoice_containers_empty_return_receipt_date).format('YYYY-MM-DD HH:ss')
    }
    row.receipt_no = r.invoice_containers_empty_return_date_receipt_no
    renderData.push(row)
  }

  let filepath = await common.ejs2xlsx('DemurrageTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

exports.exportDemurrageAdminReportAct = async(req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id LEFT JOIN tbl_common_user d on a.invoice_containers_customer_id = d.user_id WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_date && doc.search_data.invoice_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_invoice_date >= ? and a.invoice_containers_empty_return_invoice_date < ? '
      replacements.push(doc.search_data.invoice_date[0])
      replacements.push(moment(doc.search_data.invoice_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1) {
      queryStr += ' and a.invoice_containers_empty_return_receipt_date >= ? and a.invoice_containers_empty_return_receipt_date < ? '
      replacements.push(doc.search_data.receipt_date[0])
      replacements.push(moment(doc.search_data.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.simpleSelect(queryStr, replacements)

  let renderData = []

  for (let r of result) {
    let row = {}
    row.container_no = r.invoice_containers_no
    row.container_size_type = r.invoice_containers_size
    row.container_line = ''
    if(r.invoice_containers_bl) {
      if(r.invoice_containers_bl.indexOf('COS') >= 0) {
        row.container_line = 'COSCO'
      } else if(r.invoice_containers_bl.indexOf('OOLU') >= 0) {
        row.container_line = 'OOCL'
      }
    }
    row.billlading_no = r.invoice_containers_bl
    row.discharge_date = r.invoice_vessel_ata
    row.return_date = r.invoice_containers_empty_return_date_invoice
    row.invoice_amount = r.invoice_containers_empty_return_overdue_amount_invoice
    row.invoice_date = ''
    if(r.invoice_containers_empty_return_invoice_date) {
      row.invoice_date = moment(r.invoice_containers_empty_return_invoice_date).format('YYYY-MM-DD HH:ss')
    }
    row.payer = r.user_name
    row.receipt_date = ''
    if(r.invoice_containers_empty_return_receipt_date) {
      row.receipt_date = moment(r.invoice_containers_empty_return_receipt_date).format('YYYY-MM-DD HH:ss')
    }
    row.receipt_no = r.invoice_containers_empty_return_date_receipt_no
    row.edi_return_date = r.invoice_containers_actually_return_date
    row.actual_overdue_days = r.invoice_containers_actually_return_overdue_days
    row.actual_amount = r.invoice_containers_actually_return_overdue_amount
    row.balance = ''
    if(r.invoice_containers_empty_return_overdue_amount && r.invoice_containers_actually_return_overdue_amount) {
      row.balance = parseFloat(r.invoice_containers_empty_return_overdue_amount) - parseFloat(r.invoice_containers_actually_return_overdue_amount)
    }
    renderData.push(row)
  }

  let filepath = await common.ejs2xlsx('DemurrageAdminTemplate.xlsx', renderData)

  res.sendFile(filepath)
}