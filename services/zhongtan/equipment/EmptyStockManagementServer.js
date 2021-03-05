const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_invoice_containers
const tb_empty_stock = model.zhongtan_empty_stock

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select * from tbl_zhongtan_empty_stock where state = ?`
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if (doc.search_data.discharge_date && doc.search_data.discharge_date.length > 1) {
      queryStr += ' and empty_stock_discharge_date >= ? and empty_stock_discharge_date < ? '
      replacements.push(doc.search_data.discharge_date[0])
      replacements.push(moment(doc.search_data.discharge_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_in_depot_date && doc.search_data.gate_in_depot_date.length > 1) {
      queryStr += ' and empty_stock_gate_in_depot_date >= ? and empty_stock_gate_in_depot_date < ? '
      replacements.push(doc.search_data.gate_in_depot_date[0])
      replacements.push(moment(doc.search_data.gate_in_depot_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_out_depot_date && doc.search_data.gate_out_depot_date.length > 1) {
      queryStr += ' and empty_stock_gate_out_depot_date >= ? and empty_stock_gate_out_depot_date < ? '
      replacements.push(doc.search_data.gate_out_depot_date[0])
      replacements.push(moment(doc.search_data.gate_out_depot_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.loading_date && doc.search_data.loading_date.length > 1) {
      queryStr += ' and empty_stock_loading_date >= ? and empty_stock_loading_date < ? '
      replacements.push(doc.search_data.loading_date[0])
      replacements.push(moment(doc.search_data.loading_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.storing_days_min) {
      queryStr += ' and empty_stock_storing_days >= ? '
      replacements.push( doc.search_data.storing_days_min)
    }
    if (doc.search_data.storing_days_max) {
      queryStr += ' and empty_stock_storing_days <= ? '
      replacements.push( doc.search_data.storing_days_max)
    }
    if (doc.search_data.detention_days_min) {
      queryStr += ' and empty_stock_detention_days >= ? '
      replacements.push( doc.search_data.detention_days_min)
    }
    if (doc.search_data.detention_days_max) {
      queryStr += ' and empty_stock_detention_days <= ? '
      replacements.push( doc.search_data.detention_days_max)
    }
    if (doc.search_data.containers_no) {
      queryStr += ' and empty_stock_container_no like ? '
      replacements.push('%' + doc.search_data.containers_no + '%')
    }
  }
  queryStr += ' ORDER BY empty_stock_id DESC'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
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
  let queryStr = `select * from tbl_zhongtan_empty_stock where state = ?`
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if (doc.search_data.discharge_date && doc.search_data.discharge_date.length > 1) {
      queryStr += ' and empty_stock_discharge_date >= ? and empty_stock_discharge_date < ? '
      replacements.push(doc.search_data.discharge_date[0])
      replacements.push(moment(doc.search_data.discharge_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_in_depot_date && doc.search_data.gate_in_depot_date.length > 1) {
      queryStr += ' and empty_stock_gate_in_depot_date >= ? and empty_stock_gate_in_depot_date < ? '
      replacements.push(doc.search_data.gate_in_depot_date[0])
      replacements.push(moment(doc.search_data.gate_in_depot_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.gate_out_depot_date && doc.search_data.gate_out_depot_date.length > 1) {
      queryStr += ' and empty_stock_gate_out_depot_date >= ? and empty_stock_gate_out_depot_date < ? '
      replacements.push(doc.search_data.gate_out_depot_date[0])
      replacements.push(moment(doc.search_data.gate_out_depot_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.loading_date && doc.search_data.loading_date.length > 1) {
      queryStr += ' and empty_stock_loading_date >= ? and empty_stock_loading_date < ? '
      replacements.push(doc.search_data.loading_date[0])
      replacements.push(moment(doc.search_data.loading_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.storing_days_min) {
      queryStr += ' and empty_stock_storing_days >= ? '
      replacements.push( doc.search_data.storing_days_min)
    }
    if (doc.search_data.storing_days_max) {
      queryStr += ' and empty_stock_storing_days <= ? '
      replacements.push( doc.search_data.storing_days_max)
    }
    if (doc.search_data.detention_days_min) {
      queryStr += ' and empty_stock_detention_days >= ? '
      replacements.push( doc.search_data.detention_days_min)
    }
    if (doc.search_data.detention_days_max) {
      queryStr += ' and empty_stock_detention_days <= ? '
      replacements.push( doc.search_data.detention_days_max)
    }
    if (doc.search_data.containers_no) {
      queryStr += ' and empty_stock_container_no like ? '
      replacements.push('%' + doc.search_data.containers_no + '%')
    }
  }
  queryStr += ' ORDER BY empty_stock_id DESC'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    let row = {}
    row = JSON.parse(JSON.stringify(r))
    row.empty_stock_depot_name = row.empty_stock_in_depot_name ? row.empty_stock_in_depot_name : row.empty_stock_out_depot_name
    renderData.push(row)
  }
  let filepath = await common.ejs2xlsx('EmptyStock.xlsx', renderData)
  res.sendFile(filepath)
}

exports.uploadEmptyStockContainer = async(esc) => {
  if(esc) {
    if(esc.container_no) {
      let queryStr = ` SELECT * FROM tbl_zhongtan_empty_stock WHERE state = ? AND empty_stock_container_no = ? ORDER BY empty_stock_id DESC LIMIT 1`
      let replacements = [GLBConfig.ENABLE, esc.container_no]
      let existEsc = await model.simpleSelect(queryStr, replacements)
      let upload_es = {}
      if(existEsc && existEsc.length > 0) {
        if(esc.discharge_date || esc.gate_out_terminal_date || esc.gate_in_depot_date) {
          // 进口
          if(existEsc[0].empty_stock_container_status === '2') {
            // 最新记录已离场, 新建
            upload_es = await tb_empty_stock.create({
              empty_stock_container_no: esc.container_no,
              empty_stock_container_status: '0'
            })
          }else {
            upload_es = await tb_empty_stock.findOne({
              where: {
                empty_stock_id: existEsc[0].empty_stock_id
              }
            })
          }
        } else if(esc.gate_out_depot_date || esc.gate_in_terminal_date || esc.loading_date) {
          // 出口
          upload_es = await tb_empty_stock.findOne({
            where: {
              empty_stock_id: existEsc[0].empty_stock_id
            }
          })
        }
      }else {
        upload_es = await tb_empty_stock.create({
          empty_stock_container_no: esc.container_no,
          empty_stock_container_status: '0'
        })
      }
      if(esc.size_type) {
        upload_es.empty_stock_size_type = esc.size_type
      }
      if(esc.container_owner) {
        if(esc.container_owner.indexOf('COS') >= 0 ) {
          upload_es.empty_stock_container_owner = 'COSCO'
        } else {
          upload_es.empty_stock_container_owner = 'OOCL'
        }
      }
      if(esc.discharge_date) {
        upload_es.empty_stock_discharge_date = esc.discharge_date
      }
      if(esc.gate_out_terminal_date) {
        upload_es.empty_stock_gate_out_terminal_date = esc.gate_out_terminal_date
      }
      if(esc.gate_in_depot_date) {
        upload_es.empty_stock_gate_in_depot_date = esc.gate_in_depot_date
        if(esc.depot_name) {
          upload_es.empty_stock_in_depot_name = esc.depot_name
        }
        upload_es.empty_stock_container_status = '1' //在场
      }
      if(esc.gate_out_depot_date) {
        upload_es.empty_stock_gate_out_depot_date = esc.gate_out_depot_date
        if(esc.depot_name) {
          upload_es.empty_stock_out_depot_name = esc.depot_name
        }
        upload_es.empty_stock_container_status = '2' //离场
      }
      if(esc.bill_no) {
        let bill_no = esc.bill_no
        if(common.isNumber(esc.bill_no)) {
          if(esc.container_owner && 'COSCO'.indexOf(esc.container_owner) >= 0) {
            bill_no = 'COSU' + esc.bill_no
          } else {
            bill_no = 'OOLU' + esc.bill_no
          }
        }
        if(esc.discharge_date || esc.gate_out_terminal_date || esc.gate_in_depot_date) {
          upload_es.empty_stock_in_bill_no = bill_no
        } else {
          upload_es.empty_stock_out_bill_no = bill_no
        }
      }
      if(esc.gate_in_terminal_date) {
        upload_es.empty_stock_gate_in_terminal_date = esc.gate_in_terminal_date
        upload_es.empty_stock_container_status = '2' //离场
      }
      if(esc.loading_date) {
        upload_es.empty_stock_loading_date = esc.loading_date
        upload_es.empty_stock_container_status = '2' //离场
      }
      if(esc.gate_out_depot_date && esc.gate_in_depot_date) {
        upload_es.empty_stock_storing_days = moment(esc.gate_out_depot_date).diff(moment(esc.gate_in_depot_date), 'days') + 1
      }
      if(esc.loading_date && esc.discharge_date) {
        upload_es.empty_stock_detention_days = moment(esc.loading_date).diff(moment(esc.discharge_date), 'days') + 1
      }
      await upload_es.save()
    }
  }
}

exports.importEmptyStockContainer = async(business_type, esc) => {
  if(business_type === 'I') {
    // 进口
    await tb_empty_stock.create({
      empty_stock_container_no: esc.container_no,
      empty_stock_size_type: esc.size_type,
      empty_stock_container_owner: esc.container_owner,
      empty_stock_container_status: esc.gate_in_depot_date ? '1' : '0',
      empty_stock_in_depot_name: esc.depot_name,
      empty_stock_in_bill_no: esc.bill_no,
      empty_stock_discharge_date: esc.discharge_date,
      empty_stock_gate_out_terminal_date: esc.gate_out_terminal_date,
      empty_stock_gate_in_depot_date: esc.gate_in_depot_date
    })
  } else if(business_type === 'E') {
    // 出口
    let queryStr = ` SELECT * FROM tbl_zhongtan_empty_stock WHERE state = ? AND empty_stock_container_no = ? ORDER BY empty_stock_id DESC LIMIT 1`
    let replacements = [GLBConfig.ENABLE, esc.container_no]
    let existEsc = await model.simpleSelect(queryStr, replacements)
    if(existEsc && existEsc.length > 0) {
      let upload_es = await tb_empty_stock.findOne({
        where: {
          empty_stock_id: existEsc[0].empty_stock_id
        }
      })
      if(upload_es) {
        if(esc.depot_name) {
          upload_es.empty_stock_out_depot_name = esc.depot_name
        }
        if(esc.gate_out_depot_date) {
          upload_es.empty_stock_gate_out_depot_date = esc.gate_out_depot_date
          upload_es.empty_stock_container_status = '2'
        }
        if(esc.gate_in_terminal_date) {
          upload_es.empty_stock_gate_in_terminal_date = esc.gate_in_terminal_date
          upload_es.empty_stock_container_status = '2'
        }
        if(esc.loading_date) {
          upload_es.empty_stock_loading_date = esc.loading_date
          upload_es.empty_stock_container_status = '2'
        }
        if(upload_es.empty_stock_gate_out_depot_date && upload_es.empty_stock_gate_in_depot_date) {
          upload_es.empty_stock_storing_days = moment(upload_es.empty_stock_gate_out_depot_date).diff(moment(upload_es.empty_stock_gate_in_depot_date), 'days') + 1
        }
        if(upload_es.empty_stock_loading_date && upload_es.empty_stock_discharge_date) {
          upload_es.empty_stock_detention_days = moment(upload_es.empty_stock_loading_date).diff(moment(upload_es.empty_stock_discharge_date), 'days') + 1
        }
        await upload_es.save()
      }
    } else {
      await tb_empty_stock.create({
        empty_stock_container_no: esc.container_no,
        empty_stock_size_type: esc.size_type,
        empty_stock_container_owner: esc.container_owner,
        empty_stock_container_status: (esc.gate_out_depot_date || esc.gate_in_terminal_date || esc.loading_date) ? '2' : '0',
        empty_stock_out_depot_name: esc.depot_name,
        empty_stock_out_bill_no: esc.bill_no,
        empty_stock_gate_out_depot_date: esc.gate_out_depot_date,
        empty_stock_gate_in_terminal_date: esc.gate_in_terminal_date,
        empty_stock_loading_date: esc.loading_date
      })
    }
  }
}
