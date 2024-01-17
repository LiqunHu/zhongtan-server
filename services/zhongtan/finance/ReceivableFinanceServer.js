
const common = require('../../../util/CommonUtil')
const moment = require('moment')
const Decimal = require('decimal.js')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const axios = require('axios')
const redisClient = require('server-utils').redisClient
const logger = require('../../../app/logger').createLogger(__filename)
const seq = require('../../../util/Sequence')

const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_export_bl = model.zhongtan_export_proforma_masterbl
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_mnr_ledger = model.zhongtan_container_mnr_ledger
const tb_unusual_invoice = model.zhongtan_unusual_invoice
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const tb_user = model.common_user
const tb_match_code = model.zhongtan_finance_match_code
const tb_subject_code = model.zhongtan_finance_subject_code
const tb_ought_receive = model.zhongtan_finance_ought_receive
const tb_ought_receive_detail = model.zhongtan_finance_ought_receive_detail
const tb_upload_file = model.zhongtan_uploadfile
const tb_bank_info = model.zhongtan_bank_info
const tb_receive_split = model.zhongtan_finance_receive_split
const tb_receive_split_detail = model.zhongtan_finance_receive_split_detail

exports.initAct = async req => {
    let doc = common.docValidate(req)
    let returnData = {}
    let RECEIPT_TYPES = [
       {value: 'RECEIPT-RECEIPT', name: 'Import Deposit/Fee'},
       {value: 'OVERDUE-RECEIPT', name: 'Import Demurrage'},
       {value: 'SHIPMENT-RECEIPT', name: 'Export Receivable'},
       {value: 'MNR-RECEIPT', name: 'MNR Receivable'},
       {value: 'UNUSUAL RECEIPT', name: 'UNUSUAL Receivable'},
       {value: 'FIXED-RECEIPT', name: 'Import Fixed'},
    ]
    returnData.RECEIPT_TYPES = RECEIPT_TYPES

    let BANK_INFOS = []
    let banks = await tb_bank_info.findAll({
        where: {
        state: GLBConfig.ENABLE
        }
    })
    if(banks && banks.length > 0) {
        for(let b of banks) {
        BANK_INFOS.push({
            bank_code: b.bank_code,
            bank_name: b.bank_name
        })
        }
    }
    returnData['BANK_INFOS'] = BANK_INFOS
    returnData['RECEIPT_CARRIER'] = GLBConfig.RECEIPT_TYPE_INFO
    return common.success(returnData)
}

