const moment = require('moment')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const cal_config_srv = require('./OverdueCalculationConfigServer')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_vessel = model.zhongtan_export_proforma_vessel
const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_export_proforma_container
const tb_uploadfile = model.zhongtan_uploadfile
const tb_edi_depot = model.zhongtan_edi_depot
const tb_verification = model.zhongtan_export_verification
const tb_shipment_fee = model.zhongtan_export_shipment_fee

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT export_vessel_id, CONCAT(export_vessel_name, '/', export_vessel_voyage) export_vessel FROM tbl_zhongtan_export_proforma_vessel WHERE state = 1 ORDER BY STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') DESC`
  let replacements = []
  returnData['VESSELS'] = await model.simpleSelect(queryStr, replacements)
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['EDI_DEPOT'] = await tb_edi_depot.findAll({
    attributes: ['edi_depot_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['edi_depot_name', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT a.*, b.export_vessel_name, b.export_vessel_voyage, b.export_vessel_etd, c.export_masterbl_id, c.export_masterbl_bl_carrier, c.export_masterbl_cargo_type
                  from tbl_zhongtan_export_proforma_container a 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel b ON a.export_vessel_id = b.export_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_export_proforma_masterbl c ON a.export_container_bl = c.export_masterbl_bl AND c.state = '1' AND c.export_vessel_id = a.export_vessel_id AND c.bk_cancellation_status = '0'
                  WHERE a.state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.export_vessel_id) {
      queryStr += ' and a.export_vessel_id = ? '
      replacements.push(doc.search_data.export_vessel_id)
    }
    if (doc.search_data.export_container_bl) {
      queryStr += ' and a.export_container_bl like ? '
      replacements.push('%' + doc.search_data.export_container_bl + '%')
    }
    if (doc.search_data.export_container_no) {
      queryStr += ' and a.export_container_no like ? '
      replacements.push('%' + doc.search_data.export_container_no + '%')
    }
    if (doc.search_data.export_vessel_id) {
      queryStr += ' and a.export_vessel_id = ? '
      replacements.push(doc.search_data.export_vessel_id)
    }
    if (doc.search_data.etd_date && doc.search_data.etd_date.length > 1 && doc.search_data.etd_date[0] && doc.search_data.etd_date[1]) {
      let start_date = doc.search_data.loading_date[0]
      let end_date = doc.search_data.loading_date[1]
      queryStr += ` AND STR_TO_DATE(b.export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(b.export_vessel_etd, "%d/%m/%Y") < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  }
  queryStr += ' ORDER BY b.export_vessel_id DESC, a.export_container_bl, a.export_container_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  if(result.data) {
    let last_masterbl_id = ''
    let last_demurrage_receipt = 0
    let last_demurrage_invoice = 0
    for(let d of result.data) {
      if(d.export_container_edi_depot_gate_out_date) {
        d.export_container_edi_depot_gate_out_date_disabled = true
      } else {
        d.export_container_edi_depot_gate_out_date_disabled = false
      }
      if(d.export_container_edi_loading_date) {
        d.export_container_edi_loading_date_disabled = true
      } else {
        d.export_container_edi_loading_date_disabled = false
      }
      d.export_container_edi_loading_date_edit_enable = false
      // if(d.export_masterbl_bl_carrier === 'OOCL') {
      //   if(d.export_container_edi_loading_date && d.export_vessel_etd && moment(d.export_vessel_etd, 'DD/MM/YYYY').diff(moment(d.export_container_edi_loading_date, 'DD/MM/YYYY'), 'days') > 5) {
      //     d.export_container_edi_loading_date_edit_enable = true
      //   }
      // } else if(d.export_masterbl_bl_carrier === 'COSCO'){
      //   if(d.export_container_edi_loading_date && d.export_vessel_etd && moment(d.export_vessel_etd, 'DD/MM/YYYY').diff(moment(d.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY'), 'days') > 5) {
      //     d.export_container_edi_loading_date_edit_enable = true
      //   }
      // }
      
      // cargo_type, discharge_port, carrier, container_type, enabled_date
      d.export_container_cal_static_free_days = await cal_config_srv.queryContainerFreeDays(d.export_masterbl_cargo_type, null, d.export_masterbl_bl_carrier, d.export_container_size_type, d.export_vessel_etd, 'E')
      if(d.export_container_cal_free_days) {
        d.export_container_cal_free_days = parseInt(d.export_container_cal_free_days)
      } else {
        d.export_container_cal_free_days = parseInt(d.export_container_cal_static_free_days)
      }
      if(d.export_masterbl_id !== last_masterbl_id) {
        last_demurrage_receipt = await tb_shipment_fee.count({
          where: {
            fee_data_code: 'DND',
            export_masterbl_id: d.export_masterbl_id,
            shipment_fee_status: 'RE'
          }
        })

        last_demurrage_invoice = await tb_shipment_fee.count({
          where: {
            fee_data_code: 'DND',
            export_masterbl_id: d.export_masterbl_id,
            shipment_fee_status: 'IN'
          }
        })
      }
      if(last_demurrage_receipt > 0) {
        if(d.export_container_cal_demurrage_amount && (d.export_container_edi_loading_date || d.export_container_edi_wharf_gate_in_date) && d.export_container_edi_depot_gate_out_date) {
          d.export_container_cal_receipt = GLBConfig.ENABLE
        } else {
          d.export_container_cal_receipt = GLBConfig.DISABLE
        }
      } else {
        d.export_container_cal_receipt = GLBConfig.DISABLE
      }
      if(last_demurrage_invoice > 0) {
        d.export_container_cal_invoice = GLBConfig.ENABLE
      } else {
        d.export_container_cal_invoice = GLBConfig.DISABLE
      }
      d.end_date_title = 'Gatein'
      if(d.export_masterbl_bl_carrier === 'OOCL' &&(d.export_container_edi_loading_date || d.export_container_edi_wharf_gate_in_date)) {
        if(d.export_container_edi_loading_date && d.export_container_edi_wharf_gate_in_date) {
          if(moment(d.export_container_edi_loading_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))
            && moment(d.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))) {
            d.end_date_title = 'Loading'
          }
        } else if(moment(d.export_container_edi_loading_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20')) || moment(d.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))) {
          d.end_date_title = 'Loading'
        }
      }
    }
  }
  returnData.rows = result.data

  return common.success(returnData)
}

exports.calculationAct = async req => {
  let doc = common.docValidate(req)
  let gate_out_date = doc.gate_out_date
  let loading_date = doc.loading_date
  let charge_carrier = doc.bl_carrier
  let cargo_type = doc.cargo_type
  let free_days = 0
  if(doc.free_days) {
    free_days = parseInt(doc.free_days)
  }
  // free_days, discharge_date, return_date, cargo_type, discharge_port, carrier, container_type, enabled_date
  let cal_result = await cal_config_srv.demurrageCalculation(free_days, gate_out_date, loading_date, cargo_type, null, charge_carrier, doc.containers_size, loading_date, 'E')
  if(cal_result.diff_days === -1) {
    return common.error('equipment_02')
  } else {
    return cal_result
  }
}

exports.demurrageCalculationSaveAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let con = await tb_container.findOne({
    where: {
      export_container_id: doc.export_container_id
    }
  })
  if(con) {
    let gate_out_date = doc.export_container_edi_depot_gate_out_date
    let charge_carrier = doc.export_masterbl_bl_carrier
    let old_free_days = con.export_container_cal_free_days ? con.export_container_cal_free_days : doc.export_container_cal_static_free_days

    // 保存计算箱子超期信息
    if(doc.export_masterbl_bl_carrier === 'OOCL') {
      if(moment(doc.export_container_edi_wharf_gate_in_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))) {
        con.export_container_edi_loading_date = doc.export_container_edi_wharf_gate_in_date
      } else {
        con.export_container_edi_wharf_gate_in_date = doc.export_container_edi_wharf_gate_in_date
      }
    } else {
      if(doc.export_container_edi_wharf_gate_in_date) {
        con.export_container_edi_wharf_gate_in_date = doc.export_container_edi_wharf_gate_in_date
      }
    }
    
   
    con.export_container_edi_depot_gate_out_date = gate_out_date
    con.export_container_cal_free_days = doc.export_container_cal_free_days
    con.export_container_cal_demurrage_days = doc.export_container_cal_demurrage_days
    con.export_container_cal_demurrage_amount = doc.export_container_cal_demurrage_amount
    await con.save()
    let queryStr = ''
    let replacements = []
    if(old_free_days && doc.export_container_cal_free_days && 
      parseInt(old_free_days) !== parseInt(doc.export_container_cal_free_days)
      && !doc.free_days_single) {
      // 修改了免箱期 同步修改其他免箱期不同的箱子
      queryStr = `SELECT * FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? 
                      AND export_container_id != ? AND IFNULL(export_container_cal_free_days, '') != ?`
      replacements = [con.export_vessel_id, con.export_container_bl, con.export_container_id, doc.export_container_cal_free_days]
      let oCons = await model.simpleSelect(queryStr, replacements)
      if(oCons) {
        for(let c of oCons) {
          if(c.export_container_edi_depot_gate_out_date) {
            let oc = await tb_container.findOne({
              where: {
                export_container_id: c.export_container_id
              }
            })
            if(oc) {
              let oc_loading_date = doc.export_vessel_etd
              if(doc.export_masterbl_bl_carrier === 'OOCL' && con.export_container_edi_loading_date) {
                if(moment(con.export_container_edi_loading_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))) {
                  oc_loading_date = oc.export_container_edi_loading_date
                } else {
                  oc_loading_date = oc.export_container_edi_wharf_gate_in_date
                }
              }
              if(doc.export_masterbl_bl_carrier === 'COSCO' && con.export_container_edi_wharf_gate_in_date) {
                oc_loading_date = oc.export_container_edi_wharf_gate_in_date
              }
              oc.export_container_cal_free_days = doc.export_container_cal_free_days
              let cal_result = await cal_config_srv.demurrageCalculation(oc.export_container_cal_free_days, oc.export_container_edi_depot_gate_out_date, oc_loading_date, 
                doc.export_masterbl_cargo_type, null, charge_carrier, oc.export_container_size_type, doc.export_vessel_etd, 'E')
              if(cal_result) {
                oc.export_container_cal_demurrage_days = cal_result.overdue_days
                oc.export_container_cal_demurrage_amount = cal_result.overdue_amount
              }
              await oc.save()
            }
          } else {
            await tb_container.update(
                {'export_container_cal_free_days': doc.export_container_cal_free_days}, 
                {'where': {'export_container_id': c.export_container_id}}
              )
          }
        }
      }
    }
    // 合并计算提单滞期费，同步到托单应收滞期费项
    await this.mergeDemurrage2Shipment(con.export_vessel_id, con.export_container_bl, user.user_id)
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.getSelectionDemurrageAct = async req => {
  let doc = common.docValidate(req)
  let selectAll = doc.selectAll
  let queryStr = ''
  let replacements = []
  let total_demurrage_amount = 0
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    queryStr = `SELECT SUM(export_container_cal_demurrage_amount) AS total_demurrage_amount FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ?`
    replacements = [sel0.export_vessel_id, sel0.export_container_bl, GLBConfig.ENABLE]
    let result = await model.simpleSelect(queryStr, replacements)
    if(result && result.length > 0) {
      total_demurrage_amount = result[0].total_demurrage_amount
    }
  } else if(doc.selection && doc.selection.length > 0) {
    let con_ids = []
    for(let c of doc.selection) {
      con_ids.push(c.export_container_id)
    }
    queryStr = `SELECT SUM(export_container_cal_demurrage_amount) AS total_demurrage_amount FROM tbl_zhongtan_export_proforma_container WHERE export_container_id IN (?) AND state = ?`
    replacements = [con_ids, GLBConfig.ENABLE]
    let result = await model.simpleSelect(queryStr, replacements)
    if(result && result.length > 0) {
      total_demurrage_amount = result[0].total_demurrage_amount
    }
  }
  let retData = {
    total_demurrage_amount: total_demurrage_amount
  }
  return common.success(retData)
}

exports.deductionDemurrageAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let selectAll = doc.selectAll
  let queryStr = ''
  let replacements = []
  let deductionContainer = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    queryStr = `SELECT * FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? AND export_container_cal_demurrage_amount IS NOT NULL`
    replacements = [sel0.export_vessel_id, sel0.export_container_bl, GLBConfig.ENABLE]
    deductionContainer = await model.simpleSelect(queryStr, replacements)
  } else if(doc.selection && doc.selection.length > 0) {
    let con_ids = []
    for(let c of doc.selection) {
      con_ids.push(c.export_container_id)
    }
    queryStr = `SELECT * FROM tbl_zhongtan_export_proforma_container WHERE export_container_id IN (?) AND state = ?`
    replacements = [con_ids, GLBConfig.ENABLE]
    deductionContainer = await model.simpleSelect(queryStr, replacements)
  }
  if(deductionContainer && deductionContainer.length > 0) {
    let total_deduction_amount = parseInt(doc.deduction_amount)
    let deduction = parseInt(doc.deduction_amount / deductionContainer.length)
    for(let c of deductionContainer) {
      let con = await tb_container.findOne({
        where: {
          export_container_id: c.export_container_id
        }
      })
      if(total_deduction_amount > (deduction * 2 - 1)) {
        con.export_container_cal_deduction_amount = deduction
        total_deduction_amount = total_deduction_amount - deduction
      } else {
        con.export_container_cal_deduction_amount = total_deduction_amount
      }
      await con.save()
    }
    // 合并计算提单滞期费，同步到托单应收滞期费项
    await this.mergeDemurrage2Shipment(deductionContainer[0].export_vessel_id, deductionContainer[0].export_container_bl, user.user_id)
  }
}

exports.mergeDemurrage2Shipment = async (export_vessel_id, export_container_bl, user_id) => {
  let queryStr = `SELECT SUM(export_container_cal_demurrage_amount) AS bill_demurrage, SUM(export_container_cal_deduction_amount) AS deduction_demurrage FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ?`
  let replacements = [export_vessel_id, export_container_bl, GLBConfig.ENABLE]
  let sumRet = await model.simpleSelect(queryStr, replacements)
  if(sumRet && sumRet.length > 0 && sumRet[0].bill_demurrage && new Decimal(sumRet[0].bill_demurrage) >= 0) {
    // 
    let bill_demurrage = sumRet[0].bill_demurrage
    if(sumRet[0].deduction_demurrage && new Decimal(sumRet[0].deduction_demurrage) >= 0) {
      bill_demurrage = new Decimal(bill_demurrage).sub(sumRet[0].deduction_demurrage)
    }
    let bl = await tb_bl.findOne({
      where: {
        export_vessel_id: export_vessel_id,
        export_masterbl_bl: export_container_bl,
        bk_cancellation_status: GLBConfig.DISABLE,
        state: GLBConfig.ENABLE
      }
    })
    queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND fee_data_code = 'DND' AND shipment_fee_type = 'R' AND export_masterbl_id = ? `
    replacements = [bl.export_masterbl_id]
    let sf = await model.simpleSelect(queryStr, replacements)
    if(sf && sf.length > 0) {
      let receipt_amount = 0
      for(let f of sf) {
        if(f.shipment_fee_status === 'RE') {
          receipt_amount = new Decimal(receipt_amount).plus(new Decimal(f.shipment_fee_amount))
        } else if(f.shipment_fee_status === 'IN') {
          // 查询同一张发票的费用列表，删除对应发票，状态回退
          let uf = await tb_uploadfile.findOne({
            where: {
              uploadfile_id: f.shipment_fee_invoice_id,
              state: GLBConfig.ENABLE
            }
          })
          if(uf) {
            uf.state = GLBConfig.DISABLE
            await uf.save()
          }
          let osf = await tb_shipment_fee.findAll({
            where: {
              export_masterbl_id: f.export_masterbl_id,
              shipment_fee_invoice_id: f.shipment_fee_invoice_id,
              state: GLBConfig.ENABLE
            }
          })
          if(osf && osf.length > 0) {
            for(let os of osf) {
              os.shipment_fee_status = 'SA'
              os.shipment_fee_invoice_id = ''
              await os.save()
            }
          }
        } else if(f.shipment_fee_status === 'SU') {
          // 已提交的，全部撤回，重新提交
          queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee_log WHERE state = '1' AND shipment_fee_id = ? AND shipment_fee_status = ?`
          replacements = [f.shipment_fee_id, f.shipment_fee_status]
          let sfl = await model.simpleSelect(queryStr, replacements)
          if(sfl && sfl.length > 0) {
            for(let sl of sfl) {
              let ve = await tb_verification.findOne({
                where: {
                  export_verification_id: sl.shipment_relation_id,
                  state: GLBConfig.ENABLE
                }
              })
              if(ve) {
                ve.state = GLBConfig.DISABLE
                await ve.save()
              }
              let fsu = await tb_shipment_fee.findOne({
                where: {
                  shipment_fee_id: sl.shipment_fee_id,
                  state: GLBConfig.ENABLE
                }
              })
              if(fsu) {
                fsu.shipment_fee_status = 'SA'
                fsu.shipment_fee_invoice_id = ''
                await fsu.save()
              }
            }
          }
        }else {
          let fsa = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: f.shipment_fee_id
            }
          })
          fsa.shipment_fee_status = 'SA'
          fsa.shipment_fee_invoice_id = ''
          await fsa.save()
        }
      }
      if(receipt_amount > 0) {
        // 已有开收据费用，多退少补
        if(new Decimal(bill_demurrage) !== receipt_amount) {
          let diff_demurrage = new Decimal(bill_demurrage).sub(receipt_amount)
          let fre = await tb_shipment_fee.findOne({
            where: {
              fee_data_code: 'DND',
              shipment_fee_status: 'SA',
              shipment_fee_type: 'R',
              export_masterbl_id: bl.export_masterbl_id,
              state: GLBConfig.ENABLE
            }
          })
          if(fre) {
            fre.shipment_fee_amount = Decimal.isDecimal(diff_demurrage) ? diff_demurrage.toNumber() : diff_demurrage
            await fre.save()
          } else {
            await tb_shipment_fee.create({
              export_masterbl_id: bl.export_masterbl_id,
              fee_data_code: 'DND',
              fee_data_fixed: GLBConfig.ENABLE,
              shipment_fee_supplement: GLBConfig.DISABLE,
              shipment_fee_type: 'R',
              shipment_fee_fixed_amount: GLBConfig.ENABLE,
              shipment_fee_amount: Decimal.isDecimal(diff_demurrage) ? diff_demurrage.toNumber() : diff_demurrage,
              shipment_fee_currency: 'USD',
              shipment_fee_status: 'SA',
              shipment_fee_save_by: user_id,
              shipment_fee_save_at: new Date()
            })
          }

          
        }
      } else {
        let rfol = await tb_shipment_fee.findOne({
          where: {
            fee_data_code: 'DND',
            shipment_fee_status: 'SA',
            export_masterbl_id: bl.export_masterbl_id,
            state: GLBConfig.ENABLE,
            shipment_fee_type: 'R'
          }
        })
        rfol.shipment_fee_amount = Decimal.isDecimal(bill_demurrage) ? bill_demurrage.toNumber() : bill_demurrage
        await rfol.save()
      }
    } else {
      if(new Decimal(bill_demurrage) > 0) {
        // 新建超期费应收项目
        await tb_shipment_fee.create({
          export_masterbl_id: bl.export_masterbl_id,
          fee_data_code: 'DND',
          fee_data_fixed: GLBConfig.ENABLE,
          shipment_fee_supplement: GLBConfig.DISABLE,
          shipment_fee_type: 'R',
          shipment_fee_fixed_amount: GLBConfig.ENABLE,
          shipment_fee_amount: Decimal.isDecimal(bill_demurrage) ? bill_demurrage.toNumber() : bill_demurrage,
          shipment_fee_currency: 'USD',
          shipment_fee_status: 'SA',
          shipment_fee_save_by: user_id,
          shipment_fee_save_at: new Date()
        })
      }
    }

    queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND fee_data_code = 'DND' AND shipment_fee_type = 'P' AND export_masterbl_id = ? `
    replacements = [bl.export_masterbl_id]
    let pf = await model.simpleSelect(queryStr, replacements)
    if(pf && pf.length > 0) {
      let approve_amount = 0
      for(let f of pf) {
        if(f.shipment_fee_status === 'AP') {
          approve_amount = new Decimal(approve_amount).plus(new Decimal(f.shipment_fee_amount))
        } else {
          let df = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: f.shipment_fee_id
            }
          })
          df.state = GLBConfig.DISABLE
          await df.save()
        }
      }
      if(approve_amount > 0) {
        // 已有开收据费用，多退少补
        if(new Decimal(bill_demurrage) !== approve_amount) {
          let diff_demurrage = new Decimal(bill_demurrage).sub(approve_amount)
          let fpe = await tb_shipment_fee.findOne({
            where: {
              fee_data_code: 'DND',
              shipment_fee_status: 'SA',
              shipment_fee_type: 'P',
              export_masterbl_id: bl.export_masterbl_id,
              state: GLBConfig.ENABLE
            }
          })
          if(fpe) {
            fpe.shipment_fee_amount = Decimal.isDecimal(diff_demurrage) ? diff_demurrage.toNumber() : diff_demurrage
            await fpe.save()
          } else {
            queryStr = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_code = ? AND fee_data_payable = ? LIMIT 1`
            replacements = [GLBConfig.ENABLE, 'DND', GLBConfig.ENABLE]
            let payable_fee_data = await model.simpleSelect(queryStr, replacements)
            let shipment_fee_party = ''
            if(payable_fee_data && payable_fee_data.length > 0) {
              if(bl.export_masterbl_bl.indexOf('COSU') >= 0){
                shipment_fee_party = payable_fee_data[0].fee_data_payable_cosco_party
              } else if(bl.export_masterbl_bl.indexOf('OOLU') >= 0){
                shipment_fee_party = payable_fee_data[0].fee_data_payable_oocl_party
              }
            }
            // 新建超期费应付项目
            await tb_shipment_fee.create({
              export_masterbl_id: bl.export_masterbl_id,
              fee_data_code: 'DND',
              fee_data_fixed: GLBConfig.ENABLE,
              shipment_fee_supplement: GLBConfig.DISABLE,
              shipment_fee_type: 'P',
              shipment_fee_fixed_amount: GLBConfig.ENABLE,
              shipment_fee_amount: Decimal.isDecimal(diff_demurrage) ? diff_demurrage.toNumber() : diff_demurrage,
              shipment_fee_currency: 'USD',
              shipment_fee_status: 'SA',
              shipment_fee_save_by: user_id,
              shipment_fee_save_at: new Date(),
              shipment_fee_party: shipment_fee_party
            })
          }
        }
      } else {
        let pfol = await tb_shipment_fee.findOne({
          where: {
            fee_data_code: 'DND',
            shipment_fee_status: 'SA',
            export_masterbl_id: bl.export_masterbl_id,
            state: GLBConfig.ENABLE,
            shipment_fee_type: 'P'
          }
        })
        if(pfol) {
          pfol.shipment_fee_amount = Decimal.isDecimal(bill_demurrage) ? bill_demurrage.toNumber() : bill_demurrage
          await pfol.save()
        } else {
          queryStr = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_code = ? AND fee_data_payable = ? LIMIT 1`
          replacements = [GLBConfig.ENABLE, 'DND', GLBConfig.ENABLE]
          let payable_fee_data = await model.simpleSelect(queryStr, replacements)
          let shipment_fee_party = ''
          if(payable_fee_data && payable_fee_data.length > 0) {
            if(bl.export_masterbl_bl.indexOf('COSU') >= 0){
              shipment_fee_party = payable_fee_data[0].fee_data_payable_cosco_party
            } else if(bl.export_masterbl_bl.indexOf('OOLU') >= 0){
              shipment_fee_party = payable_fee_data[0].fee_data_payable_oocl_party
            }
          }
          // 新建超期费应付项目
          await tb_shipment_fee.create({
            export_masterbl_id: bl.export_masterbl_id,
            fee_data_code: 'DND',
            fee_data_fixed: GLBConfig.ENABLE,
            shipment_fee_supplement: GLBConfig.DISABLE,
            shipment_fee_type: 'P',
            shipment_fee_fixed_amount: GLBConfig.ENABLE,
            shipment_fee_amount: Decimal.isDecimal(bill_demurrage) ? bill_demurrage.toNumber() : bill_demurrage,
            shipment_fee_currency: 'USD',
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user_id,
            shipment_fee_save_at: new Date(),
            shipment_fee_party: shipment_fee_party
          })
        }
      }
    } else {
      queryStr = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_code = ? AND fee_data_payable = ? LIMIT 1`
      replacements = [GLBConfig.ENABLE, 'DND', GLBConfig.ENABLE]
      let payable_fee_data = await model.simpleSelect(queryStr, replacements)
      let shipment_fee_party = ''
      if(payable_fee_data && payable_fee_data.length > 0) {
        if(bl.export_masterbl_bl.indexOf('COSU') >= 0){
          shipment_fee_party = payable_fee_data[0].fee_data_payable_cosco_party
        } else if(bl.export_masterbl_bl.indexOf('OOLU') >= 0){
          shipment_fee_party = payable_fee_data[0].fee_data_payable_oocl_party
        }
      }
      // 新建超期费应付项目
      await tb_shipment_fee.create({
        export_masterbl_id: bl.export_masterbl_id,
        fee_data_code: 'DND',
        fee_data_fixed: GLBConfig.ENABLE,
        shipment_fee_supplement: GLBConfig.DISABLE,
        shipment_fee_type: 'P',
        shipment_fee_fixed_amount: GLBConfig.ENABLE,
        shipment_fee_amount: Decimal.isDecimal(bill_demurrage) ? bill_demurrage.toNumber() : bill_demurrage,
        shipment_fee_currency: 'USD',
        shipment_fee_status: 'SA',
        shipment_fee_save_by: user_id,
        shipment_fee_save_at: new Date(),
        shipment_fee_party: shipment_fee_party
      })
    }
  }
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


exports.calculationDemurrage2Shipment = async (export_vessel_id, export_container_bl, export_container_no, user_id) => {
  let con = await tb_container.findOne({
    where: {
      export_vessel_id: export_vessel_id,
      export_container_bl: export_container_bl,
      export_container_no: export_container_no,
      state: GLBConfig.ENABLE
    }
  })
  if(!con.export_container_cal_demurrage_amount && con.export_container_edi_depot_gate_out_date) {
    let vessel = await tb_vessel.findOne({
      where: {
        export_vessel_id: export_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    let bl = await tb_bl.findOne({
      where: {
        export_vessel_id: export_vessel_id,
        export_masterbl_bl: export_container_bl,
        state: GLBConfig.ENABLE
      }
    })
    if(vessel && vessel.export_vessel_etd && bl) {
      let loading_date = vessel.export_vessel_etd
      if(bl.export_masterbl_bl_carrier === 'OOCL' && con.export_container_edi_loading_date) {
        if(moment(con.export_container_edi_loading_date, 'DD/MM/YYYY').isBefore(moment('2022-08-20'))) {
          loading_date = con.export_container_edi_loading_date
        } else {
          loading_date = con.export_container_edi_wharf_gate_in_date
        }
      }
      if(bl.export_masterbl_bl_carrier === 'COSCO' && con.export_container_edi_wharf_gate_in_date) {
        loading_date = con.export_container_edi_wharf_gate_in_date
      }
      let cal_result = await cal_config_srv.demurrageCalculation(0, con.export_container_edi_depot_gate_out_date, loading_date, bl.export_masterbl_cargo_type, null, bl.export_masterbl_bl_carrier, con.export_container_size_type, loading_date, 'E')
      if(cal_result && cal_result.overdue_days >= 0 && con.export_container_cal_demurrage_days !== cal_result.overdue_days) {
        con.export_container_cal_demurrage_days = cal_result.overdue_days
        con.export_container_cal_demurrage_amount = cal_result.overdue_amount
        if(bl.export_masterbl_bl_carrier === 'OOCL' && !con.export_container_edi_loading_date) {
          con.export_container_edi_loading_date = loading_date
        }
        if(bl.export_masterbl_bl_carrier === 'COSCO' && !con.export_container_edi_wharf_gate_in_date) {
          con.export_container_edi_wharf_gate_in_date = loading_date
        }
        await con.save()
        if(cal_result.overdue_days > 0) {
          await this.mergeDemurrage2Shipment(export_vessel_id, export_container_bl, user_id)
        }
      }
    }
  }
}

exports.demurrageExporttAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.export_vessel_name, b.export_vessel_voyage, b.export_vessel_etd, c.export_masterbl_id, c.export_masterbl_bl_carrier, c.export_masterbl_cargo_type, f.shipment_fee_receipt_no
                  from tbl_zhongtan_export_proforma_container a 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel b ON a.export_vessel_id = b.export_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_export_proforma_masterbl c ON a.export_container_bl = c.export_masterbl_bl AND c.state = '1' AND c.export_vessel_id = a.export_vessel_id AND c.bk_cancellation_status = '0'
                  LEFT JOIN tbl_zhongtan_export_shipment_fee f ON c.export_masterbl_id = f.export_masterbl_id AND fee_data_code = 'DND' AND shipment_fee_status = 'RE' AND f.state = '1'
                  WHERE a.state = '1'`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.export_vessel_id) {
      queryStr += ' and a.export_vessel_id = ? '
      replacements.push(doc.search_data.export_vessel_id)
    }
    if (doc.search_data.export_container_bl) {
      queryStr += ' and a.export_container_bl like ? '
      replacements.push('%' + doc.search_data.export_container_bl + '%')
    }
    if (doc.search_data.export_container_no) {
      queryStr += ' and a.export_container_no like ? '
      replacements.push('%' + doc.search_data.export_container_no + '%')
    }
    if (doc.search_data.export_vessel_id) {
      queryStr += ' and a.export_vessel_id = ? '
      replacements.push(doc.search_data.export_vessel_id)
    }
    if (doc.search_data.loading_date && doc.search_data.loading_date.length > 1 && doc.search_data.loading_date[0] && doc.search_data.loading_date[1]) {
      let start_date = doc.search_data.loading_date[0]
      let end_date = doc.search_data.loading_date[1]
      queryStr += ` AND a.export_container_edi_loading_date >= ? and a.export_container_edi_loading_date < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  }
  queryStr += ' ORDER BY b.export_vessel_id DESC, a.export_container_bl, a.export_container_no'

  let sqlData = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  if(sqlData) {
    for(let d of sqlData) {
      if(d.export_masterbl_bl_carrier === 'OOCL') {
        d.export_container_loading_date_gate_in_data = d.export_container_edi_loading_date
      } else if(d.export_masterbl_bl_carrier === 'COSCO') {
        d.export_container_loading_date_gate_in_data = d.export_container_edi_wharf_gate_in_date
      }
      if(d.export_container_cal_demurrage_amount && d.export_container_loading_date_gate_in_data && d.export_container_edi_depot_gate_out_date) {
        //
      } else {
        d.shipment_fee_receipt_no = ''
      }
      renderData.push(d)
    }
  }
  let filepath = await common.ejs2xlsx('ExportDemurrageCalculationTemplate.xlsx', renderData)
  res.sendFile(filepath)
}