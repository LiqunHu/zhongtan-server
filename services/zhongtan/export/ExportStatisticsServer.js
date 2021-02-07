const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_proforma_container = model.zhongtan_export_proforma_container
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

  let queryStr = `SELECT export_vessel_id, export_vessel_name, export_vessel_voyage FROM tbl_zhongtan_export_proforma_vessel WHERE state = '1' ORDER BY STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") DESC`
  let replacements = []
  let vessels = await model.simpleSelect(queryStr, replacements)
  returnData['VESSELS'] = vessels

  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  let agents = await model.simpleSelect(queryStr, replacements)
  returnData['AGENTS'] = agents
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT b.export_masterbl_id, b.export_masterbl_bl, b.export_masterbl_cargo_type, b.export_masterbl_port_of_load, b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, 
                  v.export_vessel_id, v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd, f.total_count, f.receipt_count, f.total_amount
                  from tbl_zhongtan_export_proforma_masterbl b 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON b.export_vessel_id = v.export_vessel_id 
                  LEFT JOIN (SELECT export_masterbl_id, COUNT(1) AS total_count, COUNT(if(shipment_fee_status = 'RE', 1, null)) AS receipt_count, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_type = 'R' GROUP BY export_masterbl_id) f ON f.export_masterbl_id = b.export_masterbl_id 
                  WHERE b.state = 1 `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.masterbl_bl) {
      queryStr += ' and b.export_masterbl_bl like ? '
      replacements.push('%' + doc.search_data.masterbl_bl + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and v.export_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.etd_date && doc.search_data.etd_date.length > 1 && doc.search_data.etd_date[0] && doc.search_data.etd_date[1]) {
      queryStr += ' and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.etd_date[0])
      replacements.push(moment(doc.search_data.etd_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.charge_status === 'RELEASE') {
      queryStr += ` and f.total_count = f.receipt_count and f.total_count > 0 `
    }
    if (doc.search_data.charge_status === 'HOLD') {
      queryStr += ` and f.total_count != f.receipt_count `
    }
    if (doc.search_data.receivable_agent) {
      queryStr += ` and EXISTS (SELECT 1 FROM tbl_zhongtan_export_shipment_fee f WHERE f.export_masterbl_id = b.export_masterbl_id AND f.state = '1' AND f.shipment_fee_type = 'R' AND f.shipment_fee_party = ? GROUP BY f.export_masterbl_id) `
      replacements.push(doc.search_data.receivable_agent)
    }
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC, b.export_masterbl_bl'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      let cons = await tb_proforma_container.findAll({
        where: {
          export_vessel_id: d.export_vessel_id,
          export_container_bl: d.export_masterbl_bl
        },
        order: [['export_container_no', 'ASC']]
      })
      if(cons) {
        queryStr = `SELECT shipment_fee_status, shipment_fee_party, u.user_name, shipment_fee_receipt_no, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee f LEFT JOIN tbl_common_user u ON f.shipment_fee_party = u.user_id WHERE f.state = '1' AND shipment_fee_type = 'R' AND export_masterbl_id = ? GROUP BY shipment_fee_status, shipment_fee_party, shipment_fee_receipt_no
        `
        replacements = [d.export_masterbl_id]
        let fees = await model.simpleSelect(queryStr, replacements)
        d.receivable_detail = fees
        for(let c of cons) {
          let bl = JSON.parse(JSON.stringify(d))
          bl.container_id = c.export_container_id
          bl.container_no = c.export_container_no
          bl.container_size_type = c.export_container_size_type
          bl.container_volume = 1
          if(d.total_count === d.receipt_count && d.receipt_count > 0) {
            bl.charge_status = 'RELEASE'
          } else {
            bl.charge_status = 'HOLD'
          }
          rows.push(bl)
        }
      }
    }
  }
  returnData.rows = rows

  return common.success(returnData)
}

exports.exportStatisticsAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT b.export_masterbl_id, b.export_masterbl_bl, b.export_masterbl_cargo_type, b.export_masterbl_port_of_load, b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, 
                  v.export_vessel_id, v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd, f.total_count, f.receipt_count, f.total_amount
                  from tbl_zhongtan_export_proforma_masterbl b 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON b.export_vessel_id = v.export_vessel_id 
                  LEFT JOIN (SELECT export_masterbl_id, COUNT(1) AS total_count, COUNT(if(shipment_fee_status = 'RE', 1, null)) AS receipt_count, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_type = 'R' GROUP BY export_masterbl_id) f ON f.export_masterbl_id = b.export_masterbl_id 
                  WHERE b.state = 1 `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.masterbl_bl) {
      queryStr += ' and b.export_masterbl_bl like ? '
      replacements.push('%' + doc.search_data.masterbl_bl + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and v.export_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.etd_date && doc.search_data.etd_date.length > 1 && doc.search_data.etd_date[0] && doc.search_data.etd_date[1]) {
      queryStr += ' and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.etd_date[0])
      replacements.push(moment(doc.search_data.etd_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.charge_status === 'RELEASE') {
      queryStr += ` and f.total_count = f.receipt_count and f.total_count > 0 `
    }
    if (doc.search_data.charge_status === 'HOLD') {
      queryStr += ` and f.total_count != f.receipt_count `
    }
    if (doc.search_data.receivable_agent) {
      queryStr += ` and EXISTS (SELECT 1 FROM tbl_zhongtan_export_shipment_fee f WHERE f.export_masterbl_id = b.export_masterbl_id AND f.state = '1' AND f.shipment_fee_type = 'R' AND f.shipment_fee_party = ? GROUP BY f.export_masterbl_id) `
      replacements.push(doc.search_data.receivable_agent)
    }
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC, b.export_masterbl_bl'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  if(result) {
    for(let r of result) {
      queryStr = `SELECT GROUP_CONCAT(b.container_size_name, '*', a.container_count) AS group_size, SUM(a.container_count) AS total_count FROM (
        SELECT export_container_size_type, COUNT(export_container_size_type) AS container_count FROM tbl_zhongtan_export_proforma_container 
        WHERE export_container_bl = ? AND export_vessel_id = ? GROUP BY export_container_size_type) a 
        LEFT JOIN tbl_zhongtan_container_size b ON (a.export_container_size_type = b.container_size_code OR a.export_container_size_type = b.container_size_name) AND b.state = '1'`
      replacements = [r.export_masterbl_bl, r.export_vessel_id]
      let con_info = await model.simpleSelect(queryStr, replacements)
      let container_volume = ''
      let container_size = ''
      if(con_info && con_info.length > 0) {
        container_volume = con_info[0].total_count
        container_size = con_info[0].group_size
      }
      queryStr = `SELECT shipment_fee_status, shipment_fee_party, u.user_name, shipment_fee_receipt_no, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee f LEFT JOIN tbl_common_user u ON f.shipment_fee_party = u.user_id WHERE f.state = '1' AND shipment_fee_type = 'R' AND export_masterbl_id = ? GROUP BY shipment_fee_status, shipment_fee_party, shipment_fee_receipt_no
        `
      replacements = [r.export_masterbl_id]
      let fees = await model.simpleSelect(queryStr, replacements)
      if(fees && fees.length > 0) {
        for(let f of fees) {
          renderData.push({
            bl: r.export_masterbl_bl,
            bl_status: (r.total_count === r.receipt_count && r.receipt_count > 0) ? 'RELEASE' : 'HOLD',
            vessel_voyage: r.export_vessel_name + ' ' + r.export_vessel_voyage,
            etd: r.export_vessel_etd ? moment(r.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : r.export_vessel_etd,
            pol: r.export_masterbl_port_of_load,
            pod: r.export_masterbl_port_of_discharge,
            volume: container_volume,
            cntr_type: container_size,
            shipper: r.export_masterbl_shipper_company,
            total_receivable: r.total_amount,
            receivable: f.total_amount,
            receipt_no: f.shipment_fee_receipt_no,
            agent: f.user_name
          }) 
        }
      } else {
        renderData.push({
          bl: r.export_masterbl_bl,
          bl_status: 'HOLD',
          vessel_voyage: r.export_vessel_name + ' ' + r.export_vessel_voyage,
          etd: r.export_vessel_etd ? moment(r.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : r.export_vessel_etd,
          pol: r.export_masterbl_port_of_load,
          pod: r.export_masterbl_port_of_discharge,
          volume: container_volume,
          cntr_type: container_size,
          shipper: r.export_masterbl_shipper_company
        }) 
      }
    }
  }
  let filepath = await common.ejs2xlsx('FreightChargeListTemplate.xlsx', renderData)
  res.sendFile(filepath)
}