exports.queryReceivableAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let returnData = {}
    let queryStr = `SELECT u.* from tbl_zhongtan_uploadfile u WHERE state = 1 AND api_name IN ('RECEIPT-RECEIPT', 'OVERDUE-RECEIPT', 'SHIPMENT-RECEIPT', 'MNR-RECEIPT', 'UNUSUAL RECEIPT', 'FIXED-RECEIPT') 
    AND uploadfile_amount != 0 AND u.uploadfile_id NOT IN (SELECT ought_receive_receipt_file_id FROM tbl_zhongtan_finance_ought_receive WHERE state = 1)`
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1 && doc.search_data.receipt_date[0]  && doc.search_data.receipt_date[1]) {
            let start_date = doc.search_data.receipt_date[0]
            let end_date = doc.search_data.receipt_date[1]
            queryStr += ` AND uploadfil_release_date >= ? and uploadfil_release_date < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.receipt_type) {
            queryStr += ` AND api_name = ? `
            replacements.push(doc.search_data.receipt_type)
        }
        if(doc.search_data.receipt_carrier) {
            queryStr += ` AND uploadfile_receipt_no like ? `
            replacements.push(doc.search_data.receipt_carrier + '%')
        }
    }

    queryStr += ' ORDER BY uploadfile_id DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    let receivables = []
    if(rows && rows.length > 0) {
        for(let r of rows) {
            let item = {}
            item.operator_id = user.user_id
            item.operator_name = user.user_name
            item.receipt_id = r.uploadfile_id
            item.receipt_object_id = r.uploadfile_index1
            item.receipt_url = r.uploadfile_url
            if(r.uploadfile_amount) {
                let amount = r.uploadfile_amount.replace(/,/g, '')
                item.receipt_amount = new Decimal(amount).toNumber()
            }
            item.receipt_amount_rate = r.uploadfile_amount_rate
            item.receipt_currency = r.uploadfile_currency
            item.receipt_no = r.uploadfile_receipt_no
            item.receipt_from = r.uploadfile_received_from
            item.receipt_check_cash = r.uploadfile_check_cash
            item.receipt_date = moment(r.uploadfil_release_date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            item.receipt_operator_id = r.uploadfil_release_user_id
            let ru = await tb_user.findOne({
                where: {
                    user_id: item.receipt_operator_id,
                    state: GLBConfig.ENABLE
                }
            })
            if(ru) {
                item.receipt_operator_name = ru.user_name
            }
            if(r.uploadfile_check_cash === 'TRANSFER') {
                item.receipt_reference_no = r.uploadfile_bank_reference_no
                if(r.uploadfile_bank_info) {
                    item.receipt_bank = r.uploadfile_bank_info
                }
            } else if(r.uploadfile_check_cash === 'CHEQUE') {
                item.receipt_reference_no = r.uploadfile_check_no
            }
            
            if(r.api_name === 'RECEIPT-RECEIPT') {
                item.receipt_business = 'I'
                let bl = await tb_bl.findOne({
                    where: {
                      invoice_masterbi_id: r.uploadfile_index1,
                      state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    item.receipt_object = bl.invoice_masterbi_bl
                    item.receipt_object_carrier = bl.invoice_masterbi_carrier
                }
                if(r.uploadfile_acttype === 'fee') {
                    item.receipt_type = 'Import Fee'
                    if(bl) {
                        let fees = []
                        let fee_total = 0
                        if(bl.invoice_masterbi_tasac_receipt || bl.invoice_masterbi_do_fee_receipt) {
                            let receipt_usd = item.receipt_amount
                            if(item.receipt_currency === 'TZS') {
                                receipt_usd = new Decimal(item.receipt_amount).div(new Decimal(item.receipt_amount_rate)).toNumber()
                            }
                            let tasac_usd = 0
                            if(bl.invoice_masterbi_tasac) {
                                tasac_usd = new Decimal(bl.invoice_masterbi_tasac).toNumber()
                            }
                            let do_usd = 0
                            if(bl.invoice_masterbi_do_fee) {
                                do_usd = new Decimal(bl.invoice_masterbi_do_fee).toNumber()
                            }
                            if(receipt_usd === tasac_usd) {
                                fees.push({'fee_name': 'TASAC FEE', 'fee_amount': bl.invoice_masterbi_tasac})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_tasac))
                            } else if(receipt_usd === do_usd) {
                                fees.push({'fee_name': 'DO FEE', 'fee_amount': bl.invoice_masterbi_do_fee})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_do_fee))
                            } else {
                                let tasac_do_usd = new Decimal(tasac_usd).plus(new Decimal(do_usd)).toNumber()
                                if(receipt_usd === tasac_do_usd) {
                                    fees.push({'fee_name': 'TASAC FEE', 'fee_amount': bl.invoice_masterbi_tasac})
                                    fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_tasac))

                                    fees.push({'fee_name': 'DO FEE', 'fee_amount': bl.invoice_masterbi_do_fee})
                                    fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_do_fee))
                                } else {
                                    let other_usd = 0
                                    if(bl.invoice_masterbi_of) {
                                        fees.push({'fee_name': 'OCEAN FREIGHT', 'fee_amount': bl.invoice_masterbi_of})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_of))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_of)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_bl_amendment) {
                                        fees.push({'fee_name': 'B/L AMENDMENT', 'fee_amount': bl.invoice_masterbi_bl_amendment})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_bl_amendment))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_bl_amendment)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_cod_charge) {
                                        fees.push({'fee_name': 'COD CHARGE', 'fee_amount': bl.invoice_masterbi_cod_charge})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_cod_charge))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_cod_charge)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_transfer) {
                                        fees.push({'fee_name': 'CONTAINER TRANSFER', 'fee_amount': bl.invoice_masterbi_transfer})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_transfer))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_transfer)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_lolf) {
                                        fees.push({'fee_name': 'LIFT ON LIFT OFF', 'fee_amount': bl.invoice_masterbi_lolf})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_lolf))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_lolf)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_lcl) {
                                        fees.push({'fee_name': 'LCL FEE', 'fee_amount': bl.invoice_masterbi_lcl})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_lcl))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_lcl)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_amendment) {
                                        fees.push({'fee_name': 'AMENDMENT FEE', 'fee_amount': bl.invoice_masterbi_amendment})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_amendment))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_amendment)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_printing) {
                                        fees.push({'fee_name': 'B/L PRINTING FEE', 'fee_amount': bl.invoice_masterbi_printing})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_printing))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_printing)).toNumber()
                                    }
                                    if(bl.invoice_masterbi_others) {
                                        fees.push({'fee_name': 'OTHERS', 'fee_amount': bl.invoice_masterbi_others})
                                        fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_others))
                                        other_usd = new Decimal(other_usd).plus(new Decimal(bl.invoice_masterbi_others)).toNumber()
                                    }
                                    if(receipt_usd !== other_usd) {
                                        let tasac_other_usd = new Decimal(other_usd).plus(tasac_usd).toNumber()
                                        if(receipt_usd === tasac_other_usd) {
                                            fees.push({'fee_name': 'TASAC FEE', 'fee_amount': bl.invoice_masterbi_tasac})
                                            fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_tasac))
                                        } else {
                                            let do_other_usd = new Decimal(other_usd).plus(do_usd).toNumber()
                                            if(receipt_usd === do_other_usd) {
                                                fees.push({'fee_name': 'DO FEE', 'fee_amount': bl.invoice_masterbi_do_fee})
                                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_do_fee))
                                            } else {
                                                let tasac_do_other_usd = new Decimal(other_usd).plus(tasac_do_usd).toNumber()
                                                if(receipt_usd === tasac_do_other_usd) {
                                                    fees.push({'fee_name': 'TASAC FEE', 'fee_amount': bl.invoice_masterbi_tasac})
                                                    fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_tasac))

                                                    fees.push({'fee_name': 'DO FEE', 'fee_amount': bl.invoice_masterbi_do_fee})
                                                    fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_do_fee))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            item.receipt_detail = fees
                            if(item.receipt_currency === 'TZS') {
                                let tzs_amount = new Decimal(fee_total).times(new Decimal(item.receipt_amount_rate))
                                item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                            } else {
                                item.receipt_detail_total = Decimal.isDecimal(fee_total) ? fee_total.toNumber() : fee_total
                            }
                        } else {
                            if(bl.invoice_masterbi_of) {
                                fees.push({'fee_name': 'OCEAN FREIGHT', 'fee_amount': bl.invoice_masterbi_of})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_of))
                            }
                            if(bl.invoice_masterbi_bl_amendment) {
                                fees.push({'fee_name': 'B/L AMENDMENT', 'fee_amount': bl.invoice_masterbi_bl_amendment})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_bl_amendment))
                            }
                            if(bl.invoice_masterbi_cod_charge) {
                                fees.push({'fee_name': 'COD CHARGE', 'fee_amount': bl.invoice_masterbi_cod_charge})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_cod_charge))
                            }
                            if(bl.invoice_masterbi_transfer) {
                                fees.push({'fee_name': 'CONTAINER TRANSFER', 'fee_amount': bl.invoice_masterbi_transfer})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_transfer))
                            }
                            if(bl.invoice_masterbi_lolf) {
                                fees.push({'fee_name': 'LIFT ON LIFT OFF', 'fee_amount': bl.invoice_masterbi_lolf})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_lolf))
                            }
                            if(bl.invoice_masterbi_lcl) {
                                fees.push({'fee_name': 'LCL FEE', 'fee_amount': bl.invoice_masterbi_lcl})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_lcl))
                            }
                            if(bl.invoice_masterbi_amendment) {
                                fees.push({'fee_name': 'AMENDMENT FEE', 'fee_amount': bl.invoice_masterbi_amendment})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_amendment))
                            }
                            if(bl.invoice_masterbi_printing) {
                                fees.push({'fee_name': 'B/L PRINTING FEE', 'fee_amount': bl.invoice_masterbi_printing})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_printing))
                            }
                            if(bl.invoice_masterbi_others) {
                                fees.push({'fee_name': 'OTHERS', 'fee_amount': bl.invoice_masterbi_others})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_others))
                            }
                            if(bl.invoice_masterbi_tasac) {
                                fees.push({'fee_name': 'TASAC FEE', 'fee_amount': bl.invoice_masterbi_tasac})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_tasac))
                            }
                            if(bl.invoice_masterbi_do_fee) {
                                fees.push({'fee_name': 'DO FEE', 'fee_amount': bl.invoice_masterbi_do_fee})
                                fee_total = new Decimal(fee_total).plus(new Decimal(bl.invoice_masterbi_do_fee))
                            }
                            item.receipt_detail = fees
                            if(item.receipt_currency === 'TZS') {
                                let tzs_amount = new Decimal(fee_total).times(new Decimal(item.receipt_amount_rate))
                                item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                            } else {
                                item.receipt_detail_total = Decimal.isDecimal(fee_total) ? fee_total.toNumber() : fee_total
                            }
                        }
                    }
                } else if(r.uploadfile_acttype === 'deposit') {
                    item.receipt_type = 'Import Deposit'
                    if(bl) {
                        let fees = []
                        if(bl.invoice_masterbi_deposit) {
                            fees.push({'fee_name': 'CONTAINER DEPOSIT', 'fee_amount': bl.invoice_masterbi_deposit})
                            item.receipt_detail_total = new Decimal(bl.invoice_masterbi_deposit).toNumber()
                        }
                        item.receipt_detail = fees
                        if(item.receipt_currency === 'TZS') {
                            let tzs_amount = new Decimal(item.receipt_detail_total).times(new Decimal(item.receipt_amount_rate))
                            item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                        } else {
                            item.receipt_detail_total = Decimal.isDecimal(item.receipt_detail_total) ? item.receipt_detail_total.toNumber() : item.receipt_detail_total
                        }
                    }
                }
            } else if(r.api_name === 'OVERDUE-RECEIPT') {
                item.receipt_type = 'Import Demurrage'
                item.receipt_business = 'I'
                let bl = await tb_bl.findOne({
                    where: {
                      invoice_masterbi_id: r.uploadfile_index1,
                      state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    item.receipt_object = bl.invoice_masterbi_bl
                    item.receipt_object_carrier = bl.invoice_masterbi_carrier

                    let container_invoices = await tb_invoice_container.findAll({
                        where: {
                            overdue_invoice_containers_invoice_uploadfile_id: r.uploadfile_index3,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(container_invoices && container_invoices.length > 0) {
                        let fees = []
                        let fee_total = 0
                        for(let ci of container_invoices) {
                            let continer = await tb_container.findOne({
                                where: {
                                    invoice_containers_id: ci.overdue_invoice_containers_invoice_containers_id,
                                    state: GLBConfig.ENABLE
                                }
                            })
                            if(continer) {
                                fees.push({'fee_name': 'DEMURRAGE', 'fee_amount': ci.overdue_invoice_containers_overdue_invoice_amount})
                                fee_total = new Decimal(fee_total).plus(new Decimal(ci.overdue_invoice_containers_overdue_invoice_amount))
                            }
                        }
                        item.receipt_detail = fees
                        if(item.receipt_currency === 'TZS') {
                            let tzs_amount = new Decimal(fee_total).times(new Decimal(item.receipt_amount_rate))
                            item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                        } else {
                            item.receipt_detail_total = Decimal.isDecimal(fee_total) ? fee_total.toNumber() : fee_total
                        }
                    }
                }
            } else if(r.api_name === 'SHIPMENT-RECEIPT') {
                item.receipt_type = 'Export Receivable'
                item.receipt_business = 'E'
                let bl = await tb_export_bl.findOne({
                    where: {
                        export_masterbl_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    item.receipt_object = bl.export_masterbl_bl
                    item.receipt_object_carrier = bl.export_masterbl_bl_carrier
                    let shipment_fees = await tb_shipment_fee.findAll({
                        where: {
                            shipment_fee_invoice_id: r.uploadfile_index3,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(shipment_fees && shipment_fees.length > 0) {
                        let fees = []
                        let fee_total = 0
                        for(let sf of shipment_fees) {
                            fees.push({'fee_type': sf.fee_data_code, 'fee_amount': sf.shipment_fee_amount})
                            fee_total = new Decimal(fee_total).plus(new Decimal(sf.shipment_fee_amount))
                        }
                        item.receipt_detail = fees
                        if(item.receipt_currency === 'TZS') {
                            let tzs_amount = new Decimal(fee_total).times(new Decimal(item.receipt_amount_rate))
                            item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                        } else {
                            item.receipt_detail_total = Decimal.isDecimal(fee_total) ? fee_total.toNumber() : fee_total
                        }
                    }
                }
            } else if(r.api_name === 'MNR-RECEIPT') {
                item.receipt_type = 'MNR Receivable'
                item.receipt_business = ''
                let mnr = await tb_mnr_ledger.findOne({
                    where: {
                        container_mnr_ledger_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(mnr) {
                    item.receipt_object = mnr.mnr_ledger_bl
                    let carrier = 'COSCO'
                    if(mnr.mnr_ledger_bl.indexOf('COS') >= 0) {
                        carrier  = 'COSCO'
                    } else if(mnr.mnr_ledger_bl.indexOf('OOLU') >= 0) {
                        carrier  = 'OOCL'
                    }
                    item.receipt_object_carrier = carrier
                    let fees = []
                    fees.push({'fee_name': 'MNR', 'fee_amount': mnr.mnr_ledger_receipt_amount})
                    item.receipt_detail_total = new Decimal(mnr.mnr_ledger_receipt_amount).toNumber()
                    item.receipt_detail = fees
                    if(item.receipt_currency === 'TZS') {
                        let tzs_amount = new Decimal(item.receipt_detail_total).times(new Decimal(item.receipt_amount_rate))
                        item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                    } else {
                        item.receipt_detail_total = Decimal.isDecimal(item.receipt_detail_total) ? item.receipt_detail_total.toNumber() : item.receipt_detail_total
                    }
                }
            } else if(r.api_name === 'UNUSUAL RECEIPT') {
                item.receipt_type = 'UNUSUAL Receivable'
                item.receipt_business = ''
                let unusual = await tb_unusual_invoice.findOne({
                    where: {
                        unusual_invoice_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(unusual) {
                    item.receipt_object = unusual.unusual_invoice_bl
                    let carrier = 'COSCO'
                    if(unusual.unusual_invoice_bl.indexOf('COS') >= 0) {
                        carrier  = 'COSCO'
                    } else if(unusual.unusual_invoice_bl.indexOf('OOLU') >= 0) {
                        carrier  = 'OOCL'
                    }
                    item.receipt_object_carrier = carrier
                    let fees = []
                    fees.push({'fee_name': 'UNUSUAL', 'fee_amount': unusual.unusual_invoice_amount})
                    item.receipt_detail_total = new Decimal(unusual.unusual_invoice_amount).toNumber()
                    item.receipt_detail = fees
                    if(item.receipt_currency === 'TZS') {
                        let tzs_amount = new Decimal(item.receipt_detail_total).times(new Decimal(item.receipt_amount_rate))
                        item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                    } else {
                        item.receipt_detail_total = Decimal.isDecimal(item.receipt_detail_total) ? item.receipt_detail_total.toNumber() : item.receipt_detail_total
                    }
                }
            } else if(r.api_name === 'FIXED-RECEIPT') {
                item.receipt_type = 'Import Fixed'
                item.receipt_business = ''
                let fixed = await tb_fixed_deposit.findOne({
                    where: {
                        fixed_deposit_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(fixed) {
                    item.receipt_object = ''
                    item.receipt_object_carrier = ''
                    let fees = []
                    fees.push({'fee_name': fixed.fixed_deposit_type === 'FD' ? 'FIXED DEPOSIT' : 'GUARANTEE', 'fee_amount': fixed.deposit_amount})
                    item.receipt_detail_total = new Decimal(fixed.deposit_amount).toNumber()
                    item.receipt_detail = fees
                    if(item.receipt_currency === 'TZS') {
                        let tzs_amount = new Decimal(item.receipt_detail_total).times(new Decimal(item.receipt_amount_rate))
                        item.receipt_detail_total = Decimal.isDecimal(tzs_amount) ? tzs_amount.toNumber() : tzs_amount
                    } else {
                        item.receipt_detail_total = Decimal.isDecimal(item.receipt_detail_total) ? item.receipt_detail_total.toNumber() : item.receipt_detail_total
                    }
                }
            }
            item._disabled = true
            let ck = await checkCan2SendReceivable(item)
            if(ck.code) {
                item._disabled = false
            } else {
                item._disabled_message = ck.message
            }
            receivables.push(item)
        }
    }
    returnData.rows = receivables
    return common.success(returnData)
}

exports.submitReceivableAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let errMessage = []
    if(doc.receivable_list) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        logger.error('token', token)
        if(token) {
            first: 
            for(let rl of doc.receivable_list) {
                try {
                    let biz_id = await seq.genU8SystemSeq('BIZ')
                    let receive_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.oughtreceive_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                    let receive_entry = []
                    let u8_customer_code = GLBConfig.U8_CONFIG.u8_cosco_code
                    if(rl.receipt_object_carrier === 'OOCL') {
                        u8_customer_code = GLBConfig.U8_CONFIG.u8_oocl_code
                    }
                    if(rl.receipt_detail && rl.receipt_detail.length > 0) {
                        for(let rd of rl.receipt_detail) {
                            if(rd.fee_type === 'DEPOSIT') {
                                let u8Item = await this.addFItem(rl.receipt_no, rl.receipt_from_u8_alias, rl.receipt_object)
                                if(u8Item) {
                                    receive_entry.push({
                                        cust_vendor_code: u8_customer_code,
                                        subjectcode: rd.fee_code,
                                        currency_name: '美元',
                                        currency_rate: 1,
                                        amount: new Decimal(rd.fee_amount).toNumber(),
                                        digest: rd.fee_digest,
                                        personcode: opUser.u8_code,
                                        deptcode: opUser.u8_department_code,
                                        item_classcode: '00',
                                        item_code: u8Item.citemcode,
                                    })
                                } else {
                                    errMessage.push(rl.receipt_no + 'create item error: ')
                                    continue first
                                }
                            } else {
                                receive_entry.push({
                                    cust_vendor_code: u8_customer_code,
                                    subjectcode: rd.fee_code,
                                    currency_name: '美元',
                                    currency_rate: 1,
                                    amount: new Decimal(rd.fee_amount).toNumber(),
                                    digest: rd.fee_digest,
                                    personcode: opUser.u8_code,
                                    deptcode: opUser.u8_department_code
                                })
                            }
                            // if(rl.receipt_currency === 'USD') {
                            //     receive_entry.push({
                            //         cust_vendor_code: rl.receipt_from_u8_code,
                            //         subjectcode: rd.fee_code,
                            //         currency_name: '美元',
                            //         currency_rate: 1,
                            //         amount: new Decimal(rd.fee_amount).toNumber(),
                            //         digest: rd.fee_digest,
                            //         personcode: 'D-00001', // TODO personcode: user.u8_code,
                            //         deptcode: opUser.u8_department_code
                            //     })
                            // } else {
                            //     let rd_amount = await getReceiptAmount('USD', rd.fee_amount, rl.receipt_amount_rate)
                            //     receive_entry.push({
                            //         cust_vendor_code: rl.receipt_from_u8_code,
                            //         subjectcode: rd.fee_code,
                            //         currency_name: '先令',
                            //         currency_rate: new Decimal(rl.receipt_amount_rate).toNumber(),
                            //         amount: new Decimal(rd_amount.originalamount).toNumber(),
                            //         natamount: new Decimal(rd_amount.natamount).toNumber(),
                            //         digest: rd.fee_digest,
                            //         personcode: 'D-00001', // TODO personcode: user.u8_code,
                            //         deptcode: opUser.u8_department_code
                            //     })
                            // }
                            
                        }
                    }
                    
                    let oughtreceive = {}
                    let rl_amount = await getReceiptAmount(rl.receipt_currency, rl.receipt_amount, rl.receipt_amount_rate)
                    let receipt_amount = rl.receipt_amount
                    let natamount = rl_amount.natamount
                    let originalamount = rl_amount.originalamount
                    if(rl.receipt_currency === 'USD') {
                        oughtreceive = {
                            code: rl.receipt_no, // 应收单号
                            date: moment().format('YYYY-MM-DD'), // 单据日期
                            cust_vendor_code: u8_customer_code, // 客商编码
                            subjectcode: rl.parent_code,
                            currency_name: '美元',
                            currency_rate: 1,
                            amount: new Decimal(rl.receipt_amount).toNumber(),
                            operator: rl.operator_name, // 操作员
                            digest: 'Receivable from consignee',
                            entry: receive_entry,
                            define2: rl.receipt_from_u8_alias
                        }
                    } else {
                        oughtreceive = {
                            code: rl.receipt_no, // 应收单号
                            date: moment().format('YYYY-MM-DD'), // 单据日期
                            cust_vendor_code: u8_customer_code, // 客商编码
                            subjectcode: rl.parent_code,
                            currency_name: '美元',
                            currency_rate: 1,
                            amount: new Decimal(natamount).toNumber(),
                            operator: rl.operator_name, // 操作员
                            digest: 'Receivable from consignee',
                            entry: receive_entry,
                            define2: rl.receipt_from_u8_alias
                        }
                    }
                    let receive_param = {
                        oughtreceive: oughtreceive
                    }
                    logger.error('oughtreceive', oughtreceive)
                    logger.error('receive_entry', receive_entry)
                    logger.error('receive_url', receive_url)
                    logger.error('receive_param', receive_param)
                    await axios.post(receive_url, receive_param).then(async response => {
                        logger.error('receive_response', response.data)
                        let data = response.data
                        if(data) {
                            if(data.errcode === '0') {
                                let rl_add = await tb_ought_receive.create({
                                    ought_receive_receipt_file_id: rl.receipt_id,
                                    ought_receive_no: rl.receipt_no,
                                    ought_receive_type: rl.receipt_type,
                                    ought_receive_amount: receipt_amount,
                                    ought_receive_natamount: natamount,
                                    ought_receive_original_amount: originalamount,
                                    ought_receive_currency: rl.receipt_currency,
                                    ought_receive_bank: rl.receipt_bank,
                                    ought_receive_reference_no: rl.receipt_reference_no,
                                    ought_receive_object_id: rl.receipt_object_id,
                                    ought_receive_object: rl.receipt_object,
                                    ought_receive_carrier: rl.receipt_object_carrier,
                                    ought_receive_from_id: rl.receipt_from_id,
                                    ought_receive_from: rl.receipt_from,
                                    ought_receive_from_u8_code: rl.receipt_from_u8_code,
                                    ought_receive_from_u8_alias: rl.receipt_from_u8_alias,
                                    ought_receive_operator_id: opUser.user_id,
                                    ought_receive_operator_name: opUser.user_name,
                                    ought_receive_subject_code: rl.parent_code,
                                    ought_receive_u8_id: data.id,
                                    ought_receive_u8_trade_id: data.tradeid,
                                    ought_receive_u8_biz_id: biz_id,
                                    ought_receive_balance_code: rl.receipt_check_cash,
                                    ought_receive_currency_rate: rl.receipt_amount_rate,
                                    ought_receive_digest: rl.receipt_digest
                                })
                                if(rl_add && rl.receipt_detail && rl.receipt_detail.length > 0) {
                                    for(let rd of rl.receipt_detail) {
                                        let rd_amount = await getReceiptAmount('USD', rd.fee_amount, rl.receipt_amount_rate)
                                        await tb_ought_receive_detail.create({
                                            ought_receive_id: rl_add.ought_receive_id,
                                            ought_receive_detail_code: rd.fee_code,
                                            ought_receive_detail_fee_code: rd.fee_type,
                                            ought_receive_detail_fee_name: rd.fee_name,
                                            ought_receive_detail_amount: rd.fee_amount,
                                            ought_receive_detail_natamount: rd_amount.natamount,
                                            ought_receive_detail_original_amount: rd_amount.originalamount,
                                            ought_receive_detail_digest: rd.fee_digest,
                                        })
                                    }
                                }
                            } else {
                                // todo 发送失败
                                errMessage.push(rl.receipt_no + 'send error: ' + data.errmsg)
                            }
                        } else {
                            // todo 发送失败
                            errMessage.push(rl.receipt_no + 'send error: no return')
                        }
                    }).catch(function (error) {
                        logger.error('receive_error', error)
                        errMessage.push(rl.receipt_no + 'send error: ' + error)
                    })
                } catch(err) {
                    errMessage.push(rl.receipt_no + 'send error: ' + err)
                }
            }
        } else {
            return common.error('u8_01')
        }
    }
    if(errMessage && errMessage.length > 0) {
        returnData.code = '0'
        returnData.errMessage = errMessage.join(', ')
    } else {
        returnData.code = '1'
    }
    return common.success(returnData)
}

exports.queryReceivedAct= async req => {
    let doc = common.docValidate(req), user = req.user
    let returnData = {}
    let queryStr = `SELECT u.* from tbl_zhongtan_finance_ought_receive u WHERE u.state = 1 AND u.ought_receive_u8_id IS NOT NULL AND accept_u8_id IS NULL `
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.receivable_date && doc.search_data.receivable_date.length > 1 && doc.search_data.receivable_date[0]  && doc.search_data.receivable_date[1]) {
            let start_date = doc.search_data.receivable_date[0]
            let end_date = doc.search_data.receivable_date[1]
            queryStr += ` AND created_at >= ? and created_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.receipt_carrier) {
            queryStr += ` AND uploadfile_receipt_no like ? `
            replacements.push(doc.search_data.receipt_carrier + '%')
        }
    }

    queryStr += ' ORDER BY ought_receive_id DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    if(rows && rows.length > 0) {
        for(let r of rows) {
            r.operator_id = user.user_id
            r.operator_name = user.user_name
            r.created_at = moment(r.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            r.updated_at = moment(r.updated_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            if(r.ought_receive_receipt_file_id) {
                let receipt_file = await tb_upload_file.findOne({
                    where: {
                        uploadfile_id: r.ought_receive_receipt_file_id,
                        state : GLBConfig.ENABLE
                    }
                })
                if(receipt_file) {
                    r.receipt_url = receipt_file.uploadfile_url
                }
            }
            let details = await tb_ought_receive_detail.findAll({
                where: {
                    ought_receive_id: r.ought_receive_id,
                    state : GLBConfig.ENABLE
                }
            })
            let receive_detail = []
            if(details && details.length > 0) {
                for(let d of details) {
                    receive_detail.push({
                        ought_receive_detail_id: d.ought_receive_detail_id,
                        ought_receive_id: d.ought_receive_id,
                        ought_receive_detail_code: d.ought_receive_detail_code,
                        ought_receive_detail_fee_code: d.ought_receive_detail_fee_code,
                        ought_receive_detail_fee_name: d.ought_receive_detail_fee_name,
                        ought_receive_detail_amount: d.ought_receive_detail_amount,
                        ought_receive_detail_natamount: d.ought_receive_detail_natamount,
                        ought_receive_detail_original_amount: d.ought_receive_detail_original_amount,
                        ought_receive_detail_digest: d.ought_receive_detail_digest,
                        created_at: moment(d.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss'),
                    })
                }
            }
            r._disabled_received = true
            if(r.ought_receive_currency && r.ought_receive_bank && r.ought_receive_from_u8_alias) {
                let match_codes = await tb_match_code.findAll({
                    where: {
                        match_code_bill_type: 'accept',
                        match_code_fee_currency: r.ought_receive_currency,
                        match_code_fee_bank: r.ought_receive_bank,
                        state: GLBConfig.ENABLE
                    }
                })
                if(match_codes && match_codes.length === 1) {
                    r.parent_code = match_codes[0].finance_subject_code

                    let sc = await tb_subject_code.findOne({
                        where: {
                            subject_code: r.parent_code,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(sc && receive_detail && receive_detail.length > 0) {
                        r.received_digest = 'Received from ' + r.ought_receive_from_u8_alias + '/' + r.ought_receive_reference_no
                        for(let d of receive_detail) {
                            d.received_fee_code = sc.parent_code
                            d.received_fee_digest = d.ought_receive_detail_fee_name
                        }
                    }
                    r._disabled_received = false
                } else {
                    r._disabled_message = 'Subject Code do not exist or repeat.'
                }
            } else {
                if(!r.ought_receive_currency) {
                    r._disabled_message = 'Currency do not exist.'
                } else if(!r.ought_receive_bank) {
                    r._disabled_message = 'Bank do not exist.'
                } else if(!r.ought_receive_from_u8_alias) {
                    r._disabled_message = 'Customer do not exist in U8 System.'
                }
            }
            if(details) {
                r.receive_detail = receive_detail
            }
        }
    }
    returnData.rows = rows
    return common.success(returnData)
}

exports.submitReceivedBankInfoAct = async req => {
    let doc = common.docValidate(req), user = req.user
    if(doc.received_list) {
        let submit_data = doc.submit_data
        if(submit_data.received_bank) {
            for(let rl of doc.received_list) {
                let rd = await tb_ought_receive.findOne({
                    where: {
                        ought_receive_id: rl.ought_receive_id,
                        state: GLBConfig.ENABLE
                    }
                })
                if(rd) {
                    rd.ought_receive_bank = submit_data.received_bank
                    await rd.save()
                }
            }
        }
    }
    return common.success()
}

exports.submitReceivedAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let errMessage = []
    if(doc.received_list) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        logger.error('token', token)
        if(token) {
            try {
                for(let rl of doc.received_list) {
                    let rd = await tb_ought_receive.findOne({
                        where: {
                            ought_receive_id: rl.ought_receive_id,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(rd) {
                        if(rd.ought_receive_bank === 'ROLLOVER') {
                            // 押金调整 固定科目2251 需要创建item
                            let u8Item = await this.addFItem(rd.ought_receive_no, rd.ought_receive_from_u8_alias, rd.ought_receive_object)
                            let addSubFItem = await this.addSubFItem(rd.ought_receive_reference_no)
                            if(u8Item && addSubFItem) {
                                let u8_customer_code = GLBConfig.U8_CONFIG.u8_cosco_code
                                if(rd.ought_receive_carrier === 'OOCL') {
                                    u8_customer_code = GLBConfig.U8_CONFIG.u8_oocl_code
                                }
                                let biz_id = await seq.genU8SystemSeq('BIZ')
                                let vouch_code = await seq.genU8SystemSeq('RECEIVED')
                                let accept_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                                let accept_entry = []
                                if(rl.receive_detail && rl.receive_detail.length > 0) {
                                    for(let d of rl.receive_detail) {
                                        let entry_rate = 1
                                        let entry_amount = new Decimal(d.ought_receive_detail_amountt).toNumber()
                                        let entry_original_amount = new Decimal(d.ought_receive_detail_amount).toNumber()
                                        if(rl.ought_receive_currency === 'TZS') {
                                            entry_rate = new Decimal(rl.ought_receive_currency_rate).toNumber()
                                            entry_amount = new Decimal(d.ought_receive_detail_natamount).toNumber()
                                            entry_original_amount = new Decimal(d.ought_receive_detail_original_amount).toNumber()
                                        }
                                        accept_entry.push({
                                            customercode: u8_customer_code,
                                            itemcode: '2251',
                                            foreigncurrency: rl.ought_receive_currency,
                                            currencyrate: entry_rate,
                                            amount: entry_amount,
                                            originalamount: entry_original_amount,
                                            cmemo: 'Received from consignee',//d.received_fee_digest,
                                            type: 2,
                                            projectclass: '00',
                                            project: addSubFItem.citemcode,
                                        })
                                    }
                                }
                                let accept = {
                                    vouchcode: vouch_code, // 应收单号
                                    vouchdate: moment().format('YYYY-MM-DD'), // 单据日期
                                    period: moment().format('M'), // 单据日期 月份
                                    vouchtype: '48',
                                    customercode: u8_customer_code, // 客商编码
                                    balanceitemcode: '2251',
                                    balancecode: '4',
                                    foreigncurrency: rl.ought_receive_currency,
                                    currencyrate: rl.ought_receive_currency === 'USD' ? 1 : new Decimal(rl.ought_receive_currency_rate).toNumber(),
                                    amount: rl.ought_receive_currency === 'USD' ? new Decimal(rl.ought_receive_amount).toNumber() : new Decimal(rl.ought_receive_natamount).toNumber(), //
                                    originalamount: rl.ought_receive_currency === 'USD' ? new Decimal(rl.ought_receive_amount).toNumber() : new Decimal(rl.ought_receive_original_amount).toNumber(),
                                    operator: opUser.user_name, // 操作员
                                    digest: rl.received_digest,
                                    itemclasscode: '00',
                                    itemcode: u8Item.citemcode,
                                    entry: accept_entry
                                }
                                rd.ought_accept_subject_code = rl.parent_code
                                let accept_param = {
                                    accept: accept
                                }
                                logger.error('accept', accept)
                                logger.error('accept_entry', accept_entry)
                                logger.error('accept_url', accept_url)
                                logger.error('accept_param', accept_param)
                                await axios.post(accept_url, accept_param).then(async response => {
                                    logger.error('accept_response', response.data)
                                    let data = response.data
                                    if(data) {
                                        if(data.errcode === '0') {
                                            rd.received_no = vouch_code
                                            rd.accept_u8_id = data.id
                                            rd.accept_trade_id = data.tradeid
                                            rd.accept_u8_biz_id = biz_id
                                            rd.ought_received_digest = rl.received_digest
                                            rd.accept_at = new Date()
                                            await rd.save()

                                            if(rl.receive_detail && rl.receive_detail.length > 0) {
                                                for(let d of rl.receive_detail) {
                                                    let rdd = await tb_ought_receive_detail.findOne({
                                                        where: {
                                                            ought_receive_detail_id: d.ought_receive_detail_id,
                                                            state: GLBConfig.ENABLE
                                                        }
                                                    })
                                                    if(rdd) {
                                                        rdd.ought_received_detail_code = d.received_fee_code
                                                        rdd.ought_received_detail_digest = d.received_fee_digest
                                                        await rdd.save()
                                                    }
                                                }
                                            }
                                        } else {
                                            errMessage.push(rl.ought_receive_no + 'send error: ' + data.errmsg)
                                        }
                                    } else {
                                        errMessage.push(rl.ought_receive_no + 'send error: no return')
                                    }
                                }).catch(function (error) {
                                    logger.error('accept_error', error)
                                    errMessage.push(rl.ought_receive_no + 'send error: ' + error)
                                })
                            } else {
                                errMessage.push(rl.ought_receive_no + 'create item failed')
                            }
                        } else {
                            let u8_customer_code = GLBConfig.U8_CONFIG.u8_cosco_code
                            if(rd.ought_receive_carrier === 'OOCL') {
                                u8_customer_code = GLBConfig.U8_CONFIG.u8_oocl_code
                            }
                            let biz_id = await seq.genU8SystemSeq('BIZ')
                            let vouch_code = await seq.genU8SystemSeq('RECEIVED')
                            let accept_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                            let accept_entry = []
                            if(rl.receive_detail && rl.receive_detail.length > 0) {
                                for(let d of rl.receive_detail) {
                                    accept_entry.push({
                                        customercode: u8_customer_code,
                                        itemcode: d.received_fee_code,
                                        foreigncurrency: rl.ought_receive_currency,
                                        currencyrate: rl.ought_receive_currency === 'USD' ? 1 : new Decimal(rl.ought_receive_currency_rate).toNumber(),
                                        amount: rl.ought_receive_currency === 'USD' ? new Decimal(d.ought_receive_detail_amount).toNumber() : new Decimal(d.ought_receive_detail_natamount).toNumber(),
                                        originalamount: rl.ought_receive_currency === 'USD' ? new Decimal(d.ought_receive_detail_amount).toNumber() : new Decimal(d.ought_receive_detail_original_amount).toNumber(),
                                        cmemo: 'Received from consignee'//d.received_fee_digest,
                                    })
                                }
                            }
                            let balancecode = '1'
                            if(rl.ought_receive_balance_code === 'CHEQUE') {
                                balancecode = '2'
                            } else if(rl.ought_receive_balance_code === 'CASH') {
                                balancecode = '3'
                            } 
                            let accept = {
                                vouchcode: vouch_code, // 应收单号
                                vouchdate: moment().format('YYYY-MM-DD'), // 单据日期
                                period: moment().format('M'), // 单据日期 月份
                                vouchtype: '48',
                                customercode: u8_customer_code, // 客商编码
                                balanceitemcode: rl.parent_code,
                                balancecode: balancecode,
                                foreigncurrency: rl.ought_receive_currency,
                                currencyrate: rl.ought_receive_currency === 'USD' ? 1 : new Decimal(rl.ought_receive_currency_rate).toNumber(),
                                amount: rl.ought_receive_currency === 'USD' ? new Decimal(rl.ought_receive_amount).toNumber() : new Decimal(rl.ought_receive_natamount).toNumber(), //
                                originalamount: rl.ought_receive_currency === 'USD' ? new Decimal(rl.ought_receive_amount).toNumber() : new Decimal(rl.ought_receive_original_amount).toNumber(),
                                operator: opUser.user_name, // 操作员
                                digest: rl.received_digest,
                                entry: accept_entry
                            }
                            rd.ought_accept_subject_code = rl.parent_code
                            let accept_param = {
                                accept: accept
                            }
                            logger.error('accept', accept)
                            logger.error('accept_entry', accept_entry)
                            logger.error('accept_url', accept_url)
                            logger.error('accept_param', accept_param)
                            await axios.post(accept_url, accept_param).then(async response => {
                                logger.error('accept_response', response.data)
                                let data = response.data
                                if(data) {
                                    if(data.errcode === '0') {
                                        rd.received_no = vouch_code
                                        rd.accept_u8_id = data.id
                                        rd.accept_trade_id = data.tradeid
                                        rd.accept_u8_biz_id = biz_id
                                        rd.ought_received_digest = rl.received_digest
                                        rd.accept_at = new Date()
                                        await rd.save()

                                        if(rl.receive_detail && rl.receive_detail.length > 0) {
                                            for(let d of rl.receive_detail) {
                                                let rdd = await tb_ought_receive_detail.findOne({
                                                    where: {
                                                        ought_receive_detail_id: d.ought_receive_detail_id,
                                                        state: GLBConfig.ENABLE
                                                    }
                                                })
                                                if(rdd) {
                                                    rdd.ought_received_detail_code = d.received_fee_code
                                                    rdd.ought_received_detail_digest = d.received_fee_digest
                                                    await rdd.save()
                                                }
                                            }
                                        }
                                    } else {
                                        errMessage.push(rl.ought_receive_no + 'send error: ' + data.errmsg)
                                    }
                                } else {
                                    errMessage.push(rl.ought_receive_no + 'send error: no return')
                                }
                            }).catch(function (error) {
                                logger.error('accept_error', error)
                                errMessage.push(rl.ought_receive_no + 'send error: ' + error)
                            })
                        }
                    } else {
                        errMessage.push(rl.ought_receive_no + 'may not exist or may have been deleted ')
                    }
                }
            } catch(err) {
                errMessage.push(rl.ought_receive_no + 'send error: ' + err)
            }
        } else {
            errMessage.push('U8 system api token not exist')
        }
    }
    if(errMessage && errMessage.length > 0) {
        returnData.code = '0'
        returnData.errMessage = errMessage.join(', ')
    } else {
        returnData.code = '1'
    }
    return common.success(returnData)
}

exports.watchU8ReceviableAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let rd = await tb_ought_receive.findOne({
        where: {
            ought_receive_id: doc.ought_receive_id,
            state: GLBConfig.ENABLE
        }
    })
    let ought_receive = ''
    if(rd && rd.ought_receive_u8_id) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.oughtreceive_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${rd.ought_receive_u8_id}`
            await axios.get(get_url).then(async response => {
                logger.error(response.data)
                let data = response.data
                if(data) {
                    if(data.errcode === '0') {
                        ought_receive = data.oughtreceive
                    }
                }
            })
        }
    }
    if(ought_receive) {
        return common.success(ought_receive)
    } else {
        return common.error('u8_02')
    }
}

exports.queryCompleteAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let returnData = {}
    let queryStr = `SELECT u.* from tbl_zhongtan_finance_ought_receive u WHERE u.state = 1 AND u.ought_receive_u8_id IS NOT NULL AND accept_u8_id IS NOT NULL `
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.receivable_date && doc.search_data.receivable_date.length > 1 && doc.search_data.receivable_date[0]  && doc.search_data.receivable_date[1]) {
            let start_date = doc.search_data.receivable_date[0]
            let end_date = doc.search_data.receivable_date[1]
            queryStr += ` AND created_at >= ? and created_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }

        if(doc.search_data.received_date && doc.search_data.received_date.length > 1 && doc.search_data.received_date[0]  && doc.search_data.received_date[1]) {
            let start_date = doc.search_data.received_date[0]
            let end_date = doc.search_data.received_date[1]
            queryStr += ` AND accept_at >= ? and accept_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.receipt_carrier) {
            queryStr += ` AND uploadfile_receipt_no like ? `
            replacements.push(doc.search_data.receipt_carrier + '%')
        }
    }

    queryStr += ' ORDER BY accept_at DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    if(rows && rows.length > 0) {
        for(let r of rows) {
            r.operator_id = user.user_id
            r.operator_name = user.user_name
            r.created_at = moment(r.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            r.updated_at = moment(r.updated_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            r.accept_at = moment(r.updated_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            if(r.ought_receive_receipt_file_id) {
                let receipt_file = await tb_upload_file.findOne({
                    where: {
                        uploadfile_id: r.ought_receive_receipt_file_id,
                        state : GLBConfig.ENABLE
                    }
                })
                if(receipt_file) {
                    r.receipt_url = receipt_file.uploadfile_url
                }
            }
            let receive_detail = []
            let details = await tb_ought_receive_detail.findAll({
                where: {
                    ought_receive_id: r.ought_receive_id,
                    state : GLBConfig.ENABLE
                }
            })
            if(details && details.length > 0) {
                for(let d of details) {
                    receive_detail.push({
                        ought_receive_detail_id: d.ought_receive_detail_id,
                        ought_receive_id: d.ought_receive_id,
                        ought_receive_detail_code: d.ought_receive_detail_code,
                        ought_receive_detail_fee_code: d.ought_receive_detail_fee_code,
                        ought_receive_detail_fee_name: d.ought_receive_detail_fee_name,
                        ought_receive_detail_amount: d.ought_receive_detail_amount,
                        ought_receive_detail_natamount: d.ought_receive_detail_natamount,
                        ought_receive_detail_original_amount: d.ought_receive_detail_original_amount,
                        ought_receive_detail_digest: d.ought_receive_detail_digest,
                        ought_received_detail_code: d.ought_received_detail_code,
                        ought_received_detail_digest: d.ought_received_detail_digest,
                        created_at: moment(d.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss'),
                    })
                }
            }
            r.receive_detail = receive_detail
            if(r.ought_received_split === '1') {
                let splits = await tb_receive_split.findAll({
                    where: {
                        ought_receive_id: r.ought_receive_id,
                        state : GLBConfig.ENABLE
                    }
                })
                if(splits && splits.length > 0) {
                    let split_detail = []
                    for(let s of splits) {
                        let split_detail_fee = []
                        let sds = await tb_receive_split_detail.findAll({
                            where: {
                                receive_split_id: s.receive_split_id,
                                state : GLBConfig.ENABLE
                            }
                        })
                        if(sds && sds.length > 0) {
                            for(let ss of sds) {
                                split_detail_fee.push({
                                    split_detail_id: ss.split_detail_id,
                                    split_detail_amount: ss.split_detail_amount,
                                    split_detail_natamount: ss.split_detail_natamount,
                                    split_detail_original_amount: ss.split_detail_original_amount,
                                    split_detail_code: ss.split_detail_code,
                                    split_detail_fee_code: ss.split_detail_fee_code,
                                    split_detail_fee_name: ss.split_detail_fee_name,
                                })
                            }
                        }
                        split_detail.push({
                            receive_split_id: s.receive_split_id,
                            ought_receive_id: s.ought_receive_id,
                            receive_split_amount: s.receive_split_amount,
                            receive_split_natamount: s.receive_split_natamount,
                            receive_split_original_amount: s.receive_split_original_amount,
                            receive_split_bank: s.receive_split_bank,
                            receive_split_currency: s.receive_split_currency,
                            receive_split_reference_no: s.receive_split_reference_no,
                            receive_split_subject_code: s.receive_split_subject_code,
                            receive_split_received_no: s.receive_split_received_no,
                            receive_split_u8_id: s.receive_split_u8_id,
                            receive_split_trade_id: s.receive_split_trade_id,
                            receive_split_u8_biz_id: s.receive_split_u8_biz_id,
                            created_at: moment(s.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss'),
                            split_fees: split_detail_fee
                        })
                    }
                    r.split_detail = split_detail
                }
            }
        }
    }
    returnData.rows = rows
    return common.success(returnData)
}

exports.watchU8ReceviedAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let rd = await tb_ought_receive.findOne({
        where: {
            ought_receive_id: doc.ought_receive_id,
            state: GLBConfig.ENABLE
        }
    })
    let ought_receive = ''
    if(rd && rd.ought_receive_u8_id) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${rd.accept_u8_id}`
            await axios.get(get_url).then(async response => {
                logger.error(response.data)
                let data = response.data
                if(data) {
                    if(data.errcode === '0') {
                        ought_receive = data.accept
                    }
                }
            })
        }
    }
    if(ought_receive) {
        return common.success(ought_receive)
    } else {
        return common.error('u8_02')
    }
}

exports.watchU8SplitReceviedAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let rs = await tb_receive_split.findOne({
        where: {
            receive_split_id: doc.receive_split_id,
            state: GLBConfig.ENABLE
        }
    })
    let ought_receive = ''
    if(rs && rs.receive_split_u8_id) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${rs.receive_split_u8_id}`
            await axios.get(get_url).then(async response => {
                logger.error(response.data)
                let data = response.data
                if(data) {
                    if(data.errcode === '0') {
                        ought_receive = data.accept
                    }
                }
            })
        }
    }
    if(ought_receive) {
        return common.success(ought_receive)
    } else {
        return common.error('u8_02')
    }
}

exports.submitSplitReceivedAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let errMessage = []
    if(doc.split_received_list) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        logger.error('token', token)
        if(token) {
            try {
                first:
                for(let srl of doc.split_received_list) {
                    let rd = await tb_ought_receive.findOne({
                        where: {
                            ought_receive_id: srl.ought_receive_id,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(rd) {
                        let split_detail = srl.split_detail
                        if(split_detail && split_detail.length > 0) {
                            let split_flg = false
                            if(split_detail.length > 1) {
                                split_flg = true
                                rd.ought_received_split = GLBConfig.ENABLE
                                await rd.save()
                            }
                            second:
                            for(let sd of split_detail) {
                                let rs_add = null
                                if(split_flg) {
                                    rs_add = await tb_receive_split.create({
                                        ought_receive_id: rd.ought_receive_id,
                                        receive_split_amount: sd.split_amount,
                                        receive_split_bank: sd.split_bank,
                                        receive_split_currency: sd.split_currency,
                                        receive_split_reference_no: sd.split_reference_no
                                    })
                                }
                                if(sd.split_bank === 'ROLLOVER') {
                                    let u8Item = await this.addFItem(rd.ought_receive_no, rd.ought_receive_from_u8_alias, rd.ought_receive_object)
                                    let addSubFItem = await this.addSubFItem(rd.ought_receive_reference_no)
                                    if(u8Item && addSubFItem) {
                                        let u8_customer_code = GLBConfig.U8_CONFIG.u8_cosco_code
                                        if(rd.ought_receive_carrier === 'OOCL') {
                                            u8_customer_code = GLBConfig.U8_CONFIG.u8_oocl_code
                                        }
                                        let biz_id = await seq.genU8SystemSeq('BIZ')
                                        let vouch_code = await seq.genU8SystemSeq('RECEIVED')
                                        let accept_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                                        let accept_entry = []
                                        if(sd.split_fees && sd.split_fees.length > 0) {
                                            for(let d of sd.split_fees) {
                                                let entry_rate = 1
                                                let entry_amount = new Decimal(d.split_detail_amount).toNumber()
                                                if(entry_amount !== 0) {
                                                    let entry_original_amount = new Decimal(d.split_detail_amount).toNumber()
                                                    if(sd.split_currency === 'TZS') {
                                                        entry_rate = new Decimal(srl.ought_receive_currency_rate).toNumber()
                                                        let entry_format_amount = await this.getReceiptAmount(sd.split_currency, d.split_detail_amount, srl.ought_receive_currency_rate)
                                                        entry_amount = new Decimal(entry_format_amount.natamount).toNumber()
                                                        entry_original_amount = new Decimal(entry_format_amount.originalamount).toNumber()
                                                    }
                                                    accept_entry.push({
                                                        customercode: u8_customer_code,
                                                        itemcode: '2251',
                                                        foreigncurrency: sd.split_currency,
                                                        currencyrate: entry_rate,
                                                        amount: entry_amount,
                                                        originalamount: entry_original_amount,
                                                        cmemo: 'Received from consignee',//d.received_fee_digest,
                                                        type: 2,
                                                        projectclass: '00',
                                                        project: addSubFItem.citemcode,
                                                    })

                                                    if(split_flg) {
                                                        await tb_receive_split_detail.create({
                                                            receive_split_id: rs_add.receive_split_id,
                                                            ought_receive_id: rs_add.ought_receive_id,
                                                            split_detail_amount: d.split_detail_amount,
                                                            split_detail_natamount: entry_amount,
                                                            split_detail_original_amount: entry_original_amount,
                                                            split_detail_code: '2251',
                                                            split_detail_fee_code: d.ought_receive_detail_fee_code,
                                                            split_detail_fee_name: d.ought_receive_detail_fee_name
                                                        })
                                                    }
                                                }
                                            }
                                        }

                                        if(accept_entry.length === 0) {
                                            continue second
                                        }
                                        let accept_rate = 1
                                        let accept_amount = new Decimal(sd.split_amount).toNumber()
                                        let accept_original_amount = new Decimal(sd.split_amount).toNumber()
                                        if(sd.split_currency === 'TZS') {
                                            accept_rate = new Decimal(srl.ought_receive_currency_rate).toNumber()
                                            let accept_format_amount = await this.getReceiptAmount(sd.split_currency, sd.split_amount, srl.ought_receive_currency_rate)
                                            accept_amount = new Decimal(accept_format_amount.natamount).toNumber()
                                            accept_original_amount = new Decimal(accept_format_amount.originalamount).toNumber()
                                        }
                                        let accept = {
                                            vouchcode: vouch_code, // 应收单号
                                            vouchdate: moment().format('YYYY-MM-DD'), // 单据日期
                                            period: moment().format('M'), // 单据日期 月份
                                            vouchtype: '48',
                                            customercode: u8_customer_code, // 客商编码
                                            balanceitemcode: '2251',
                                            balancecode: '4',
                                            foreigncurrency: sd.split_currency,
                                            currencyrate: accept_rate,
                                            amount:accept_amount, //
                                            originalamount: accept_original_amount,
                                            operator: opUser.user_name, // 操作员
                                            digest: 'Received from ' + srl.ought_receive_from_u8_alias + '/' + sd.split_reference_no,
                                            entry: accept_entry,
                                            itemclasscode: '00',
                                            itemcode: u8Item.citemcode,
                                        }
                                        rd.ought_accept_subject_code = '2251'
                                        let accept_param = {
                                            accept: accept
                                        }
                                        if(split_flg) {
                                            rs_add.receive_split_natamount = accept_amount
                                            rs_add.receive_split_original_amount = accept_original_amount
                                            rs_add.receive_split_subject_code = '2251'
                                            rs_add.receive_split_received_no = vouch_code
                                        }
                                        logger.error('accept_split', accept)
                                        logger.error('accept_split_entry', accept_entry)
                                        logger.error('accept_split_url', accept_url)
                                        logger.error('accept_split_param', accept_param)
                                        await axios.post(accept_url, accept_param).then(async response => {
                                            logger.error('accept_split_response', response.data)
                                            let data = response.data
                                            if(data) {
                                                if(data.errcode === '0') {
                                                    if(split_flg) {
                                                        rs_add.receive_split_u8_id = data.id
                                                        rs_add.receive_split_trade_id = data.tradeid
                                                        rs_add.receive_split_u8_biz_id = biz_id
                                                        await rs_add.save()

                                                        rd.received_no = vouch_code
                                                        rd.accept_u8_id = data.id
                                                        rd.accept_trade_id = data.tradeid
                                                        rd.accept_u8_biz_id = biz_id
                                                        rd.accept_at = new Date()
                                                        await rd.save()
                                                    } else {
                                                        rd.received_no = vouch_code
                                                        rd.accept_u8_id = data.id
                                                        rd.accept_trade_id = data.tradeid
                                                        rd.accept_u8_biz_id = biz_id
                                                        rd.ought_received_digest = rl.received_digest
                                                        rd.accept_at = new Date()
                                                        await rd.save()
            
                                                        if(rl.receive_detail && rl.receive_detail.length > 0) {
                                                            for(let d of rl.receive_detail) {
                                                                let rdd = await tb_ought_receive_detail.findOne({
                                                                    where: {
                                                                        ought_receive_detail_id: d.ought_receive_detail_id,
                                                                        state: GLBConfig.ENABLE
                                                                    }
                                                                })
                                                                if(rdd) {
                                                                    rdd.ought_received_detail_code = d.received_fee_code
                                                                    rdd.ought_received_detail_digest = d.received_fee_digest
                                                                    await rdd.save()
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    errMessage.push(srl.ought_receive_no + 'send error: ' + data.errmsg)
                                                }
                                            } else {
                                                errMessage.push(srl.ought_receive_no + 'send error: no return')
                                            }
                                        }).catch(function (error) {
                                            logger.error('accept_split_error', error)
                                            errMessage.push(srl.ought_receive_no + 'send error: ' + error)
                                        })
                                    } else {
                                        errMessage.push(srl.ought_receive_no + 'create item failed')
                                    }
                                } else {
                                    let u8_customer_code = GLBConfig.U8_CONFIG.u8_cosco_code
                                    if(rd.ought_receive_carrier === 'OOCL') {
                                        u8_customer_code = GLBConfig.U8_CONFIG.u8_oocl_code
                                    }
                                    let accept_item_code = ''
                                    let entry_item_code = ''
                                    let match_codes = await tb_match_code.findAll({
                                        where: {
                                            match_code_bill_type: 'accept',
                                            match_code_fee_currency: sd.split_currency,
                                            match_code_fee_bank: sd.split_bank,
                                            state: GLBConfig.ENABLE
                                        }
                                    })
                                    if(match_codes && match_codes.length === 1) {
                                        accept_item_code = match_codes[0].finance_subject_code
                                        let sc = await tb_subject_code.findOne({
                                            where: {
                                                subject_code: accept_item_code,
                                                state: GLBConfig.ENABLE
                                            }
                                        })
                                        if(sc) {
                                            entry_item_code = sc.parent_code
                                        }
                                    }
                                    if(!accept_item_code || !entry_item_code) {
                                        errMessage.push(srl.ought_receive_no + ' item code not exist')
                                        continue first
                                    }

                                    let biz_id = await seq.genU8SystemSeq('BIZ')
                                    let vouch_code = await seq.genU8SystemSeq('RECEIVED')
                                    let accept_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.accept_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                                    let accept_entry = []
                                    if(sd.split_fees && sd.split_fees.length > 0) {
                                        for(let d of sd.split_fees) {
                                            let entry_rate = 1
                                            let entry_amount = new Decimal(d.split_detail_amount).toNumber()
                                            if(entry_amount !== 0) {
                                                let entry_original_amount = new Decimal(d.split_detail_amount).toNumber()
                                                if(sd.split_currency === 'TZS') {
                                                    entry_rate = new Decimal(srl.ought_receive_currency_rate).toNumber()
                                                    let entry_format_amount = await this.getReceiptAmount(sd.split_currency, d.split_detail_amount, srl.ought_receive_currency_rate)
                                                    entry_amount = new Decimal(entry_format_amount.natamount).toNumber()
                                                    entry_original_amount = new Decimal(entry_format_amount.originalamount).toNumber()
                                                }
                                                accept_entry.push({
                                                    customercode: u8_customer_code,
                                                    itemcode: entry_item_code,
                                                    foreigncurrency: sd.split_currency,
                                                    currencyrate: entry_rate,
                                                    amount: entry_amount,
                                                    originalamount: entry_original_amount,
                                                    cmemo: 'Received from consignee'//d.received_fee_digest,
                                                })
                                                if(split_flg) {
                                                    await tb_receive_split_detail.create({
                                                        receive_split_id: rs_add.receive_split_id,
                                                        ought_receive_id: rs_add.ought_receive_id,
                                                        split_detail_amount: d.split_detail_amount,
                                                        split_detail_natamount: entry_amount,
                                                        split_detail_original_amount: entry_original_amount,
                                                        split_detail_code: entry_item_code,
                                                        split_detail_fee_code: d.ought_receive_detail_fee_code,
                                                        split_detail_fee_name: d.ought_receive_detail_fee_name
                                                    })
                                                }
                                            }
                                        }
                                    }
                                    if(accept_entry.length === 0) {
                                        continue second
                                    }
                                    let balancecode = '1'
                                    if(srl.ought_receive_balance_code === 'CHEQUE') {
                                        balancecode = '2'
                                    } else if(srl.ought_receive_balance_code === 'CASH') {
                                        balancecode = '3'
                                    } 
                                    let accept_rate = 1
                                    let accept_amount = new Decimal(sd.split_amount).toNumber()
                                    let accept_original_amount = new Decimal(sd.split_amount).toNumber()
                                    if(sd.split_currency === 'TZS') {
                                        accept_rate = new Decimal(srl.ought_receive_currency_rate).toNumber()
                                        let accept_format_amount = await this.getReceiptAmount(sd.split_currency, sd.split_amount, srl.ought_receive_currency_rate)
                                        accept_amount = new Decimal(accept_format_amount.natamount).toNumber()
                                        accept_original_amount = new Decimal(accept_format_amount.originalamount).toNumber()
                                    }
                                    let accept = {
                                        vouchcode: vouch_code, // 应收单号
                                        vouchdate: moment().format('YYYY-MM-DD'), // 单据日期
                                        period: moment().format('M'), // 单据日期 月份
                                        vouchtype: '48',
                                        customercode: u8_customer_code, // 客商编码
                                        balanceitemcode: accept_item_code,
                                        balancecode: balancecode,
                                        foreigncurrency: sd.split_currency,
                                        currencyrate: accept_rate,
                                        amount: accept_amount, //
                                        originalamount: accept_original_amount,
                                        operator: opUser.user_name, // 操作员
                                        digest: 'Received from ' + srl.ought_receive_from_u8_alias + '/' + sd.split_reference_no,
                                        entry: accept_entry
                                    }
                                    rd.ought_accept_subject_code = accept_item_code
                                    let accept_param = {
                                        accept: accept
                                    }
                                    if(split_flg) {
                                        rs_add.receive_split_natamount = accept_amount
                                        rs_add.receive_split_original_amount = accept_original_amount
                                        rs_add.receive_split_subject_code = accept_item_code
                                        rs_add.receive_split_received_no = vouch_code
                                    }
                                    logger.error('accept_split', accept)
                                    logger.error('accept_split_entry', accept_entry)
                                    logger.error('accept_split_url', accept_url)
                                    logger.error('accept_split_param', accept_param)
                                    await axios.post(accept_url, accept_param).then(async response => {
                                        logger.error('accept_split_response', response.data)
                                        let data = response.data
                                        if(data) {
                                            if(data.errcode === '0') {
                                                if(split_flg) {
                                                    rs_add.receive_split_u8_id = data.id
                                                    rs_add.receive_split_trade_id = data.tradeid
                                                    rs_add.receive_split_u8_biz_id = biz_id
                                                    await rs_add.save()

                                                    rd.received_no = vouch_code
                                                    rd.accept_u8_id = data.id
                                                    rd.accept_trade_id = data.tradeid
                                                    rd.accept_u8_biz_id = biz_id
                                                    rd.accept_at = new Date()
                                                    await rd.save()
                                                } else {
                                                    rd.received_no = vouch_code
                                                    rd.accept_u8_id = data.id
                                                    rd.accept_trade_id = data.tradeid
                                                    rd.accept_u8_biz_id = biz_id
                                                    rd.ought_received_digest = rl.received_digest
                                                    rd.accept_at = new Date()
                                                    await rd.save()

                                                    if(rl.receive_detail && rl.receive_detail.length > 0) {
                                                        for(let d of rl.receive_detail) {
                                                            let rdd = await tb_ought_receive_detail.findOne({
                                                                where: {
                                                                    ought_receive_detail_id: d.ought_receive_detail_id,
                                                                    state: GLBConfig.ENABLE
                                                                }
                                                            })
                                                            if(rdd) {
                                                                rdd.ought_received_detail_code = d.received_fee_code
                                                                rdd.ought_received_detail_digest = d.received_fee_digest
                                                                await rdd.save()
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                errMessage.push(srl.ought_receive_no + 'send error: ' + data.errmsg)
                                            }
                                        } else {
                                            errMessage.push(srl.ought_receive_no + 'send error: no return')
                                        }
                                    }).catch(function (error) {
                                        logger.error('accept_split_error', error)
                                        errMessage.push(srl.ought_receive_no + 'send error: ' + error)
                                    })
                                }
                            }
                        } else {
                            errMessage.push(srl.ought_receive_no + 'split detail may not exist or may have been deleted ')
                        }
                    }else {
                        errMessage.push(srl.ought_receive_no + 'may not exist or may have been deleted ')
                    }
                }
            } catch(err) {
                console.error(err)
            }
        } else {
            errMessage.push('U8 system api token not exist')
        }
    }
    if(errMessage && errMessage.length > 0) {
        returnData.code = '0'
        returnData.errMessage = errMessage.join(', ')
    } else {
        returnData.code = '1'
    }
    return common.success(returnData)
}

exports.syncU8ReceivableAct= async req => {
    let doc = common.docValidate(req), user = req.user
    let rl = doc.sync_data
    
    await this.getU8Token(false)
    let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
    if(token) {
        let ought_receive = ''
        let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.oughtreceive_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${rl.receipt_no}`
        console.log('get_url', get_url)
        await axios.get(get_url).then(async response => {
            logger.error(response.data)
            let data = response.data
            if(data) {
                if(data.errcode === '0') {
                    ought_receive = data.oughtreceive
                }
            }
        })
        if(ought_receive) {
            let opUser = await tb_user.findOne({
                where: {
                    user_id: user.user_id,
                    state: GLBConfig.ENABLE
                }
            })
            let rl_amount = await getReceiptAmount(rl.receipt_currency, rl.receipt_amount, rl.receipt_amount_rate)
            let receipt_amount = rl.receipt_amount
            let natamount = rl_amount.natamount
            let originalamount = rl_amount.originalamount
            let rl_add = await tb_ought_receive.create({
                ought_receive_receipt_file_id: rl.receipt_id,
                ought_receive_no: rl.receipt_no,
                ought_receive_type: rl.receipt_type,
                ought_receive_amount: receipt_amount,
                ought_receive_natamount: natamount,
                ought_receive_original_amount: originalamount,
                ought_receive_currency: rl.receipt_currency,
                ought_receive_bank: rl.receipt_bank,
                ought_receive_reference_no: rl.receipt_reference_no,
                ought_receive_object_id: rl.receipt_object_id,
                ought_receive_object: rl.receipt_object,
                ought_receive_carrier: rl.receipt_object_carrier,
                ought_receive_from_id: rl.receipt_from_id,
                ought_receive_from: rl.receipt_from,
                ought_receive_from_u8_code: rl.receipt_from_u8_code,
                ought_receive_from_u8_alias: rl.receipt_from_u8_alias,
                ought_receive_operator_id: opUser.user_id,
                ought_receive_operator_name: opUser.user_name,
                ought_receive_subject_code: rl.parent_code,
                ought_receive_u8_id: rl.receipt_no,
                ought_receive_balance_code: rl.receipt_check_cash,
                ought_receive_currency_rate: rl.receipt_amount_rate,
                ought_receive_digest: rl.receipt_digest
            })
            if(rl_add && rl.receipt_detail && rl.receipt_detail.length > 0) {
                for(let rd of rl.receipt_detail) {
                    let rd_amount = await getReceiptAmount('USD', rd.fee_amount, rl.receipt_amount_rate)
                    await tb_ought_receive_detail.create({
                        ought_receive_id: rl_add.ought_receive_id,
                        ought_receive_detail_code: rd.fee_code,
                        ought_receive_detail_fee_code: rd.fee_type,
                        ought_receive_detail_fee_name: rd.fee_name,
                        ought_receive_detail_amount: rd.fee_amount,
                        ought_receive_detail_natamount: rd_amount.natamount,
                        ought_receive_detail_original_amount: rd_amount.originalamount,
                        ought_receive_detail_digest: rd.fee_digest,
                    })
                }
            }
        } else {
            return common.error('u8_09')
        }
    } else {
        return common.error('u8_01')
    }
}


