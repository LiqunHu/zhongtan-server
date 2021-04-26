const moment = require('moment')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_verification = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_extra = model.zhongtan_logistics_payment_extra

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
  returnData.RECEIPT_CURRENCY = GLBConfig.RECEIPT_CURRENCY
  returnData.PAYMENT_STATUS = GLBConfig.FREIGHT_PAYMENT_STATUS
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no'
  let result = await model.queryWithCount(doc, queryStr, queryWhere.replacements)
  returnData.total = result.count
  let rows = []
  if(result.data && result.data.length > 0) {
    // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
    for(let d of result.data) {
      if(d.shipment_list_payment_status === '2' || d.shipment_list_payment_status === '4' || d.shipment_list_payment_status === '6') {
        d._disabled = true
      } else {
        d._disabled = false
      }
      d._checked = false
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.uploadfil_release_user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
                  SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND shipment_list_id = ? AND logistics_freight_state = 'AP') 
                  AND api_name IN ('PAYMENT ADVANCE', 'PAYMENT BALANCE') ORDER BY api_name`
      let replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, d.shipment_list_id]
      let paymentFiles = await model.simpleSelect(queryStr, replacements)
      let files = []
      if(paymentFiles) {
        for(let pf of paymentFiles) {
          files.push({
            filetype: pf.api_name,
            creater: pf.user_name,
            amount: pf.uploadfile_amount,
            currency: pf.uploadfile_currency,
            date: moment(pf.created_at).format('YYYY-MM-DD HH:mm:ss'),
            url: pf.uploadfile_url,
            file_id : pf.uploadfile_id,
            relation_id: pf.uploadfile_index1
          })
        }
      }
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
        SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND logistics_freight_state = 'AP' 
        AND shipment_list_id IN (SELECT payment_extra_id FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_status = '7' AND payment_extra_shipment_id = ?)) 
        AND api_name IN ('PAYMENT EXTRA') ORDER BY api_name`
      replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, d.shipment_list_id]
      let extraFiles = await model.simpleSelect(queryStr, replacements)
      if(extraFiles) {
        for(let ex of extraFiles) {
          files.push({
            filetype: ex.api_name,
            creater: ex.user_name,
            amount: ex.uploadfile_amount,
            currency: ex.uploadfile_currency,
            date: moment(ex.created_at).format('YYYY-MM-DD HH:mm:ss'),
            url: ex.uploadfile_url,
            file_id : ex.uploadfile_id,
            relation_id: ex.uploadfile_index1
          })
        }
      }
      d.files = files
      rows.push(d)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

const queryWhereJoin = async (param) => {
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ? and shipment_list_payment_status <> '0' `
  let replacements = [GLBConfig.ENABLE]
  let searchPara = param.searchPara
  if(searchPara) {
    if(searchPara.shipment_list_bill_no) {
      queryStr = queryStr + ' and shipment_list_bill_no like ? '
      replacements.push('%' + searchPara.shipment_list_bill_no + '%')
    }
    if(searchPara.shipment_list_container_no) {
      queryStr = queryStr + ' and shipment_list_container_no like ? '
      replacements.push('%' + searchPara.shipment_list_container_no + '%')
    }
    if(searchPara.shipment_list_cntr_owner) {
      queryStr = queryStr + ' and shipment_list_cntr_owner = ? '
      replacements.push(searchPara.shipment_list_cntr_owner)
    }
    if(searchPara.shipment_list_cargo_type) {
      queryStr = queryStr + ' and shipment_list_cargo_type = ? '
      replacements.push(searchPara.shipment_list_cargo_type)
    }
    if(searchPara.shipment_list_payment_status) {
      queryStr = queryStr + ' and shipment_list_payment_status = ? '
      replacements.push(searchPara.shipment_list_payment_status)
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
  return {
    queryStr: queryStr,
    replacements: replacements
  }
}

exports.searchShipmentListAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let search_bl = '%' + doc.search_data.bill_no + '%'
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name 
                  from tbl_zhongtan_logistics_shipment_list s left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ? and shipment_list_payment_status = '0' and shipment_list_bill_no like ?`
  let replacements = [GLBConfig.ENABLE, search_bl]
  let result = await model.simpleSelect(queryStr, replacements)
  let total = 0
  let rows = []
  if(result && result.length > 0) {
    total = result.length
    for(let r of result) {
      r._checked = false
      let freight = await countShipmentPayment(r.shipment_list_vendor, r.shipment_list_business_type, r.shipment_list_cargo_type, 
        r.shipment_list_business_type === 'I' ? 'TZDAR' : r.shipment_list_port_of_loading, r.shipment_list_business_type === 'I' ? r.shipment_list_port_of_destination : 'TZDAR', r.shipment_list_cntr_owner, r.shipment_list_size_type, r.shipment_list_business_type === 'I' ? r.shipment_list_discharge_date : r.shipment_list_loading_date)
      if(freight) {
        r._disabled = false
        r.shipment_list_total_freight = freight.freight_config_amount
        r.shipment_list_advance_payment = freight.freight_config_advance_amount
        r.shipment_list_advance_percent = freight.freight_config_advance
        r.shipment_list_balance_payment = new Decimal(freight.freight_config_amount).sub(freight.freight_config_advance_amount)
      } else {
        r._disabled = true
      }
      rows.push(r)
    }
    for(let r1 of rows) {
      for(let r2 of rows) {
        if(r1.shipment_list_bill_no === r2.shipment_list_bill_no && r1._disabled) {
          r2._disabled = true
        }
      }
    }
  }
  returnData.total = total
  returnData.rows = rows
  return common.success(returnData)
}

