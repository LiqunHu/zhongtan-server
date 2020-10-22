const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_container_size = model.zhongtan_container_size
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile

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
  let queryStr = `SELECT invoice_vessel_id, CONCAT(invoice_vessel_name, '/', invoice_vessel_voyage) AS vessel_info FROM tbl_zhongtan_invoice_vessel WHERE state = 1 ORDER BY invoice_vessel_name, invoice_vessel_voyage`
  let replacements = []
  returnData['VESSEL'] = await model.simpleSelect(queryStr, replacements)
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = 1 AND user_type = '${GLBConfig.TYPE_CUSTOMER}' ORDER BY user_name`
  replacements = []
  returnData['CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
  from tbl_zhongtan_invoice_containers a 
  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
  WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
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
    if (doc.search_data.vessel_id) {
      queryStr += ' and a.invoice_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.customer_id) {
      queryStr += ' and a.invoice_containers_customer_id = ? '
      replacements.push(doc.search_data.customer_id)
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
      // 查询发票及收据列表
      let rcons = await tb_invoice_container.findAll({
        where: {
          overdue_invoice_containers_invoice_containers_id: d.invoice_containers_id,
          overdue_invoice_containers_receipt_date: {
            [Op.ne]: null
          }
        },
        order: [['overdue_invoice_containers_overdue_days', 'DESC'], ['overdue_invoice_containers_receipt_date', 'DESC']]
      })
      let invoice_data = []
      let receipt_data = []
      if(rcons) {
        for(let i = 0; i < rcons.length; i++) {
          let ifile = await tb_uploadfile.findOne({
            where: {
              uploadfile_id: rcons[i].overdue_invoice_containers_invoice_uploadfile_id
            }
          })
          if(ifile) {
            invoice_data.push({
              invoice_no: ifile.uploadfile_invoice_no,
              invoice_date: moment(ifile.created_at).format('YYYY-MM-DD HH:ss'),
              invoice_amount: rcons[i].overdue_invoice_containers_overdue_invoice_amount
            })
            let rfile = await tb_uploadfile.findOne({
              where: {
                uploadfile_index3: ifile.uploadfile_id
              }
            })
            if(rfile) {
              receipt_data.push({
                receipt_no: rfile.uploadfile_receipt_no,
                receipt_date: moment(rfile.created_at).format('YYYY-MM-DD HH:ss'),
                bank_reference_no: rfile.uploadfile_bank_reference_no,
                check_no: rfile.uploadfile_check_no
              })
            }
          }
        }
      }
      d.invoice_data = invoice_data
      d.receipt_data = receipt_data
    }
  }
  returnData.rows = result.data
  return common.success(returnData)
}

exports.exportDemurrageReportAct = async(req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party  
  from tbl_zhongtan_invoice_containers a 
  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
  WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
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
    if (doc.search_data.vessel_id) {
      queryStr += ' and a.invoice_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.customer_id) {
      queryStr += ' and a.invoice_containers_customer_id = ? '
      replacements.push(doc.search_data.customer_id)
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
    row.vessel_name = r.invoice_vessel_name
    row.vessel_voyage = r.invoice_vessel_voyage
    row.discharge_date = r.invoice_vessel_ata
    row.payer = r.user_name
    row.invoice_masterbi_demurrage_party = r.invoice_masterbi_demurrage_party
    row.invoice_masterbi_deposit_party = r.invoice_masterbi_deposit_party
    let rcons = await tb_invoice_container.findAll({
      where: {
        overdue_invoice_containers_invoice_containers_id: r.invoice_containers_id,
        overdue_invoice_containers_receipt_date: {
          [Op.ne]: null
        }
      },
      order: [['overdue_invoice_containers_overdue_days', 'DESC'], ['overdue_invoice_containers_receipt_date', 'DESC']]
    })
    if(rcons && rcons.length > 0) {
      for(let i = 0; i < rcons.length; i++) {
        let retRow = JSON.parse(JSON.stringify(row))
        retRow.free_days = rcons[i].overdue_invoice_containers_overdue_free_days
        retRow.overdue_days = rcons[i].overdue_invoice_containers_overdue_increase_days
        retRow.staring_date = rcons[i].overdue_invoice_containers_overdue_staring_date
        retRow.return_date = rcons[i].overdue_invoice_containers_return_date
        retRow.invoice_amount = rcons[i].overdue_invoice_containers_overdue_invoice_amount
        let ifile = await tb_uploadfile.findOne({
          where: {
            uploadfile_id: rcons[i].overdue_invoice_containers_invoice_uploadfile_id
          }
        })
        if(ifile) {
          retRow.invoice_date = moment(ifile.created_at).format('YYYY-MM-DD HH:ss')
          retRow.invoice_no = ifile.uploadfile_invoice_no
          let rfile = await tb_uploadfile.findOne({
            where: {
              uploadfile_index3: ifile.uploadfile_id
            }
          })
          if(rfile) {
            retRow.receipt_date = moment(rfile.created_at).format('YYYY-MM-DD HH:ss')
            retRow.receipt_no = rfile.uploadfile_receipt_no
            retRow.bank_reference_no = rfile.uploadfile_bank_reference_no
            retRow.check_no = rfile.uploadfile_check_no
          }
        }
        renderData.push(retRow)
      }
    } else {
      renderData.push(row)
    }
  }

  let filepath = await common.ejs2xlsx('DemurrageTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

exports.exportDemurrageAdminReportAct = async(req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
  from tbl_zhongtan_invoice_containers a 
  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
  WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null)`
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
    if (doc.search_data.vessel_id) {
      queryStr += ' and a.invoice_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.customer_id) {
      queryStr += ' and a.invoice_containers_customer_id = ? '
      replacements.push(doc.search_data.customer_id)
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
    row.vessel_name = r.invoice_vessel_name
    row.vessel_voyage = r.invoice_vessel_voyage
    row.discharge_date = r.invoice_vessel_ata
    row.payer = r.user_name
    row.edi_return_date = r.invoice_containers_actually_return_date
    row.actual_overdue_days = r.invoice_containers_actually_return_overdue_days
    row.actual_amount = r.invoice_containers_actually_return_overdue_amount
    row.balance = ''
    if(r.invoice_containers_empty_return_overdue_amount_invoice && r.invoice_containers_actually_return_overdue_amount) {
      row.balance = parseFloat(r.invoice_containers_empty_return_overdue_amount_invoice) - parseFloat(r.invoice_containers_actually_return_overdue_amount)
    }
    row.invoice_masterbi_demurrage_party = r.invoice_masterbi_demurrage_party
    row.invoice_masterbi_deposit_party = r.invoice_masterbi_deposit_party
    let rcons = await tb_invoice_container.findAll({
      where: {
        overdue_invoice_containers_invoice_containers_id: r.invoice_containers_id,
        overdue_invoice_containers_receipt_date: {
          [Op.ne]: null
        }
      },
      order: [['overdue_invoice_containers_overdue_days', 'DESC'], ['overdue_invoice_containers_receipt_date', 'DESC']]
    })
    if(rcons && rcons.length > 0) {
      for(let i = 0; i < rcons.length; i++) {
        let retRow = JSON.parse(JSON.stringify(row))
        retRow.free_days = rcons[i].overdue_invoice_containers_overdue_free_days
        retRow.overdue_days = rcons[i].overdue_invoice_containers_overdue_increase_days
        retRow.staring_date = rcons[i].overdue_invoice_containers_overdue_staring_date
        retRow.return_date = rcons[i].overdue_invoice_containers_return_date
        retRow.invoice_amount = rcons[i].overdue_invoice_containers_overdue_invoice_amount
        let ifile = await tb_uploadfile.findOne({
          where: {
            uploadfile_id: rcons[i].overdue_invoice_containers_invoice_uploadfile_id
          }
        })
        if(ifile) {
          retRow.invoice_date = moment(ifile.created_at).format('YYYY-MM-DD HH:ss')
          retRow.invoice_no = ifile.uploadfile_invoice_no
          let rfile = await tb_uploadfile.findOne({
            where: {
              uploadfile_index3: ifile.uploadfile_id
            }
          })
          if(rfile) {
            retRow.receipt_date = moment(rfile.created_at).format('YYYY-MM-DD HH:ss')
            retRow.receipt_no = rfile.uploadfile_receipt_no
            retRow.bank_reference_no = rfile.uploadfile_bank_reference_no
            retRow.check_no = rfile.uploadfile_check_no
          }
        }
        renderData.push(retRow)
      }
    } else {
      renderData.push(row)
    }
  }
  let filepath = await common.ejs2xlsx('DemurrageAdminTemplate.xlsx', renderData)
  res.sendFile(filepath)
}