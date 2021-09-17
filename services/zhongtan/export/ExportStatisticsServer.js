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

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT b.export_masterbl_id, b.export_masterbl_bl, b.export_masterbl_cargo_type, b.export_masterbl_port_of_load, 
                  b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, b.export_masterbl_consignee_company, b.export_masterbl_forwarder_company, b.export_masterbl_cargo_descriptions,
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
    if (doc.search_data.forwarder) {
      queryStr += ` and  b.export_masterbl_forwarder_company = ?`
      replacements.push(doc.search_data.forwarder)
    }
    if (doc.search_data.shipper) {
      queryStr += ` and  b.export_masterbl_shipper_company like ?`
      replacements.push('%' + doc.search_data.shipper + '%')
    }
    if (doc.search_data.consignee) {
      queryStr += ` and  b.export_masterbl_consignee_company like ?`
      replacements.push('%' + doc.search_data.consignee + '%')
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
          export_container_bl: d.export_masterbl_bl,
          state: GLBConfig.ENABLE
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
  let queryStr = `SELECT c.*, b.export_masterbl_port_of_load, b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, 
                  b.export_masterbl_consignee_company, b.export_masterbl_forwarder_company, b.export_masterbl_cargo_descriptions, 
                  v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd 
                  FROM tbl_zhongtan_export_proforma_container c 
                  LEFT JOIN tbl_zhongtan_export_proforma_masterbl b ON c.export_vessel_id = b.export_vessel_id AND c.export_container_bl = b.export_masterbl_bl 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON c.export_vessel_id = v.export_vessel_id
                  WHERE c.state = 1 `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.masterbl_bl) {
      queryStr += ' and c.export_container_bl like ? '
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
    if (doc.search_data.forwarder) {
      queryStr += ` and  b.export_masterbl_forwarder_company = ?`
      replacements.push(doc.search_data.forwarder)
    }
    if (doc.search_data.shipper) {
      queryStr += ` and  b.export_masterbl_shipper_company like ?`
      replacements.push('%' + doc.search_data.shipper + '%')
    }
    if (doc.search_data.consignee) {
      queryStr += ` and  b.export_masterbl_consignee_company like ?`
      replacements.push('%' + doc.search_data.consignee + '%')
    }
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC, b.export_masterbl_bl'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  if(result) {
    for(let r of result) {
      renderData.push({
        bl: r.export_container_bl,
        vessel_voyage: r.export_vessel_name + ' ' + r.export_vessel_voyage,
        etd: r.export_vessel_etd ? moment(r.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : r.export_vessel_etd,
        pol: r.export_masterbl_port_of_load,
        pod: r.export_masterbl_port_of_discharge,
        volume: '1',
        cntr_type: r.export_container_size_type,
        cntr_no: r.export_container_no,
        shipper: r.export_masterbl_shipper_company,
        consignee: r.export_masterbl_consignee_company,
        agent: r.export_masterbl_forwarder_company,
        cargo_description: r.export_masterbl_cargo_descriptions
      }) 
    }
  }
  let filepath = await common.ejs2xlsx('ExportStatisticsTemplate.xlsx', renderData)
  res.sendFile(filepath)
}

exports.searchForwarderAct = async req => {
  let doc = common.docValidate(req)
  let retData = {}
  if(doc.query) {
    let queryStr = `select a.user_id, a.user_name, a.user_blacklist, a.user_customer_type from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}' and a.user_name LIKE ? ORDER BY user_name LIMIT 10`
    let replacements = ['%' + doc.query + '%']
    let agents = await model.simpleSelect(queryStr, replacements)
    retData.agents = JSON.parse(JSON.stringify(agents))
  }
  return common.success(retData)
}