/**
 * 
 * @param {*} vendor 供应商
 * @param {*} business_type 进出口
 * @param {*} cargo_type 货物类型
 * @param {*} freight_pol 起运点
 * @param {*} feight_pod 目的地
 * @param {*} carrier 代理
 * @param {*} container 箱型尺寸
 * @param {*} transport_date 运输日期
 */
const countShipmentPayment = async (vendor, business_type, cargo_type, freight_pol, feight_pod, carrier, container, transport_date) => {
  let queryStr = `select freight_config_amount, freight_config_advance, freight_config_advance_amount from tbl_zhongtan_freight_config where state = ? AND freight_config_vendor = ? AND freight_config_business_type = ? 
      AND freight_config_cargo_type = ? AND freight_config_pol = ? AND freight_config_pod = ? AND freight_config_carrier = ? 
      AND freight_config_size_type = ? AND freight_config_enabled_date <= ? order by freight_config_enabled_date desc limit 1`
  let replacements = [GLBConfig.ENABLE, vendor, business_type, cargo_type, freight_pol, feight_pod, carrier, container, transport_date]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length === 1) {
    return result[0]
  } 
  return null
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let addData = doc.add_shipment_list
  if(addData) {
    for(let d of addData) {
      let sm = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: d.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      if(sm) {
        sm.shipment_list_payment_status = '1'
        sm.shipment_list_total_freight = d.shipment_list_total_freight
        sm.shipment_list_advance_payment = d.shipment_list_advance_payment
        sm.shipment_list_advance_percent = d.shipment_list_advance_percent
        sm.shipment_list_balance_payment = d.shipment_list_balance_payment
        await sm.save()
      }
    }
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
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
      modifyRow.shipment_list_dar_customs_release_date = modifyData.shipment_list_dar_customs_release_date
      modifyRow.shipment_list_truck_departure_date = modifyData.shipment_list_truck_departure_date
      modifyRow.shipment_list_truck_plate = modifyData.shipment_list_truck_plate
      modifyRow.shipment_list_ata_destination = modifyData.shipment_list_ata_destination
      modifyRow.shipment_list_delivery_date = modifyData.shipment_list_delivery_date
      modifyRow.shipment_list_vendor = modifyData.shipment_list_vendor
      modifyRow.shipment_list_remark = modifyData.shipment_list_remark
      modifyRow.shipment_list_ata_tz_border = modifyData.shipment_list_ata_tz_border
      modifyRow.shipment_list_ata_foreing_border = modifyData.shipment_list_ata_foreing_border
      modifyRow.shipment_list_border_release_date = modifyData.shipment_list_border_release_date
      await modifyRow.save()
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
    sl.shipment_list_payment_status = '0'
    await sl.save()
  }
  return common.success()
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no'
  let result = await model.simpleSelect(queryStr, queryWhere.replacements)
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
    if(r.shipment_list_in_date && r.shipment_list_out_date) {
      r.empty_returned_or_not = 'YES'
    } else {
      r.empty_returned_or_not = 'NO'
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
  let filepath = await common.ejs2xlsx('LogisticsPaymentNoteTemplate.xlsx', jsData)
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

exports.applyPaymentSearchAct = async req => {
  let doc = common.docValidate(req)
  let paymentList = []
  if(doc.paymentSelectedAll) {
    let queryWhere = await queryWhereJoin(doc)
    let queryStr = queryWhere.queryStr + ` AND shipment_list_payment_status IN ('1', '3', '5', '7')`
    queryStr = queryStr + ' ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no'
    paymentList = await model.simpleSelect(queryStr, queryWhere.replacements)
  } else if(doc.selection && doc.selection.length > 0){
    let sels = []
    for(let s of doc.selection) {
      sels.push(s.shipment_list_id)
    }
    let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s 
                  left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ? and shipment_list_payment_status IN ('1', '3', '5', '7') and shipment_list_id IN (?) 
                  ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no`
    let replacements = [GLBConfig.ENABLE, sels]
    paymentList = await model.simpleSelect(queryStr, replacements)
  }
  let retData = {
    advance_list : [], // status: 1
    advance_total: 0,
    balance_list : [], // status: 3
    balance_total: 0,
    extra_list : [], // status: 5, 7
    extra_total: 0
  }
  if(paymentList && paymentList.length > 0) {
    for(let p of paymentList) {
      p._checked = false
      p._disabled = false
      if(p.shipment_list_payment_status === '1') {
        for(let al of retData.advance_list) {
          if(al.shipment_list_vendor !== p.shipment_list_vendor) {
            return common.error('logistics_01')
          }
        }
        retData.advance_list.push(p)
      } else if(p.shipment_list_payment_status === '3') {
        for(let al of retData.balance_list) {
          if(al.shipment_list_vendor !== p.shipment_list_vendor) {
            return common.error('logistics_02')
          }
        }
        p.shipment_list_balance_payment_edit = false
        if(p.shipment_list_business_type === 'I') {
          if(!p.shipment_list_discharge_date || !p.shipment_list_empty_return_date) {
            p._disabled = true
          }
        } else if(p.shipment_list_business_type === 'E') {
          if(!p.shipment_list_depot_gate_out_date || !p.shipment_list_loading_date) {
            p._disabled = true
          }
        }
        retData.balance_list.push(p)
      } else if(p.shipment_list_payment_status === '5' || p.shipment_list_payment_status === '7') {
        for(let al of retData.extra_list) {
          if(al.shipment_list_vendor !== p.shipment_list_vendor) {
            return common.error('logistics_03')
          }
        }
        p.extra_files = []
        let queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.user_id = cu.user_id WHERE u.state = '1' AND api_name = 'PAYMENT EXTRA ATTACHMENT' AND uploadfile_index1 IN (
          SELECT payment_extra_id FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_bl_no = ? AND payment_extra_status = '7')`
        let replacements = [p.shipment_list_bill_no]
        let extraFiles = await model.simpleSelect(queryStr, replacements)
        if(extraFiles && extraFiles.length > 0) {
          for(let f of extraFiles) {
            p.extra_files.push({
              amount: f.uploadfile_amount,
              url: f.uploadfile_url,
              created_by: f.user_name,
              created_at: moment(f.created_at).format('YYYY-MM-DD HH:mm:ss')
            })
          }
        }
        retData.extra_list.push(p)
      }
    }
    retData.advance_total = retData.advance_list.length
    retData.balance_total = retData.balance_list.length
    retData.extra_total = retData.extra_list.length
  }
  return retData
}

