const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_invoice_containers

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

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_in_date && doc.search_data.gate_in_date.length > 1) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.gate_in_date[0])
      replacements.push(moment(doc.search_data.gate_in_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_out_date && doc.search_data.gate_out_date.length > 1) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_gate_out_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_gate_out_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.gate_out_date[0])
      replacements.push(moment(doc.search_data.gate_out_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.storing_min_days) {
      queryStr += ' and a.invoice_containers_storing_days >= ? '
      replacements.push( doc.search_data.storing_min_days)
    }
    if (doc.search_data.storing_max_days) {
      queryStr += ' and a.invoice_containers_storing_days <= ? '
      replacements.push( doc.search_data.storing_max_days)
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
    }
  }
  returnData.rows = result.data
  return common.success(returnData)
}

exports.saveContainerAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    if(doc.invoice_containers_gate_out_terminal_date) {
      con.invoice_containers_gate_out_terminal_date = doc.invoice_containers_gate_out_terminal_date
    }
    if(doc.invoice_containers_gate_in_terminal_date) {
      con.invoice_containers_gate_in_terminal_date = doc.invoice_containers_gate_in_terminal_date
    }
    if(doc.invoice_containers_gate_remark) {
      con.invoice_containers_gate_remark = doc.invoice_containers_gate_remark
    }
    con.save()
  }
  return common.success()
}

exports.exportEmptyStockAct = async(req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_in_date && doc.search_data.gate_in_date.length > 1) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.gate_in_date[0])
      replacements.push(moment(doc.search_data.gate_in_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_out_date && doc.search_data.gate_out_date.length > 1) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_gate_out_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_gate_out_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.gate_out_date[0])
      replacements.push(moment(doc.search_data.gate_out_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.storing_min_days) {
      queryStr += ' and a.invoice_containers_storing_days >= ? '
      replacements.push( doc.search_data.storing_min_days)
    }
    if (doc.search_data.storing_max_days) {
      queryStr += ' and a.invoice_containers_storing_days <= ? '
      replacements.push( doc.search_data.storing_max_days)
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
    row = JSON.parse(JSON.stringify(r))
    row.invoice_containers_bl_line = ''
    row.discharge_date = r.invoice_vessel_ata
    if(r.invoice_containers_edi_discharge_date) {
      row.discharge_date = r.invoice_containers_edi_discharge_date
    }
    if(r.invoice_containers_bl) {
      if(r.invoice_containers_bl.indexOf('COS') >= 0) {
        row.invoice_containers_bl_line = 'COSCO'
      } else if(r.invoice_containers_bl.indexOf('OOLU') >= 0) {
        row.invoice_containers_bl_line = 'OOCL'
      }
    }
    renderData.push(row)
  }
  let filepath = await common.ejs2xlsx('EmptyStock.xlsx', renderData)
  res.sendFile(filepath)
}