exports.getU8Token = async loginFlg => {
    if(!loginFlg) {
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            return token
        }
    }
    let token_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.token_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&app_secret=${GLBConfig.U8_CONFIG.app_secret}`
    logger.error('token_purl', token_url)
    await axios.get(token_url).then(async response => {
        logger.error(response.data)
        let data = response.data
        if(data) {
            if(data.errcode === '0') {
                let token = data.token
                if(token) {
                    await redisClient.set(GLBConfig.U8_CONFIG.token_name, token.id, GLBConfig.U8_CONFIG.token_expired)
                    logger.error('token.id', token.id)
                } else {
                    return common.error('u8_01')
                }
            } else {
                return common.error('u8_01')
            }
        } else {
            return common.error('u8_01')
        }
    })
    .catch(error => {
        console.error(error)
        return common.error('u8_01')
    })
}

exports.addFItem = async (receipt_no, customer_alias, bill_no) => {
    await this.getU8Token(false)
    let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
    let biz_id = await seq.genU8SystemSeq('BIZ')
    let item_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.fitem_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
    let fitem = {
        citemcode: receipt_no.replace(/\D/g, ''),
        citemname: customer_alias.toLowerCase() + '/' + bill_no.replace(/\D/g, ''),
        citemccode: '01',
        citemcname: '无分类',
        citem_class: '00',
        citem_name: '押金',
        bclose: false
    }
    let item_param = {
        fitem: fitem
    }
    logger.error('item_url', item_url)
    logger.error('item_param', item_param)
    let u8Item = ''
    await axios.post(item_url, item_param).then(async response => {
        logger.error('item_response', response.data)
        let data = response.data
        if(data) {
            logger.error('addFItem', data)
            if(data.errcode === '0') {
                u8Item = fitem
            }
        }
    }).catch(function (error) {
        logger.error('item_error', error)
    })
    return u8Item
}

exports.addSubFItem = async (reference_no) => {
    let regex = '/RPL\\s*([0-9]+)/i'
    let rollover_reference_no = common.valueFilter(reference_no, regex).trim()
    if(rollover_reference_no) {
        let queryStr = `select * from tbl_zhongtan_uploadfile where state = '1' AND api_name IN ('RECEIPT-RECEIPT', 'OVERDUE-RECEIPT', 'SHIPMENT-RECEIPT', 'MNR-RECEIPT', 'UNUSUAL RECEIPT', 'FIXED-RECEIPT') and uploadfile_receipt_no like ? order by uploadfile_id desc limit 1`
        let replacements = [ rollover_reference_no+'%' ]
        let receipt_files = await model.simpleSelect(queryStr, replacements)
        if(receipt_files && receipt_files.length === 1) {
            let receipt = receipt_files[0]

            let sub_receipt_no = receipt.uploadfile_receipt_no
            let sub_customer_alias = ''
            let sub_bill_no = ''

            let customer = await tb_user.findOne({
                where: {
                    user_name: receipt.receipt_from,
                    state: GLBConfig.ENABLE
                }
            })
            if(customer && customer.u8_alias) {
                sub_customer_alias = customer.u8_alias
            }
            if(receipt.api_name === 'RECEIPT-RECEIPT') {
                let bl = await tb_bl.findOne({
                    where: {
                      invoice_masterbi_id: r.uploadfile_index1,
                      state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    sub_bill_no = bl.invoice_masterbi_bl
                }
            } else if(receipt.api_name === 'OVERDUE-RECEIPT') {
                let bl = await tb_bl.findOne({
                    where: {
                      invoice_masterbi_id: receipt.uploadfile_index1,
                      state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    sub_bill_no = bl.invoice_masterbi_bl
                }
            } else if(r.api_name === 'SHIPMENT-RECEIPT') {
                let bl = await tb_export_bl.findOne({
                    where: {
                        export_masterbl_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(bl) {
                    sub_bill_no = bl.export_masterbl_bl
                }
            } else if(r.api_name === 'MNR-RECEIPT') {
                let mnr = await tb_mnr_ledger.findOne({
                    where: {
                        container_mnr_ledger_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(mnr) {
                    sub_bill_no = mnr.mnr_ledger_bl
                }
            } else if(r.api_name === 'UNUSUAL RECEIPT') {
                let unusual = await tb_unusual_invoice.findOne({
                    where: {
                        unusual_invoice_id: r.uploadfile_index1,
                        state: GLBConfig.ENABLE
                    }
                })
                if(unusual) {
                    sub_bill_no = unusual.unusual_invoice_bl
                }
            } else if(r.api_name === 'FIXED-RECEIPT') {
                sub_bill_no = 'fix deposit'
            }
            if(sub_receipt_no && sub_customer_alias && sub_bill_no) {
                let subItem = await this.addFItem(sub_receipt_no, sub_customer_alias, sub_bill_no)
                if(subItem) {
                    return subItem
                }
            }
        }
    }
    return null
}


checkCan2SendReceivable = async item =>  {
    let result = {
        code: false,
        message: ''
    }
    let receivable_message = []

    let opUser = await tb_user.findOne({
        where: {
            user_id: item.operator_id,
            state: GLBConfig.ENABLE
        }
    })
    if(opUser) {
        if(!opUser.u8_code) {
            receivable_message.push('operator u8 code do not exist')
        }
    } else {
        receivable_message.push('operator do not exist')
    }
    // U8客户编码和简称
    let customer = await tb_user.findOne({
        where: {
            user_name: item.receipt_from,
            state: GLBConfig.ENABLE
        }
    })
    if(customer) {
        item.receipt_from_id = customer.user_id
        if(customer.u8_code && customer.u8_alias) {
            item.receipt_from_u8_code = customer.u8_code
            item.receipt_from_u8_alias = customer.u8_alias
            item.receipt_digest = 'Receivable from ' + item.receipt_from_u8_alias + '/' + item.receipt_object
        } else {
            receivable_message.push('Customer u8 code do not exist.' )
        }
    } else {
        receivable_message.push('Customer do not exist.' )
    }

    // 费用科目
    if(item.receipt_detail && item.receipt_detail.length > 0) {
        for(let rd of item.receipt_detail) {
            if(item.receipt_type === 'MNR Receivable' || item.receipt_type === 'UNUSUAL Receivable' || item.receipt_type === 'Import Fixed') {
                if(item.receipt_type === 'MNR Receivable') {
                    if(item.receipt_object_carrier) {
                        let match_codes = await tb_match_code.findAll({
                            where: {
                                match_code_bill_type: 'oughtReceive',
                                match_code_carrier: item.receipt_object_carrier,
                                match_code_fee_name: rd.fee_name,
                                state: GLBConfig.ENABLE
                            }
                        })
                        if(match_codes && match_codes.length === 1) {
                            rd.fee_type = match_codes[0].match_code_fee_type
                            rd.fee_code = match_codes[0].finance_subject_code
                        } else {
                            receivable_message.push('Subject Code do not exist or repeat.' )
                        }
                    } else {
                        receivable_message.push('The order carrier do not exist.' )

                    }
                } else if(item.receipt_type === 'UNUSUAL Receivable' || item.receipt_type === 'Import Fixed') {
                    let match_codes = await tb_match_code.findAll({
                        where: {
                            match_code_bill_type: 'oughtReceive',
                            match_code_fee_name: rd.fee_name,
                            state: GLBConfig.ENABLE
                        }
                    })
                    if(match_codes && match_codes.length === 1) {
                        rd.fee_type = match_codes[0].match_code_fee_type
                        rd.fee_code = match_codes[0].finance_subject_code
                    } else {
                        receivable_message.push('Match Code do not exist or repeat.' )
                    }
                }
            } else {
                if(item.receipt_business) {
                    if(rd.fee_name) {
                        let match_codes = await tb_match_code.findAll({
                            where: {
                                match_code_bill_type: 'oughtReceive',
                                match_code_business: item.receipt_business,
                                match_code_carrier: item.receipt_object_carrier,
                                match_code_fee_name: rd.fee_name,
                                state: GLBConfig.ENABLE
                            }
                        })
                        if(match_codes && match_codes.length === 1) {
                            rd.fee_type = match_codes[0].match_code_fee_type
                            rd.fee_code = match_codes[0].finance_subject_code
                        } else {
                            receivable_message.push('Subject Code do not exist or repeat.' )
                        }
                    } else if(rd.fee_type) {
                        let match_codes = await tb_match_code.findAll({
                            where: {
                                match_code_bill_type: 'oughtReceive',
                                match_code_business: item.receipt_business,
                                match_code_carrier: item.receipt_object_carrier,
                                match_code_fee_type: rd.fee_type,
                                state: GLBConfig.ENABLE
                            }
                        })
                        if(match_codes && match_codes.length === 1) {
                            rd.fee_name = match_codes[0].match_code_fee_name
                            rd.fee_code = match_codes[0].finance_subject_code
                        } else {
                            receivable_message.push('Subject Code do not exist or repeat.' )
                        }
                    } else {
                        receivable_message.push('Subject Code do not exist.' )
                    }
                } else {
                    receivable_message.push('The order is neither an import nor an export.' )
                }
            }
            if(rd.fee_code) {
                let sc = await tb_subject_code.findOne({
                    where: {
                        subject_code: rd.fee_code,
                        state: GLBConfig.ENABLE
                    }
                })
                if(sc) {
                    if(sc.subject_code_digest) {
                        rd.fee_digest = sc.subject_code_digest
                        item.parent_code = sc.parent_code
                    } else if(rd.fee_type === 'DEPOSIT') {
                        rd.fee_digest = 'Receivable from ' + item.receipt_from_u8_alias + '/' + item.receipt_no
                        item.parent_code = sc.parent_code
                    } else {
                        receivable_message.push('Digest do not exist.' )
                    }
                } else {
                    receivable_message.push('Subject Code do not exist.' )
                }
            }
        }
    }
    if(receivable_message && receivable_message.length > 0) {
        result.message = receivable_message.join('\r\n')
    } else {
        result.code = true
    }
    return result
}

getReceiptAmount = async (currency, amount, rate) =>  {
    if(currency === 'USD') {
        let tzs_amount = new Decimal(amount).times(new Decimal(rate))
        return {
            natamount: new Decimal(amount).toNumber(),
            originalamount: new Decimal(tzs_amount).toNumber()
        }
    } else {
        let usd_amount = new Decimal(amount).div(new Decimal(rate)).toFixed(2, Decimal.ROUND_HALF_UP)
        return {
            natamount: new Decimal(usd_amount).toNumber(),
            originalamount: new Decimal(amount).toNumber()
        }
    }
}