exports.applyPaymentAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let applyData = doc.applyData
  let vgs = await common.groupingJson(applyData, 'shipment_list_vendor')
  if(vgs.length > 1) {
    return common.error('logistics_04')
  }
  for(let a of applyData) {
    a.grouping_type = a.shipment_list_business_type + '_' + a.shipment_list_cntr_owner + '_' + a.shipment_list_cargo_type
  }
  let gts = await common.groupingJson(doc.applyData, 'grouping_type')
  let api_name = 'PAYMENT ADVANCE'
  // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
  let payment_status = '2'
  if(doc.applyAction === 'BALANCE') {
    api_name = 'PAYMENT BALANCE'
    payment_status = '4'
  }
  for(let g of gts) {
    let ids = g.id.split('_')
    let data = g.data
    let applyAmount = 0
    for(let d of data) {
      if(doc.applyAction === 'ADVANCE') {
        applyAmount = new Decimal(applyAmount).plus(d.shipment_list_advance_payment)
      } else if(doc.applyAction === 'BALANCE') {
        applyAmount = new Decimal(applyAmount).plus(d.shipment_list_balance_payment)
      }
    }
    let ver = await tb_verification.create({
      logistics_verification_vendor: vgs[0].id,
      logistics_verification_business_type: ids[0],
      logistics_verification_cntr_owner: ids[1],
      logistics_verification_cargo_type: ids[2],
      logistics_verification_api_name: api_name,
      logistics_verification_state: 'PB',
      logistics_verification_amount: applyAmount.toNumber(),
      logistics_verification_create_user: user.user_id,
    })
    for(let d of data) {
      await tb_verification_freight.create({
        logistics_verification_id: ver.logistics_verification_id,
        shipment_list_id: d.shipment_list_id,
        logistics_freight_api_name: api_name,
        logistics_freight_state: 'PB',
        logistics_freight_amount: d.shipment_list_advance_payment
      })
      let sl = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: d.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      sl.shipment_list_payment_status = payment_status
      await sl.save()
    }
  }
  return common.success()
}

