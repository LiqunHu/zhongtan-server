const moment = require('moment')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const opSrv = require('../../common/system/OperationPasswordServer')
const freightSrv = require('../logistics/TBLFreightConfigServer')

const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_verification = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_extra = model.zhongtan_logistics_payment_extra
const tb_user = model.common_user

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
  returnData.RECEIVABLE_STATUS = GLBConfig.FREIGHT_RECEIVABLE_STATUS
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData['COMMON_CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
  let result = await model.queryWithCount(doc, queryStr, queryWhere.replacements)
  returnData.total = result.count
  let rows = []
  if(result.data && result.data.length > 0) {
    // 应收状态 0：未添加，1：已添加，2：申请发票，3已开发票，4已开收据，5申请额外发票，6已开额外发票，7已开额外收据
    for(let d of result.data) {
      if(d.shipment_list_receivable_status === '2' || d.shipment_list_receivable_status === '3' || d.shipment_list_receivable_status === '5' || d.shipment_list_receivable_status === '6') {
        d._disabled = true
      } else {
        d._disabled = false
      }
      d._checked = false
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.uploadfil_release_user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
                  SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND shipment_list_id = ? AND logistics_freight_state = 'AP') 
                  AND api_name IN ('FREIGHT INVOICE', 'FREIGHT RECEIPT') ORDER BY uploadfile_id DESC`
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
            relation_id: pf.uploadfile_index1,
            receipt_no: pf.uploadfile_receipt_no,
            customer_id: pf.uploadfile_customer_id
          })
        }
      }
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
        SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND logistics_freight_state = 'AP' 
        AND shipment_list_id IN (SELECT payment_extra_id FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' AND payment_extra_shipment_id = ?)) 
        AND api_name IN ('EXTRA INVOICE', 'EXTRA RECEIPT') ORDER BY uploadfile_id DESC`
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
            relation_id: ex.uploadfile_index1,
            receipt_no: ex.uploadfile_receipt_no,
            customer_id: ex.uploadfile_customer_id
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
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name, u.user_name as shipment_list_invoice_customer from tbl_zhongtan_logistics_shipment_list s 
                  left join (SELECT shipment_list_bill_no, IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) AS sort_date FROM tbl_zhongtan_logistics_shipment_list GROUP BY shipment_list_bill_no) ss ON s.shipment_list_bill_no = ss.shipment_list_bill_no
                  left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id 
                  left join tbl_common_user u on s.shipment_list_customer = u.user_id 
                  where s.state = ? `
  let replacements = [GLBConfig.ENABLE]
  let searchPara = param.searchPara
  if(searchPara) {
    if(searchPara.shipment_list_bill_no) {
      queryStr = queryStr + ' and s.shipment_list_bill_no like ? '
      replacements.push('%' + searchPara.shipment_list_bill_no + '%')
    }
    if(searchPara.shipment_list_container_no) {
      queryStr = queryStr + ' and s.shipment_list_container_no like ? '
      replacements.push('%' + searchPara.shipment_list_container_no + '%')
    }
    if(searchPara.shipment_list_cntr_owner) {
      queryStr = queryStr + ' and s.shipment_list_cntr_owner = ? '
      replacements.push(searchPara.shipment_list_cntr_owner)
    }
    if(searchPara.shipment_list_cargo_type) {
      queryStr = queryStr + ' and s.shipment_list_cargo_type = ? '
      replacements.push(searchPara.shipment_list_cargo_type)
    }
    if(searchPara.shipment_list_receivable_status) {
      queryStr = queryStr + ' and s.shipment_list_receivable_status = ? '
      replacements.push(searchPara.shipment_list_receivable_status)
    }
    if(searchPara.shipment_list_business_type) {
      queryStr = queryStr + ' and s.shipment_list_business_type = ? '
      replacements.push(searchPara.shipment_list_business_type)
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1 && searchPara.shipment_list_in_date[0] && searchPara.shipment_list_in_date[1]) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and s.shipment_list_discharge_date >= ? and s.shipment_list_discharge_date <= ? '
        } else {
          queryStr = queryStr + ' and s.shipment_list_depot_gate_out_date >= ? and s.shipment_list_depot_gate_out_date <= ? '
        }
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1 && searchPara.shipment_list_out_date[0] && searchPara.shipment_list_out_date[1]) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and s.shipment_list_empty_return_date >= ? and s.shipment_list_empty_return_date <= ? '
        } else {
          queryStr = queryStr + ' and s.shipment_list_loading_date >= ? and s.shipment_list_loading_date <= ? '
        }
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
      }
    } else {
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1 && searchPara.shipment_list_in_date[0] && searchPara.shipment_list_in_date[1]) {
        queryStr = queryStr + ' and ((s.shipment_list_discharge_date >= ? and s.shipment_list_discharge_date <= ?) OR (s.shipment_list_depot_gate_out_date >= ? and s.shipment_list_depot_gate_out_date <= ?)) '
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1 && searchPara.shipment_list_out_date[0] && searchPara.shipment_list_out_date[1]) {
        queryStr = queryStr + ' and ((s.shipment_list_empty_return_date >= ? and s.shipment_list_empty_return_date <= ?) or (s.shipment_list_loading_date >= ? and s.shipment_list_loading_date <= ?)) '
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
    }
    if(searchPara.shipment_list_vendor) {
      queryStr = queryStr + ' and s.shipment_list_vendor = ? '
      replacements.push(searchPara.shipment_list_vendor)
    }
    if(searchPara.shipment_list_customer) {
      queryStr = queryStr + ' and (s.shipment_list_customer = ? or s.shipment_list_extra_customer = ?) '
      replacements.push(searchPara.shipment_list_customer)
      replacements.push(searchPara.shipment_list_customer)
    }
    if(searchPara.shipment_list_invoice_date && searchPara.shipment_list_invoice_date.length > 1 && searchPara.shipment_list_invoice_date[0] && searchPara.shipment_list_invoice_date[1]) {
      queryStr = queryStr + ' and s.shipment_list_receivable_freight_invoice >= ? and s.shipment_list_receivable_freight_invoice <= ? '
      replacements.push(searchPara.shipment_list_invoice_date[0])
      replacements.push(searchPara.shipment_list_invoice_date[1])
    }
  }
  return {
    queryStr: queryStr,
    replacements: replacements
  }
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
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
  let filepath = await common.ejs2xlsx('LogisticsFreightInvoice.xlsx', jsData)
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

exports.getInvoiceDataAct = async req => {
  let doc = common.docValidate(req)
  // 应收状态 0：未添加，1：已添加，2：申请发票，3已开发票，4已开收据，5申请额外发票，6已开额外发票，7已开额外收据
  let collectionList = []
  if(doc.paymentSelectedAll) {
    let queryWhere = await queryWhereJoin(doc)
    let queryStr = queryWhere.queryStr + ` AND shipment_list_receivable_status IN ('0', '1')`
    queryStr = queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
    collectionList = await model.simpleSelect(queryStr, queryWhere.replacements)
  } else if(doc.selection && doc.selection.length > 0){
    let sels = []
    for(let s of doc.selection) {
      sels.push(s.shipment_list_id)
    }
    let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s 
                  left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ? and shipment_list_receivable_status IN ('0', '1') and shipment_list_id IN (?) 
                  ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no`
    let replacements = [GLBConfig.ENABLE, sels]
    collectionList = await model.simpleSelect(queryStr, replacements)
  }
  if(collectionList && collectionList.length > 0) {
    let bgs = await common.groupingJson(collectionList, 'shipment_list_bill_no')
    if(bgs && bgs.length > 0) {
      for(let bg of bgs) {
        let blcount = await tb_shipment_list.count({
          where: {
            shipment_list_bill_no: bg.id,
            state: GLBConfig.ENABLE
          }
        })
        if(blcount !== bg.data.length) {
          return common.error('logistics_08')
        }
      }
    }
    let ogs = await common.groupingJson(collectionList, 'shipment_list_cntr_owner')
    if(ogs && ogs.length > 1) {
      return common.error('logistics_10')
    }
    let cgs = await common.groupingJson(collectionList, 'shipment_list_customer')
    if(cgs && cgs.length > 1) {
      return common.error('logistics_15')
    }
    let invoice_customer = ''
    for(let c of collectionList) {
      if(!c.shipment_list_customer) {
        return common.error('logistics_14')
      }
      if(c.shipment_list_business_type === 'I') {
        if(!c.shipment_list_discharge_date || !c.shipment_list_empty_return_date) {
          return common.error('logistics_07')
        }
      } else if(c.shipment_list_business_type === 'E') {
        if(!c.shipment_list_depot_gate_out_date || !c.shipment_list_loading_date) {
          return common.error('logistics_07')
        }
      }
      invoice_customer = c.shipment_list_customer
    }
    
    let invoice_amount = 0
    let invoice_disabled = false
    if(!invoice_customer) {
      if(collectionList[0].shipment_list_cntr_owner.indexOf('COS') >= 0) {
        let defaultCOSCO = await tb_user.findOne({
          where: {
            user_username: 'COSCO',
            state: GLBConfig.ENABLE
          }
        })
        if(defaultCOSCO) {
          invoice_customer = defaultCOSCO.user_id
        }
      } else {
        let defaultOOCL = await tb_user.findOne({
          where: {
            user_username: 'OOCL',
            state: GLBConfig.ENABLE
          }
        })
        if(defaultOOCL) {
          invoice_customer = defaultOOCL.user_id
        }
      }
    }
    for(let c of collectionList) {
      // 根据默认客户计算费用
      let usePaymentAmount = false
      if(c.shipment_list_customer === '14e84cf0-4421-11eb-a23b-a72bc46e4173' && (c.shipment_list_total_freight || c.shipment_list_receivable_freight)) {
        if(c.shipment_list_receivable_freight) {
          invoice_amount = new Decimal(invoice_amount).plus(c.shipment_list_receivable_freight)
          usePaymentAmount = true
        } else if(c.shipment_list_total_freight) {
          c.shipment_list_receivable_freight = c.shipment_list_total_freight
          invoice_amount = new Decimal(invoice_amount).plus(c.shipment_list_total_freight)
          usePaymentAmount = true
        }
      }
      if(!usePaymentAmount) {
        let freight = await freightSrv.countShipmentFreight(invoice_customer, c.shipment_list_business_type, c.shipment_list_cargo_type, 
          c.shipment_list_business_type === 'I' ? 'TZDAR' : c.shipment_list_port_of_loading, c.shipment_list_business_type === 'I' ? c.shipment_list_port_of_destination : 'TZDAR', 
          c.shipment_list_cntr_owner, c.shipment_list_size_type, c.shipment_list_business_type === 'I' ? c.shipment_list_discharge_date : c.shipment_list_vessel_etd, 'R')
        if(freight && freight.freight_config_amount) {
          c.shipment_list_receivable_freight = freight.freight_config_amount
          invoice_amount = new Decimal(invoice_amount).plus(freight.freight_config_amount)
        } else {
          invoice_disabled = true
        }
      }
    }
    let retData = {
      invoice_list : collectionList,
      invoice_total: collectionList.length,
      invoice_customer: invoice_customer,
      invoice_amount: invoice_amount,
      invoice_disabled: invoice_disabled
    }
    return common.success(retData)
  } else {
    return common.error('logistics_06')
  }
}

