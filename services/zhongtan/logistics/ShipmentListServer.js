const moment = require('moment')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const opSrv = require('../../common/system/OperationPasswordServer')
const freightSrv = require('../logistics/TBLFreightConfigServer')

const tb_shipment_list = model.zhongtan_logistics_shipment_list

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `select * from tbl_common_vendor where state = ? order by vendor_code, vendor_name`
  let replacements = [GLBConfig.ENABLE]
  let vendors = await model.simpleSelect(queryStr, replacements)
  let VENDOR = []
  if(vendors) {
    for(let v of vendors) {
      VENDOR.push({
        id: v.vendor_id,
        text: v.vendor_code + '-' + v.vendor_name
      })
    }
  }
  returnData.VENDOR = VENDOR
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ?`
  let replacements = [GLBConfig.ENABLE]
  let searchPara = doc.searchPara
  if(searchPara) {
    if(searchPara.shipment_list_bill_no) {
      queryStr = queryStr + ' and shipment_list_bill_no like ? '
      replacements.push('%' + searchPara.shipment_list_bill_no + '%')
    }
    if(searchPara.shipment_list_cntr_owner) {
      queryStr = queryStr + ' and shipment_list_cntr_owner = ? '
      replacements.push(searchPara.shipment_list_cntr_owner)
    }
    if(searchPara.shipment_list_cargo_type) {
      queryStr = queryStr + ' and shipment_list_cargo_type = ? '
      replacements.push(searchPara.shipment_list_cargo_type)
    }
    if(searchPara.shipment_list_business_type) {
      queryStr = queryStr + ' and shipment_list_business_type = ? '
      replacements.push(searchPara.shipment_list_business_type)
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and shipment_list_discharge_date >= ? and shipment_list_discharge_date <= ? '
        } else {
          queryStr = queryStr + ' and shipment_list_depot_gate_out_date >= ? and shipment_list_depot_gate_out_date <= ? '
        }
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and shipment_list_empty_return_date >= ? and shipment_list_empty_return_date <= ? '
        } else {
          queryStr = queryStr + ' and shipment_list_loading_date >= ? and shipment_list_loading_date <= ? '
        }
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
      }
    } else {
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        queryStr = queryStr + ' and ((shipment_list_discharge_date >= ? and shipment_list_discharge_date <= ?) OR (shipment_list_depot_gate_out_date >= ? and shipment_list_depot_gate_out_date <= ?)) '
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        queryStr = queryStr + ' and ((shipment_list_empty_return_date >= ? and shipment_list_empty_return_date <= ?) or (shipment_list_loading_date >= ? and shipment_list_loading_date <= ?)) '
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
    }
    if(searchPara.shipment_list_vendor) {
      queryStr = queryStr + ' and shipment_list_vendor like ? '
      replacements.push('%' + searchPara.shipment_list_vendor + '%')
    }
  }
  queryStr = queryStr + ' ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data
  return common.success(returnData)
}

exports.searchShipmentListAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let search_bl = '%' + doc.search_data.bill_no + '%'
  // IMPORT
  let queryStr = `SELECT * FROM tbl_zhongtan_invoice_containers c LEFT JOIN tbl_zhongtan_invoice_masterbl b 
                  ON c.invoice_vessel_id = b.invoice_vessel_id AND c.invoice_containers_bl = b.invoice_masterbi_bl 
                  WHERE c.state = ? AND b.state = ? AND b.invoice_masterbi_bl LIKE ? 
                  AND NOT EXISTS (SELECT 1 FROM tbl_zhongtan_logistics_shipment_list s WHERE s.state = ? AND s.shipment_list_bill_no = c.invoice_containers_bl AND s.shipment_list_container_no = c.invoice_containers_no) 
                  ORDER BY b.invoice_masterbi_bl, c.invoice_containers_no`
  let replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, search_bl, GLBConfig.ENABLE]
  let ret_import = await model.simpleSelect(queryStr, replacements)
  let total = 0
  let rows = []
  if(ret_import && ret_import.length > 0) {
    total = total + ret_import.length
    for(let d of ret_import) {
      let r = {}
      r.shipment_list_business_type = 'I'
      r.shipment_list_bill_no = d.invoice_containers_bl
      if(d.invoice_containers_bl.indexOf('COSU') >= 0){
        r.shipment_list_cntr_owner = 'COS'
      } else if(d.invoice_containers_bl.indexOf('OOLU') >= 0) {
        r.shipment_list_cntr_owner = 'OOL'
      }
      r.shipment_list_size_type = d.invoice_containers_size
      r.shipment_list_container_no = d.invoice_containers_no
      r.shipment_list_cargo_type = 'IMPORT'
      if(d.invoice_masterbi_cargo_type === 'TR') {
        r.shipment_list_cargo_type = 'TRANSIT'
      }
      r.shipment_list_port_of_destination = d.invoice_masterbi_destination
      r.shipment_list_discharge_date = d.invoice_containers_edi_discharge_date ? moment(d.invoice_containers_edi_discharge_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : ''
      r.shipment_list_port_of_loading = d.invoice_masterbi_loading
      r.shipment_list_empty_return_date = d.invoice_containers_actually_return_date ? moment(d.invoice_containers_actually_return_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : ''
      r.shipment_list_cargo_weight = d.invoice_containers_weight
      r._checked = false
      rows.push(r)
    }
  }
  // EXPORT
  queryStr = `SELECT * FROM tbl_zhongtan_export_proforma_container c LEFT JOIN tbl_zhongtan_export_proforma_masterbl b 
              ON c.export_vessel_id = b.export_vessel_id AND c.export_container_bl = b.export_masterbl_bl 
              WHERE c.state = ? AND b.state = ? AND b.export_masterbl_bl LIKE ? 
              AND NOT EXISTS (SELECT 1 FROM tbl_zhongtan_logistics_shipment_list s WHERE s.state = ? AND s.shipment_list_bill_no = c.export_container_bl AND s.shipment_list_container_no = c.export_container_no) 
              ORDER BY b.export_masterbl_bl, c.export_container_no`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, search_bl, GLBConfig.ENABLE]
  let ret_export = await model.simpleSelect(queryStr, replacements)
  if(ret_export && ret_export.length > 0) {
    total = total + ret_export.length
    for(let d of ret_export) {
      let r = {}
      r.shipment_list_business_type = 'E'
      r.shipment_list_bill_no = d.export_container_bl
      if(d.export_container_bl.indexOf('COSU') >= 0){
        r.shipment_list_cntr_owner = 'COS'
      } else if(d.export_container_bl.indexOf('OOLU') >= 0) {
        r.shipment_list_cntr_owner = 'OOL'
      }
      r.shipment_list_size_type = d.export_container_size_type
      r.shipment_list_container_no = d.export_container_no
      r.shipment_list_cargo_type = 'LOCAL'
      if(d.export_masterbl_cargo_type === 'TRANSIT') {
        r.shipment_list_cargo_type = 'TRANSIT'
      }
      r.shipment_list_port_of_destination = d.export_masterbl_port_of_discharge
      r.shipment_list_depot_gate_out_date = d.export_container_edi_depot_gate_out_date ? moment(d.export_container_edi_depot_gate_out_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : ''
      r.shipment_list_port_of_loading = d.export_masterbl_port_of_load
      if(r.shipment_list_cntr_owner === 'COS') {
        r.shipment_list_loading_date = d.export_container_edi_wharf_gate_in_date ? moment(d.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : ''
      } else if(r.shipment_list_cntr_owner === 'OOL') {
        r.shipment_list_loading_date = d.export_container_edi_loading_date ? moment(d.export_container_edi_loading_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : ''
      }
      r.shipment_list_cargo_weight = d.export_container_cargo_weight
      r._checked = false
      rows.push(r)
    }
  }
  returnData.total = total
  returnData.rows = rows
  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let addData = doc.add_shipment_list
  if(addData) {
    for(let d of addData) {
      await tb_shipment_list.create({
        shipment_list_business_type: d.shipment_list_business_type,
        shipment_list_bill_no: d.shipment_list_bill_no,
        shipment_list_cntr_owner: d.shipment_list_cntr_owner,
        shipment_list_size_type: d.shipment_list_size_type,
        shipment_list_container_no: d.shipment_list_container_no,
        shipment_list_cargo_type: d.shipment_list_cargo_type,
        shipment_list_port_of_destination: d.shipment_list_port_of_destination,
        shipment_list_discharge_date: d.shipment_list_discharge_date ? d.shipment_list_discharge_date : null,
        shipment_list_port_of_loading: d.shipment_list_port_of_loading,
        shipment_list_empty_return_date: d.shipment_list_empty_return_date ? d.shipment_list_empty_return_date : null,
        shipment_list_depot_gate_out_date: d.shipment_list_depot_gate_out_date ? d.shipment_list_depot_gate_out_date : null,
        shipment_list_loading_date: d.shipment_list_loading_date ? d.shipment_list_loading_date : null,
        shipment_list_cargo_weight: d.shipment_list_cargo_weight
      })
    }
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let oldData = doc.old
  let modifyData = doc.new
  if(modifyData) {
    let modifyRow = await tb_shipment_list.findOne({
      where: {
        shipment_list_id: modifyData.shipment_list_id,
        state: GLBConfig.ENABLE
      }
    })
    if(modifyRow) {
      modifyRow.shipment_list_port_of_loading = modifyData.shipment_list_port_of_loading
      modifyRow.shipment_list_port_of_destination = modifyData.shipment_list_port_of_destination
      modifyRow.shipment_list_dar_customs_release_date = modifyData.shipment_list_dar_customs_release_date
      modifyRow.shipment_list_truck_departure_date = modifyData.shipment_list_truck_departure_date
      modifyRow.shipment_list_truck_plate = modifyData.shipment_list_truck_plate
      modifyRow.shipment_list_ata_destination = modifyData.shipment_list_ata_destination
      modifyRow.shipment_list_delivery_date = modifyData.shipment_list_delivery_date
      modifyRow.shipment_list_vendor = modifyData.shipment_list_vendor ? modifyData.shipment_list_vendor : null
      modifyRow.shipment_list_remark = modifyData.shipment_list_remark
      modifyRow.shipment_list_ata_tz_border = modifyData.shipment_list_ata_tz_border
      modifyRow.shipment_list_ata_foreing_border = modifyData.shipment_list_ata_foreing_border
      modifyRow.shipment_list_border_release_date = modifyData.shipment_list_border_release_date
      await modifyRow.save()
      if((oldData.shipment_list_vendor && oldData.shipment_list_vendor !== modifyData.shipment_list_vendor) 
          || modifyData.shipment_list_vendor && oldData.shipment_list_vendor !== modifyData.shipment_list_vendor) {
        // 更新同提单号
        let sameRows = await tb_shipment_list.findAll({
          where: {
            shipment_list_bill_no: modifyData.shipment_list_bill_no,
            state: GLBConfig.ENABLE
          }
        })
        if(sameRows && sameRows.length > 0) {
          for(let s of sameRows) {
            if(s.shipment_list_id !== modifyData.shipment_list_id) {
              s.shipment_list_vendor = modifyData.shipment_list_vendor ? modifyData.shipment_list_vendor : null
              await s.save()
            }
            if(modifyData.shipment_list_vendor) {
              await this.updateShipmentFreight(s.shipment_list_id)
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let sl = await tb_shipment_list.findOne({
    where: {
      shipment_list_id: doc.shipment_list_id,
      state: GLBConfig.ENABLE
    }
  })
  if(sl) {
    sl.state = GLBConfig.DISABLE
    await sl.save()
  }
  return common.success()
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ?`
  let replacements = [GLBConfig.ENABLE]
  let searchPara = doc.searchPara
  if(searchPara) {
    if(searchPara.shipment_list_bill_no) {
      queryStr = queryStr + ' and shipment_list_bill_no like ? '
      replacements.push('%' + searchPara.shipment_list_bill_no + '%')
    }
    if(searchPara.shipment_list_cntr_owner) {
      queryStr = queryStr + ' and shipment_list_cntr_owner = ? '
      replacements.push(searchPara.shipment_list_cntr_owner)
    }
    if(searchPara.shipment_list_cargo_type) {
      queryStr = queryStr + ' and shipment_list_cargo_type = ? '
      replacements.push(searchPara.shipment_list_cargo_type)
    }
    if(searchPara.shipment_list_business_type) {
      queryStr = queryStr + ' and shipment_list_business_type = ? '
      replacements.push(searchPara.shipment_list_business_type)
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and shipment_list_discharge_date >= ? and shipment_list_discharge_date <= ? '
        } else {
          queryStr = queryStr + ' and shipment_list_depot_gate_out_date >= ? and shipment_list_depot_gate_out_date <= ? '
        }
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and shipment_list_empty_return_date >= ? and shipment_list_empty_return_date <= ? '
        } else {
          queryStr = queryStr + ' and shipment_list_loading_date >= ? and shipment_list_loading_date <= ? '
        }
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
      }
    } else {
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        queryStr = queryStr + ' and ((shipment_list_discharge_date >= ? and shipment_list_discharge_date <= ?) OR (shipment_list_depot_gate_out_date >= ? and shipment_list_depot_gate_out_date <= ?)) '
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        queryStr = queryStr + ' and ((shipment_list_empty_return_date >= ? and shipment_list_empty_return_date <= ?) or (shipment_list_loading_date >= ? and shipment_list_loading_date <= ?)) '
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
    }
    if(searchPara.shipment_list_vendor) {
      queryStr = queryStr + ' and shipment_list_vendor = ?  '
      replacements.push(searchPara.shipment_list_vendor)
    }
  }
  queryStr = queryStr + ' ORDER BY shipment_list_id DESC'
  let result = await model.simpleSelect(queryStr, replacements)
  let jsData = []
  let transits = []
  let imports = []
  for (let r of result) {
    if(r.shipment_list_business_type === 'I') {
      r.shipment_list_in_date = r.shipment_list_discharge_date
      r.shipment_list_out_date = r.shipment_list_empty_return_date
    } else {
      r.shipment_list_in_date = r.shipment_list_depot_gate_out_date
      r.shipment_list_out_date = r.shipment_list_loading_date
    }
    if(r.shipment_list_cargo_type === 'LOCAL') {
      r.shipment_list_cargo_type = 'IMPORT'
    }
    if(r.shipment_list_business_type === 'I') {
      imports.push(r)
    } else {
      transits.push(r)
    }
  }
  jsData.push(transits)
  jsData.push(imports)
  let filepath = await common.ejs2xlsx('LogisticsShipmentListTemplate.xlsx', jsData)
  res.sendFile(filepath)
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}