exports.undoPaymentAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id,
      state: GLBConfig.ENABLE
    }
  })
  if(file) {
    file.state = GLBConfig.DISABLE
    await file.save()
  }
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.relation_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'UN'
    ver.logistics_verification_undo_user = user.user_id
    ver.logistics_verification_undo_time = curDate
    await ver.save()

    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })

    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'UN'
        await v.save()
        let sp = await tb_shipment_list.findOne({
          where: {
            shipment_list_id: v.shipment_list_id,
            state: GLBConfig.ENABLE
          }
        })
        if(sp) {
          // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
          if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE') {
            sp.shipment_list_payment_status = '1'
          } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
            sp.shipment_list_payment_status = '3'
          } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
            sp.shipment_list_payment_status = '5'
            // TODO 如果有其他额外费用，则不会退状态
          }
          await sp.save()
        }
      }
    }
  }
  return common.success()
}

exports.paymentBalanceEditAct = async req => {
  let doc = common.docValidate(req)
  let sp = await tb_shipment_list.findOne({
    where: {
      shipment_list_id: doc.new.shipment_list_id,
      state: GLBConfig.ENABLE
    }
  })
  if(sp) {
    sp.shipment_list_balance_payment = doc.new.shipment_list_balance_payment
    sp.shipment_list_total_freight = new Decimal(sp.shipment_list_advance_payment).plus(sp.shipment_list_balance_payment).toNumber()
    await sp.save()
  }
  return common.success()
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.applyPaymentExtraAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let queryStr = `SELECT * FROM tbl_zhongtan_logistics_payment_extra WHERE state = ? AND payment_extra_bl_no = ? `
  let replacements = [GLBConfig.ENABLE, doc.payment_extra_bl_no]
  let exist_extras = await model.simpleSelect(queryStr, replacements)
  let exist_shipment_id = doc.payment_extra_shipment_id
  if(exist_extras) {
    for(let e of exist_extras) {
      if(e.payment_extra_status === '6') {
        return common.error('logistics_05')
      }
      exist_shipment_id = e.payment_extra_shipment_id
    }
  }
  let extra = await tb_payment_extra.create({
    payment_extra_bl_no: doc.payment_extra_bl_no,
    payment_extra_shipment_id: exist_shipment_id,
    payment_extra_vendor: doc.payment_extra_vendor,
    payment_extra_cntr_owner: doc.payment_extra_cntr_owner,
    payment_extra_business_type: doc.payment_extra_business_type,
    payment_extra_cargo_type: doc.payment_extra_cargo_type,
    payment_extra_amount_usd: doc.payment_extra_currency === 'USD' ? doc.payment_extra_amount : null,
    payment_extra_amount_tzs: doc.payment_extra_currency === 'TZS' ? doc.payment_extra_amount : null,
    payment_extra_status: '6',
    payment_extra_created_by: user.user_id
  })
  if(doc.payment_extra_files && doc.payment_extra_files.length > 0) {
    for(let f of doc.payment_extra_files) {
      let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
      await tb_uploadfile.create({
        api_name: 'PAYMENT EXTRA ATTACHMENT',
        user_id: user.user_id,
        uploadfile_index1: extra.payment_extra_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_state: 'AP',
        uploadfile_amount: doc.payment_extra_amount
      })
    }
  }
  let ver = await tb_verification.create({
    logistics_verification_vendor: extra.payment_extra_vendor,
    logistics_verification_business_type: extra.payment_extra_business_type,
    logistics_verification_cntr_owner: extra.payment_extra_cntr_owner,
    logistics_verification_cargo_type: extra.payment_extra_cargo_type,
    logistics_verification_api_name: 'PAYMENT EXTRA',
    logistics_verification_state: 'PB',
    logistics_verification_amount: doc.payment_extra_amount,
    logistics_verification_create_user: user.user_id,
  })
  await tb_verification_freight.create({
    logistics_verification_id: ver.logistics_verification_id,
    shipment_list_id: extra.payment_extra_id,
    logistics_freight_api_name: 'PAYMENT EXTRA',
    logistics_freight_state: 'PB',
    logistics_freight_amount: doc.payment_extra_amount
  })

  queryStr = `SELECT * FROM tbl_zhongtan_logistics_shipment_list WHERE state = ? AND shipment_list_bill_no = ? `
  replacements = [GLBConfig.ENABLE, doc.payment_extra_bl_no]
  let shipment_list = await model.simpleSelect(queryStr, replacements)
  if(shipment_list) {
    for(let sl of shipment_list) {
      let s = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: sl.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      s.shipment_list_payment_status = '6'
      await s.save()
    }
  }
  return common.success()
}