exports.calculationInvoiceAct = async req => {
  let doc = common.docValidate(req)
  let invoice_customer = doc.invoiceCustomer
  let calculationData = doc.calculationData
  if(calculationData && calculationData.length > 0) {
    let retData = {
      invoice_amount: 0,
      invoice_list : [],
      invoice_total: 0
    }
    let total_invoice_amount = 0
    for(let c of calculationData) {
      let dbc = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: c.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      if(dbc) {
        let usePaymentAmount = false
        if(dbc.shipment_list_customer === '14e84cf0-4421-11eb-a23b-a72bc46e4173' && (dbc.shipment_list_total_freight || dbc.shipment_list_receivable_freight)) {
          if(dbc.shipment_list_receivable_freight) {
            total_invoice_amount = new Decimal(total_invoice_amount).plus(dbc.shipment_list_receivable_freight)
            retData.invoice_list.push(JSON.parse(JSON.stringify(dbc)))
            usePaymentAmount = true
          } else if(dbc.shipment_list_total_freight) {
            dbc.shipment_list_receivable_freight = dbc.shipment_list_total_freight
            total_invoice_amount = new Decimal(total_invoice_amount).plus(dbc.shipment_list_total_freight)
            retData.invoice_list.push(JSON.parse(JSON.stringify(dbc)))
            usePaymentAmount = true
          }
        }
        if(!usePaymentAmount) {
          let freight = await freightSrv.countShipmentFreight(invoice_customer, dbc.shipment_list_business_type, dbc.shipment_list_cargo_type, 
            dbc.shipment_list_business_type === 'I' ? 'TZDAR' : dbc.shipment_list_port_of_loading, dbc.shipment_list_business_type === 'I' ? dbc.shipment_list_port_of_destination : 'TZDAR', 
            dbc.shipment_list_cntr_owner, dbc.shipment_list_size_type, dbc.shipment_list_business_type === 'I' ? dbc.shipment_list_discharge_date : dbc.shipment_list_loading_date, 'R')
          if(freight && freight.freight_config_amount) {
            dbc.shipment_list_receivable_freight = freight.freight_config_amount
            total_invoice_amount = new Decimal(total_invoice_amount).plus(freight.freight_config_amount)
            retData.invoice_list.push(JSON.parse(JSON.stringify(dbc)))
          } else {
            return common.error('logistics_09')
          }
        }
      } else {
        return common.error('logistics_09')
      }
    }
    retData.invoice_amount = total_invoice_amount.toNumber()
    retData.invoice_total = retData.invoice_list.length
    return common.success(retData)
  } else {
    return common.error('logistics_06')
  }
}

