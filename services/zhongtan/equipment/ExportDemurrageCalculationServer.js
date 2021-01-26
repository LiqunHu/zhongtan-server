const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const cal_config_srv = require('./OverdueCalculationConfigServer')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_export_proforma_container
const tb_uploadfile = model.zhongtan_uploadfile
const tb_edi_depot = model.zhongtan_edi_depot
const tb_verificatione = model.zhongtan_export_verification
const tb_shipment_fee = model.zhongtan_export_shipment_fee

exports.initAct = async () => {
  let returnData = {}
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
                  LEFT JOIN tbl_zhongtan_export_proforma_masterbl c ON a.export_container_bl = c.export_masterbl_bl AND c.state = '1' AND c.export_vessel_id = a.export_vessel_id 
                  WHERE a.state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.export_container_bl) {
      queryStr += ' and a.export_container_bl like ? '
      replacements.push('%' + doc.search_data.export_container_bl + '%')
    }
    if (doc.search_data.export_container_no) {
      queryStr += ' and a.export_container_no like ? '
      replacements.push('%' + doc.search_data.export_container_no + '%')
    }
    if (doc.search_data.export_vessel_name) {
      queryStr += ' and b.export_vessel_name like ? '
      replacements.push('%' + doc.search_data.export_vessel_name + '%')
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
            fee_data_code: 'DEMURRAGE',
            export_masterbl_id: d.export_masterbl_id,
            shipment_fee_status: 'RE'
          }
        })

        last_demurrage_invoice = await tb_shipment_fee.count({
          where: {
            fee_data_code: 'DEMURRAGE',
            export_masterbl_id: d.export_masterbl_id,
            shipment_fee_status: 'IN'
          }
        })
      }
      if(last_demurrage_receipt > 0) {
        d.export_container_cal_receipt = GLBConfig.ENABLE
      } else {
        d.export_container_cal_receipt = GLBConfig.DISABLE
      }
      if(last_demurrage_invoice > 0) {
        d.export_container_cal_invoice = GLBConfig.ENABLE
      } else {
        d.export_container_cal_invoice = GLBConfig.DISABLE
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
    if(doc.export_masterbl_bl_carrier === 'OOCL' && doc.export_container_edi_loading_date) {
      con.export_container_edi_loading_date = doc.export_container_edi_loading_date
    }
    if(doc.export_masterbl_bl_carrier === 'COSCO' && doc.export_container_edi_wharf_gate_in_date) {
      con.export_container_edi_wharf_gate_in_date = doc.export_container_edi_wharf_gate_in_date
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
              if(oc.export_container_edi_loading_date) {
                oc_loading_date = oc.invoice_containers_edi_discharge_date
              }
              oc.export_container_cal_free_days = doc.export_container_cal_free_days
              let cal_result = await cal_config_srv.demurrageCalculation(oc.export_container_cal_free_days, oc.export_container_edi_depot_gate_out_date, oc_loading_date, 
                doc.export_masterbl_cargo_type, null, charge_carrier, oc.export_container_size_type, doc.export_vessel_etd, 'E')
              if(cal_result) {
                oc.export_container_cal_demurrage_days = cal_result.overdue_days
                oc.export_container_cal_demurrage_amount = cal_result.overdue_amount
              }
              oc.save()
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
    queryStr = `SELECT SUM(export_container_cal_demurrage_amount) AS bill_demurrage FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ?`
    replacements = [con.export_vessel_id, con.export_container_bl, GLBConfig.ENABLE]
    let sumRet = await model.simpleSelect(queryStr, replacements)
    if(sumRet && sumRet.length > 0 && sumRet[0].bill_demurrage && new Decimal(sumRet[0].bill_demurrage) >= 0) {
      // 
      let bl = await tb_bl.findOne({
        where: {
          export_vessel_id: con.export_vessel_id,
          export_masterbl_bl: con.export_container_bl,
          state: GLBConfig.ENABLE
        }
      })
      queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee WHERE fee_data_code = 'DND' AND shipment_fee_type = 'R' AND export_masterbl_id = ? `
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
            queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee_log WHERE shipment_fee_id = ? AND shipment_fee_status = ?`
            replacements = [f.shipment_fee_id, f.shipment_fee_status]
            let sfl = await model.simpleSelect(queryStr, replacements)
            if(sfl && sfl.length > 0) {
              for(let sl of sfl) {
                let ve = await tb_verificatione.findOne({
                  where: {
                    export_verification_id: sl.shipment_relation_id,
                    state: GLBConfig.ENABLE
                  }
                })
                if(ve) {
                  ve.state = GLBConfig.DISABLE
                  await ve.save()
                }
                let f1 = await tb_shipment_fee.findOne({
                  where: {
                    shipment_fee_id: sl.shipment_fee_id,
                    state: GLBConfig.ENABLE
                  }
                })
                if(f1) {
                  f1.shipment_fee_status = 'SA'
                  f1.shipment_fee_invoice_id = ''
                  await f1.save()
                }
              }
            }
          }else {
            let f1 = await tb_shipment_fee.findOne({
              where: {
                shipment_fee_id: f.shipment_fee_id
              }
            })
            f1.shipment_fee_status = 'SA'
            f1.shipment_fee_invoice_id = ''
            await f1.save()
          }
        }
        if(receipt_amount > 0) {
          // 已有开收据费用，多退少补
          if(new Decimal(sumRet[0].bill_demurrage) !== receipt_amount) {
            let diff_demurrage = new Decimal(sumRet[0].bill_demurrage).sub(receipt_amount)
            let f1 = await tb_shipment_fee.findOne({
              where: {
                fee_data_code: 'DND',
                shipment_fee_status: 'SA'
              }
            })
            if(f1) {
              f1.shipment_fee_amount = Decimal.isDecimal(diff_demurrage) ? diff_demurrage.toNumber() : diff_demurrage
              await f1.save()
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
                shipment_fee_save_by: user.user_id,
                shipment_fee_save_at: new Date()
              })
            }
          }
        } else {
          let f1 = await tb_shipment_fee.findOne({
            where: {
              fee_data_code: 'DND',
              shipment_fee_status: 'SA'
            }
          })
          f1.shipment_fee_amount = sumRet[0].bill_demurrage
          await f1.save()
        }
      } else {
        if(new Decimal(sumRet[0].bill_demurrage) > 0) {
          // 新建超期费项目
          await tb_shipment_fee.create({
            export_masterbl_id: bl.export_masterbl_id,
            fee_data_code: 'DND',
            fee_data_fixed: GLBConfig.ENABLE,
            shipment_fee_supplement: GLBConfig.DISABLE,
            shipment_fee_type: 'R',
            shipment_fee_fixed_amount: GLBConfig.ENABLE,
            shipment_fee_amount: sumRet[0].bill_demurrage,
            shipment_fee_currency: 'USD',
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user.user_id,
            shipment_fee_save_at: new Date()
          })
        }
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
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