exports.updateShipmentFreight = async (shipment_list_id) => {
  let sp = await tb_shipment_list.findOne({
    where: {
      shipment_list_id: shipment_list_id,
      state: GLBConfig.ENABLE
    }
  })
  if(sp) {
    let freight = await freightSrv.countShipmentFreight(sp.shipment_list_vendor, sp.shipment_list_business_type, sp.shipment_list_cargo_type, 
      sp.shipment_list_business_type === 'I' ? 'TZDAR' : sp.shipment_list_port_of_loading, 
      sp.shipment_list_business_type === 'I' ? sp.shipment_list_port_of_destination : 'TZDAR', 
      sp.shipment_list_cntr_owner, sp.shipment_list_size_type, sp.shipment_list_business_type === 'I' ? sp.shipment_list_discharge_date : sp.shipment_list_loading_date)
    if(freight) {
      if(freight.freight_config_amount && sp.shipment_list_payment_status === '0') {
        sp.shipment_list_total_freight = freight.freight_config_amount
        sp.shipment_list_advance_payment = freight.freight_config_advance_amount
        sp.shipment_list_advance_percent = freight.freight_config_advance
        sp.shipment_list_balance_payment = new Decimal(freight.freight_config_amount).sub(freight.freight_config_advance_amount).toNumber()
        sp.shipment_list_payment_status = '1'
      }
      if(freight.freight_config_amount_receivable && sp.shipment_list_receivable_status === '0') {
        sp.shipment_list_receivable_freight = freight.freight_config_amount_receivable
        sp.shipment_list_receivable_status = '1'
      }
      sp.save()
    }
  }
}