exports.freightInvoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let invoice_customer = doc.invoiceCustomer
  let invoice_data = doc.invoiceData
  for(let i of invoice_data) {
    i.grouping_type = i.shipment_list_business_type + '_' + i.shipment_list_cntr_owner + '_' + i.shipment_list_cargo_type
  }
  // 应收状态 0：未添加，1：已添加，2：申请发票，3已开发票，4已开收据，5申请额外发票，6已开额外发票，7已开额外收据
  let gts = await common.groupingJson(invoice_data, 'grouping_type')
  let api_name = 'FREIGHT INVOICE'
  let invoice_status = '2'
  for(let g of gts) {
    let ids = g.id.split('_')
    let data = g.data
    let invoiceAmount = 0
    for(let d of data) {
      invoiceAmount = new Decimal(invoiceAmount).plus(d.shipment_list_receivable_freight)
    }
    let ver = await tb_verification.create({
      logistics_verification_vendor: invoice_customer,
      logistics_verification_business_type: ids[0],
      logistics_verification_cntr_owner: ids[1],
      logistics_verification_cargo_type: ids[2],
      logistics_verification_api_name: api_name,
      logistics_verification_state: 'PM',
      logistics_verification_amount: invoiceAmount.toNumber(),
      logistics_verification_create_user: user.user_id,
    })
    for(let d of data) {
      await tb_verification_freight.create({
        logistics_verification_id: ver.logistics_verification_id,
        shipment_list_id: d.shipment_list_id,
        logistics_freight_api_name: api_name,
        logistics_freight_state: 'PM',
        logistics_freight_amount: d.shipment_list_receivable_freight
      })
      let sl = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: d.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      sl.shipment_list_receivable_status = invoice_status
      sl.shipment_list_customer = invoice_customer
      sl.shipment_list_receivable_freight = d.shipment_list_receivable_freight
      await sl.save()
    }
  }
  return common.success()
}

