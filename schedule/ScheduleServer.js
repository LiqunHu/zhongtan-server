const model = require('../app/model')
const moment = require('moment')

const tb_container = model.zhongtan_invoice_containers
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const cal_config_srv = require('../services/zhongtan/equipment/OverdueCalculationConfigServer')
const empty_stock_srv = require('../services/zhongtan/equipment/EmptyStockManagementServer')
const GLBConfig = require('../util/GLBConfig')

const resetDemurrageReceiptSeq = async () => {
  try{
    // 超期费Receipt NO Seq
    let queryStr = `UPDATE seqmysql SET currentValue = 0 WHERE seqname IN ('COSCOEquipmentReceiptSeq', 'OOCLEquipmentReceiptSeq');`
    let replacements = []
    await model.simpleUpdate(queryStr, replacements)

    // 箱损Receipt No
    queryStr = `UPDATE seqmysql SET currentValue = 0 WHERE seqname IN ('COSCOMNRReceiptSeq', 'OOCLMNRReceiptSeq');`
    replacements = []
    await model.simpleUpdate(queryStr, replacements)
  } finally {
    // continue regardless of error
  }
}

const calculationCurrentOverdueDays = async () => {
  try{
    let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, c.invoice_masterbi_carrier, d.user_name AS invoice_masterbi_deposit_party
    from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
    LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
    LEFT JOIN tbl_common_user d ON c.invoice_masterbi_customer_id = d.user_id
    WHERE a.state = '1' and (a.invoice_containers_empty_return_invoice_date is null or a.invoice_containers_empty_return_receipt_date is null)`
    let replacements = []
    let rows = await model.simpleSelect(queryStr, replacements)
    for(let d of rows) {
      let free_days = 0
      if(d.invoice_containers_empty_return_overdue_free_days) {
        free_days = d.invoice_containers_empty_return_overdue_free_days
      } else if(d.invoice_masterbi_cargo_type && d.invoice_masterbi_destination && d.invoice_masterbi_carrier){
        free_days = await cal_config_srv.queryContainerFreeDays(d.invoice_masterbi_cargo_type, d.invoice_masterbi_destination.substring(0, 2), d.invoice_masterbi_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
      }
      if(free_days > 0) {
        let discharge_date = d.invoice_vessel_ata
        if(d.invoice_containers_edi_discharge_date) {
          discharge_date = d.invoice_containers_edi_discharge_date
        }
        let return_date = moment().format('DD/MM/YYYY')
        if(d.invoice_containers_actually_return_date) {
          return_date = d.invoice_containers_actually_return_date
        }
        let cal_result = await cal_config_srv.demurrageCalculation(free_days, discharge_date, return_date, d.invoice_masterbi_cargo_type, d.invoice_masterbi_destination.substring(0, 2), d.invoice_masterbi_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
        if(cal_result.diff_days !== -1) {
          await tb_container.update({'invoice_containers_current_overdue_days': cal_result.overdue_days}, {'where': {'invoice_containers_id': d.invoice_containers_id}})
        } 
      }
    }
  } finally {
    // continue regardless of error
  }
}

const expireFixedDepositCheck = async () => {
  try{
    let queryStr = `SELECT * FROM tbl_zhongtan_customer_fixed_deposit WHERE state = '1' AND deposit_work_state = 'W' AND deposit_expire_date <= ?`
    let replacements = [moment().subtract(1, 'days').format('YYYY-MM-DD')]
    let rows = await model.simpleSelect(queryStr, replacements)
    for(let d of rows) {
      await tb_fixed_deposit.update({'deposit_work_state': 'E'}, {'where': {'fixed_deposit_id': d.fixed_deposit_id}})
    }
  } finally {
    // continue regardless of error
  }
}

const importEmptyStockContainer = async () => {
  let start_date = ''
  let end_date = moment().format('YYYY-MM-DD') + ' 00:00:00'
  // 导入进口数据到EMPTY STOCK
  let queryStr = `SELECT invoice_containers_bl, invoice_containers_no, invoice_containers_size, invoice_containers_edi_discharge_date, invoice_containers_gate_out_terminal_date, invoice_containers_actually_return_date, invoice_containers_depot_name 
                  FROM tbl_zhongtan_invoice_containers WHERE state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(start_date) {
    queryStr = queryStr + ` AND created_at >= ? `
    replacements.push(start_date)
  }
  if(end_date) {
    queryStr = queryStr + ` AND created_at < ? `
    replacements.push(end_date)
  }
  queryStr = queryStr + ` ORDER BY invoice_containers_id `
  let import_rows = await model.simpleSelect(queryStr, replacements)
  if(import_rows && import_rows.length > 0) {
    for(let ir of import_rows) {
      let esc = {
        container_no: ir.invoice_containers_no,
        size_type: ir.invoice_containers_size,
        container_owner: (ir.invoice_containers_bl && ir.invoice_containers_bl.indexOf('COS') >= 0) ? 'COSCO' : 'OOCL',
        bill_no: ir.invoice_containers_bl,
        depot_name: ir.invoice_containers_depot_name
      }
      if(ir.invoice_containers_edi_discharge_date) {
        esc.discharge_date = moment(ir.invoice_containers_edi_discharge_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      if(ir.invoice_containers_gate_out_terminal_date) {
        esc.gate_out_terminal_date = moment(ir.invoice_containers_gate_out_terminal_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      if(ir.invoice_containers_actually_return_date) {
        esc.gate_in_depot_date = moment(ir.invoice_containers_actually_return_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      await empty_stock_srv.importEmptyStockContainer('I', esc)
    }
  }
  // 导入出口数据到EMPTY STOCK
  queryStr = `SELECT export_container_bl, export_container_no, export_container_size_type, export_container_get_depot_name, export_container_edi_depot_gate_out_date, export_container_edi_wharf_gate_in_date, export_container_edi_loading_date 
              FROM tbl_zhongtan_export_proforma_container WHERE state = ? `
  replacements = [GLBConfig.ENABLE]
  if(start_date) {
    queryStr = queryStr + ` AND created_at >= ? `
    replacements.push(start_date)
  }
  if(end_date) {
    queryStr = queryStr + ` AND created_at < ? `
    replacements.push(end_date)
  }
  queryStr = queryStr + ` ORDER BY export_container_id `
  let export_rows = await model.simpleSelect(queryStr, replacements)
  if(export_rows && export_rows.length > 0) {
    for(let er of export_rows) {
      let esc = {
        container_no: er.export_container_no,
        size_type: er.export_container_size_type,
        container_owner: (er.export_container_bl && er.export_container_bl.indexOf('COS') >= 0) ? 'COSCO' : 'OOCL',
        bill_no: er.export_container_bl,
        depot_name: er.export_container_get_depot_name
      }
      if(er.export_container_edi_depot_gate_out_date) {
        esc.gate_out_depot_date = moment(er.export_container_edi_depot_gate_out_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      if(er.export_container_edi_wharf_gate_in_date) {
        esc.gate_in_terminal_date = moment(er.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      if(er.export_container_edi_loading_date) {
        esc.loading_date = moment(er.export_container_edi_loading_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      }
      await empty_stock_srv.importEmptyStockContainer('E', esc)
    }
  }
}

module.exports = {
  resetDemurrageReceiptSeq: resetDemurrageReceiptSeq,
  calculationCurrentOverdueDays: calculationCurrentOverdueDays,
  expireFixedDepositCheck: expireFixedDepositCheck,
  importEmptyStockContainer: importEmptyStockContainer
}