exports.undoFreightAct = async req => {
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
        if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
          let sp = await tb_shipment_list.findOne({
            where: {
              shipment_list_id: v.shipment_list_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sp) {
            // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
            sp.shipment_list_receivable_status = '0'
            sp.shipment_list_receivable_freight = null
            sp.shipment_list_receivable_freight_invoice = null
            // sp.shipment_list_customer = null
            await sp.save()
          }
        } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
          let extra = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'R',
              state: GLBConfig.ENABLE
            }
          })
          if(extra) {
            extra.state = GLBConfig.DISABLE
            await extra.save()
            let sp = await tb_shipment_list.findOne({
              where: {
                shipment_list_id: extra.payment_extra_shipment_id,
                state: GLBConfig.ENABLE
              }
            })
            if(sp) {
              if(extra.payment_extra_amount_usd) {
                if(extra.payment_extra_amount_usd === sp.shipment_list_receivable_extra_usd) {
                  sp.shipment_list_receivable_extra_usd = null
                  sp.shipment_list_receivable_extra_usd_invoice = null
                } else {
                  sp.shipment_list_receivable_extra_usd = new Decimal(sp.shipment_list_receivable_extra_usd).sub(extra.payment_extra_amount_usd).toNumber()
                  let queryStr = `SELECT DATE_FORMAT(logistics_verification_manager_time, '%Y-%m-%d') AS payment_date 
                                  FROM tbl_zhongtan_logistics_verification WHERE state = 1 AND logistics_verification_api_name = 'PAYMENT EXTRA' AND logistics_verification_state = 'AP' 
                                  AND logistics_verification_id IN (SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = 1 AND logistics_freight_api_name = 'EXTRA INVOICE' 
                                  AND shipment_list_id IN (SELECT MAX(payment_extra_id) FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' 
                                  AND payment_extra_bl_no = ? AND payment_extra_amount_usd IS NOT NULL))`
                  let replacements = [sp.shipment_list_bill_no]
                  let apextras = await model.simpleSelect(queryStr, replacements)
                  if(apextras && apextras.length > 0) {
                    sp.shipment_list_receivable_extra_usd_invoice = apextras[0].payment_date
                  }
                }
              } else if(extra.payment_extra_amount_tzs){
                if(extra.payment_extra_amount_tzs === sp.shipment_list_receivable_extra_tzs) {
                  sp.shipment_list_receivable_extra_tzs = null
                  sp.shipment_list_receivable_extra_tzs_invoice = null
                } else {
                  sp.shipment_list_receivable_extra_tzs = new Decimal(sp.shipment_list_receivable_extra_tzs).sub(extra.payment_extra_amount_tzs).toNumber()
                  let queryStr = `SELECT DATE_FORMAT(logistics_verification_manager_time, '%Y-%m-%d') AS payment_date 
                                  FROM tbl_zhongtan_logistics_verification WHERE state = 1 AND logistics_verification_api_name = 'PAYMENT EXTRA' AND logistics_verification_state = 'AP' 
                                  AND logistics_verification_id IN (SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = 1 AND logistics_freight_api_name = 'EXTRA EXTRA' 
                                  AND shipment_list_id IN (SELECT MAX(payment_extra_id) FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' 
                                  AND payment_extra_bl_no = ? AND payment_extra_amount_tzs IS NOT NULL))`
                  let replacements = [sp.shipment_list_bill_no]
                  let apextras = await model.simpleSelect(queryStr, replacements)
                  if(apextras && apextras.length > 0) {
                    sp.shipment_list_receivable_extra_tzs_invoice = apextras[0].payment_date
                  }
                }
              }
              await sp.save()
            }
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'EXTRA EXTRA ATTACHMENT',
                uploadfile_index1: extra.payment_extra_id,
                state: GLBConfig.ENABLE
              }
            })
            if(extra_file) {
              extra_file.state = GLBConfig.DISABLE
              await extra_file.save()
            }
          }
          let exist_extras = await tb_payment_extra.findAll({
            where: {
              payment_extra_bl_no: extra.payment_extra_bl_no,
              payment_extra_type: 'R',
              state: GLBConfig.ENABLE
            }
          })
          let shipment_list = await tb_shipment_list.findAll({
            where: {
              shipment_list_bill_no: extra.payment_extra_bl_no,
              state: GLBConfig.ENABLE
            }
          })
          if(shipment_list && shipment_list.length > 0) {
            for (let sl of shipment_list) {
              if(!exist_extras || exist_extras.length <= 0) {
                sl.shipment_list_receivable_status = '4'
              } else {
                sl.shipment_list_receivable_status = '7'
              }
              await sl.save()
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.getExtraDataAct = async req => {
  let doc = common.docValidate(req)
  // 应收状态 0：未添加，1：已添加，2：申请发票，3已开发票，4已开收据，5申请额外发票，6已开额外发票，7已开额外收据
  let collectionList = []
  if(doc.paymentSelectedAll) {
    let queryWhere = await queryWhereJoin(doc)
    let queryStr = queryWhere.queryStr + ` AND shipment_list_receivable_status IN ('4', '7')`
    queryStr = queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
    collectionList = await model.simpleSelect(queryStr, queryWhere.replacements)
  } else if(doc.selection && doc.selection.length > 0){
    let sels = []
    for(let s of doc.selection) {
      sels.push(s.shipment_list_id)
    }
    let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name from tbl_zhongtan_logistics_shipment_list s 
                  left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id where s.state = ? and shipment_list_receivable_status IN ('4', '7') and shipment_list_id IN (?) 
                  ORDER BY IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) DESC, shipment_list_bill_no, shipment_list_container_no`
    let replacements = [GLBConfig.ENABLE, sels]
    collectionList = await model.simpleSelect(queryStr, replacements)
  }
  if(collectionList && collectionList.length > 0) {
    let bgs = await common.groupingJson(collectionList, 'shipment_list_bill_no')
    if(bgs && bgs.length > 0) {
      for(let bg of bgs) {
        let blcount = await tb_shipment_list.count({
          where: {
            shipment_list_bill_no: bg.id,
            state: GLBConfig.ENABLE
          }
        })
        if(blcount !== bg.data.length) {
          return common.error('logistics_08')
        }
      }
    }
    if(bgs && bgs.length > 1) {
      return common.error('logistics_11')
    }
    let retData = {
      extra_shipment_id: collectionList[0].shipment_list_id,
      extra_bl : collectionList[0].shipment_list_bill_no,
      extra_customer: collectionList[0].shipment_list_extra_customer ? collectionList[0].shipment_list_extra_customer : collectionList[0].shipment_list_customer,
      extra_cntr_owner: collectionList[0].shipment_list_cntr_owner,
      extra_business_type: collectionList[0].shipment_list_business_type,
      extra_cargo_type: collectionList[0].shipment_list_cargo_type
    }
    return common.success(retData)
  } else {
    return common.error('logistics_12')
  }
}

exports.freightExtraAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let queryStr = `SELECT * FROM tbl_zhongtan_logistics_payment_extra WHERE state = ? AND payment_extra_type = 'R' AND payment_extra_bl_no = ? `
  let replacements = [GLBConfig.ENABLE, doc.freight_extra_bl_no]
  let exist_extras = await model.simpleSelect(queryStr, replacements)
  let exist_shipment_id = doc.freight_extra_shipment_id
  if(exist_extras) {
    for(let e of exist_extras) {
      if(e.shipment_list_receivable_status === '5') {
        return common.error('logistics_05')
      }
      exist_shipment_id = e.payment_extra_shipment_id
    }
  }
  let extra = await tb_payment_extra.create({
    payment_extra_bl_no: doc.freight_extra_bl_no,
    payment_extra_shipment_id: exist_shipment_id,
    payment_extra_vendor: doc.freight_extra_customer,
    payment_extra_cntr_owner: doc.freight_extra_cntr_owner,
    payment_extra_business_type: doc.freight_extra_business_type,
    payment_extra_cargo_type: doc.freight_extra_cargo_type,
    payment_extra_amount_usd: doc.freight_extra_currency === 'USD' ? doc.freight_extra_amount : null,
    payment_extra_amount_tzs: doc.freight_extra_currency === 'TZS' ? doc.freight_extra_amount : null,
    payment_extra_status: '5',
    payment_extra_type: 'R',
    payment_extra_created_by: user.user_id
  })
  if(doc.freight_extra_files && doc.freight_extra_files.length > 0) {
    for(let f of doc.freight_extra_files) {
      let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
      await tb_uploadfile.create({
        api_name: 'EXTRA INVOICE ATTACHMENT',
        user_id: user.user_id,
        uploadfile_index1: extra.payment_extra_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_state: 'AP',
        uploadfile_amount: doc.freight_extra_amount,
        uploadfile_currency: doc.freight_extra_currency
      })
    }
  }
  let ver = await tb_verification.create({
    logistics_verification_vendor: extra.payment_extra_vendor,
    logistics_verification_business_type: extra.payment_extra_business_type,
    logistics_verification_cntr_owner: extra.payment_extra_cntr_owner,
    logistics_verification_cargo_type: extra.payment_extra_cargo_type,
    logistics_verification_api_name: 'EXTRA INVOICE',
    logistics_verification_state: 'PM',
    logistics_verification_amount: doc.freight_extra_amount,
    logistics_verification_create_user: user.user_id,
  })
  await tb_verification_freight.create({
    logistics_verification_id: ver.logistics_verification_id,
    shipment_list_id: extra.payment_extra_id,
    logistics_freight_api_name: 'EXTRA INVOICE',
    logistics_freight_state: 'PM',
    logistics_freight_amount: doc.freight_extra_amount
  })

  queryStr = `SELECT * FROM tbl_zhongtan_logistics_shipment_list WHERE state = ? AND shipment_list_bill_no = ? `
  replacements = [GLBConfig.ENABLE, doc.freight_extra_bl_no]
  let shipment_list = await model.simpleSelect(queryStr, replacements)
  if(shipment_list) {
    for(let sl of shipment_list) {
      let s = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: sl.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      s.shipment_list_receivable_status = '5'
      await s.save()
    }
  }
  return common.success()
}

exports.editFreightAct = async req => {
  let doc = common.docValidate(req)
  let shipment_list_customer = doc.shipment_list_customer
  let queryStr = `SELECT * FROM tbl_zhongtan_logistics_shipment_list WHERE state = ? AND shipment_list_bill_no = ? `
  let replacements = [GLBConfig.ENABLE, doc.shipment_list_bill_no]
  let shipment_list = await model.simpleSelect(queryStr, replacements)
  if(shipment_list) {
    for(let sl of shipment_list) {
      let s = await tb_shipment_list.findOne({
        where: {
          shipment_list_id: sl.shipment_list_id,
          state: GLBConfig.ENABLE
        }
      })
      s.shipment_list_customer = shipment_list_customer
      if(shipment_list_customer === '14e84cf0-4421-11eb-a23b-a72bc46e4173' && s.shipment_list_total_freight) {
        // 客户为COSCO SHIPPING LINES时,COSCO的应收金额等于应付金额
        s.shipment_list_receivable_freight = s.shipment_list_total_freight
      }
      await s.save()
    }
  }
}
