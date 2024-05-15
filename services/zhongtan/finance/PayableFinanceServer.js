
const _ = require('lodash')
const common = require('../../../util/CommonUtil')
const moment = require('moment')
const Decimal = require('decimal.js')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const axios = require('axios')
const redisClient = require('server-utils').redisClient
const logger = require('../../../app/logger').createLogger(__filename)
const seq = require('../../../util/Sequence')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_user = model.common_user
const tb_upload_file = model.zhongtan_uploadfile
const tb_finance_payable = model.zhongtan_finance_payable
const tb_finance_item = model.zhongtan_finance_item
const tb_payment_advice = model.zhongtan_payment_advice


exports.initAct = async req => {
    let returnData = {}
    queryStr = `SELECT payment_items_code, payment_items_name, payment_items_type FROM tbl_zhongtan_payment_items WHERE state = '1' and payment_items_type in ('1','2','3','4','5','9') ORDER BY payment_items_type, payment_items_code`
    replacements = []
    returnData.PAYMENT_ITEMS = await model.simpleSelect(queryStr, replacements)
    returnData.PAYMENT_VESSEL_TYPE = GLBConfig.PAYMENT_VESSEL_TYPE

    let VESSELS = []
    queryStr = `SELECT invoice_vessel_name AS vessel_name, invoice_vessel_voyage AS voyage, invoice_vessel_eta, invoice_vessel_ata, invoice_vessel_atd FROM tbl_zhongtan_invoice_vessel WHERE state = 1 AND invoice_vessel_name IS NOT NULL AND invoice_vessel_voyage IS NOT NULL AND invoice_vessel_name <> '' AND invoice_vessel_voyage <> '' GROUP BY invoice_vessel_name, invoice_vessel_voyage;`
    replacements = []
    let imVs = await model.simpleSelect(queryStr, replacements)
    if(imVs) {
        for(let i of imVs) {
            if(i.invoice_vessel_ata && moment(i.invoice_vessel_ata, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_ata
            } else if(i.invoice_vessel_eta && moment(i.invoice_vessel_eta, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_eta
            } else if(i.invoice_vessel_atd && moment(i.invoice_vessel_atd, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_atd
            }
            i.vessel_voyage = i.vessel_name +  '/' + i.voyage
            if(i.vessel_date) {
                VESSELS.push(i)
            }
        }
    }
    queryStr = `SELECT export_vessel_name AS vessel_name, export_vessel_voyage AS voyage, export_vessel_etd FROM tbl_zhongtan_export_vessel WHERE state = 1 AND export_vessel_name IS NOT NULL AND export_vessel_voyage IS NOT NULL AND export_vessel_name <> '' AND export_vessel_voyage <> '' AND STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') IS NOT NULL GROUP BY export_vessel_name, export_vessel_voyage;`
    replacements = []
    let exVs = await model.simpleSelect(queryStr, replacements)
    if(exVs) {
        for(let e of exVs) {
            let index = VESSELS.findIndex(item => item.vessel_name === e.vessel_name && item.voyage === e.voyage)
            if(index === -1) {
                if(e.export_vessel_etd && moment(e.export_vessel_etd, 'DD/MM/YYYY').isValid()) {
                    e.vessel_date = e.export_vessel_etd
                }
                e.vessel_voyage = e.vessel_name +  '/' + e.voyage
                VESSELS.push(e)
            }
        }
    }
    let INIT_VESSELS = []
    for(let iv of VESSELS) {
        INIT_VESSELS.push({
            vessel_voyage: iv.vessel_voyage,
            vessel_date: iv.vessel_date
        })
    }
    let SORT_VESSELS = _.reverse(_.sortBy(INIT_VESSELS, [function(o) {return moment(o.vessel_date, 'DD/MM/YYYY').format('YYYY-MM-DD')}]))
    returnData.VESSELS = SORT_VESSELS
    return common.success(returnData)
}

exports.queryPayableAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let queryStr = `SELECT pa.* from tbl_zhongtan_payment_advice pa left join tbl_zhongtan_payment_items pi on pa.payment_advice_items = pi.payment_items_code WHERE pa.state = 1 AND pi.payment_items_type in ('1','2','3','4','5','9') AND payment_advice_status = '2' AND payment_advice_id NOT IN (SELECT payment_advice_id FROM tbl_zhongtan_finance_payable WHERE state = '1')`
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.receipt_date && doc.search_data.receipt_date.length > 1 && doc.search_data.receipt_date[0]  && doc.search_data.receipt_date[1]) {
            let start_date = doc.search_data.receipt_date[0]
            let end_date = doc.search_data.receipt_date[1]
            queryStr += ` AND pa.created_at >= ? and pa.created_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.items_type) {
            queryStr += ` AND pa.payment_advice_items = ? `
            replacements.push(doc.search_data.items_type)
        }
        if(doc.search_data.inv_cntrl) {
            queryStr += ` AND pa.payment_advice_inv_cntrl like ? `
            replacements.push('%' + doc.search_data.inv_cntrl + '%')
        }
    }

    queryStr += ' ORDER BY payment_advice_id DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    let payables = []
    if(rows && rows.length > 0) {
        queryStr = `SELECT * FROM tbl_zhongtan_payment_items WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEMS = await model.simpleSelect(queryStr, replacements)

        queryStr = `SELECT * FROM tbl_common_user WHERE state = '1' AND user_type = ?`
        replacements = [GLBConfig.TYPE_CUSTOMER]
        let COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)
        

        queryStr = `SELECT * FROM tbl_zhongtan_payment_item_code WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEM_CODES = await model.simpleSelect(queryStr, replacements)

        queryStr = `SELECT * FROM tbl_zhongtan_payment_item_code_carrier WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEM_CODE_CARRIERS = await model.simpleSelect(queryStr, replacements)

        let VESSELS = []
        queryStr = `SELECT invoice_vessel_name AS vessel_name, invoice_vessel_voyage AS voyage, invoice_vessel_eta, invoice_vessel_ata, invoice_vessel_atd FROM tbl_zhongtan_invoice_vessel WHERE state = 1 AND invoice_vessel_name IS NOT NULL AND invoice_vessel_voyage IS NOT NULL AND invoice_vessel_name <> '' AND invoice_vessel_voyage <> '' GROUP BY invoice_vessel_name, invoice_vessel_voyage;`
        replacements = []
        let imVs = await model.simpleSelect(queryStr, replacements)
        if(imVs) {
          for(let i of imVs) {
            if(i.invoice_vessel_ata && moment(i.invoice_vessel_ata, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_ata
            } else if(i.invoice_vessel_eta && moment(i.invoice_vessel_eta, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_eta
            } else if(i.invoice_vessel_atd && moment(i.invoice_vessel_atd, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_atd
            }
            if(i.vessel_date) {
                VESSELS.push(i)
            }
          }
        }
        queryStr = `SELECT export_vessel_name AS vessel_name, export_vessel_voyage AS voyage, export_vessel_etd FROM tbl_zhongtan_export_vessel WHERE state = 1 AND export_vessel_name IS NOT NULL AND export_vessel_voyage IS NOT NULL AND export_vessel_name <> '' AND export_vessel_voyage <> '' AND STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') IS NOT NULL GROUP BY export_vessel_name, export_vessel_voyage;`
        replacements = []
        let exVs = await model.simpleSelect(queryStr, replacements)
        if(exVs) {
          for(let e of exVs) {
            let index = VESSELS.findIndex(item => item.vessel_name === e.vessel_name && item.voyage === e.voyage)
            if(index === -1) {
                if(e.export_vessel_etd && moment(e.export_vessel_etd, 'DD/MM/YYYY').isValid()) {
                    e.vessel_date = e.export_vessel_etd
                }
                VESSELS.push(e)
            }
          }
        }

        for(let r of rows) {
            let _disabled_message = []
            let item = JSON.parse(JSON.stringify(r))
            item._disabled_payable = true
            if(r.payment_advice_amount) {
                let amount = r.payment_advice_amount.replace(/,/g, '')
                if(amount) {
                    amount = amount.trim()
                }
                item.payment_advice_amount = new Decimal(amount).toNumber()
            }
            if(opUser && opUser.u8_code) {
                item.operator_u8_code = opUser.u8_code
            } else {
                _disabled_message.push('Payment operator not exist in U8 system.')
            }
            let i_i = _.find(PAYMENT_ITEMS, function(o) { return o.payment_items_code === r.payment_advice_items})
            if(i_i) {
                item.payment_advice_items_name = i_i.payment_items_name
                item.payment_advice_items_type = i_i.payment_items_type
            }
            let b_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_beneficiary})
            if(b_c) {
                item.payment_advice_beneficiary_name = b_c.user_name
                if(b_c.u8_vendor_code && b_c.u8_vendor_alias) {
                    item.payment_advice_beneficiary_u8_vendor_code = b_c.u8_vendor_code
                    item.payment_advice_beneficiary_u8_vendor_alias = b_c.u8_vendor_alias
                } else {
                    _disabled_message.push('Payment beneficiary vendor not exist in U8 system.')
                }
            } else {
                _disabled_message.push('Payment beneficiary not exist.')
            }
            let r_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_remarks})
            if(r_c) {
                item.payment_advice_remarks_name = r_c.user_name
                if(r_c.u8_vendor_code && r_c.u8_vendor_alias) {
                    item.payment_advice_remarks_u8_vendor_code = r_c.u8_vendor_code
                    item.payment_advice_remarks_u8_vendor_alias = r_c.u8_vendor_alias
                } else {
                    _disabled_message.push('Payment remarks vendor not exist in U8 system.')
                }
            }
            
            item.create_date = moment(r.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            let payment_file = await tb_upload_file.findOne({
                where: {
                    uploadfile_index1: item.payment_advice_id,
                    api_name: 'PAYMENT ADVICE',
                    state: GLBConfig.ENABLE
                }
            })
            if(payment_file) {
                item.payment_advice_file_id = payment_file.uploadfile_id
                item.payment_advice_file_url = payment_file.uploadfile_url
            }

            let carrier = _.find(PAYMENT_ITEM_CODE_CARRIERS, function(o) { return o.payment_item_code === item.payment_advice_items && o.item_code_carrier === item.payment_advice_remarks})
            if(carrier) {
                let code = _.find(PAYMENT_ITEM_CODES, function(o) { return o.item_code_id.toString() === carrier.item_code_id.toString() && o.payment_item_code === carrier.payment_item_code})
                if(code) {
                    item.item_code_payable_debit = code.item_code_payable_debit
                    item.item_code_payable_credit = code.item_code_payable_credit
                } else {
                    _disabled_message.push('Payment item subject code not exist.')
                }
            } else {
                let code = _.find(PAYMENT_ITEM_CODES, function(o) { return o.payment_item_code === item.payment_advice_items})
                if(code) {
                    item.item_code_payable_debit = code.item_code_payable_debit
                    item.item_code_payable_credit = code.item_code_payable_credit
                } else {
                    _disabled_message.push('Payment item subject code not exist.')
                }
            }
            let carrier_dr_spe = _.find(PAYMENT_ITEM_CODE_CARRIERS, function(o) { return o.item_code_id === 'payable-dr' && o.item_code_carrier === item.payment_advice_remarks})
            if(carrier_dr_spe) {
                item.item_code_payable_debit = carrier_dr_spe.payment_item_code
            }
            let carrier_cr_spe = _.find(PAYMENT_ITEM_CODE_CARRIERS, function(o) { return o.item_code_id === 'payable-cr' && o.item_code_carrier === item.payment_advice_remarks})
            if(carrier_cr_spe) {
                item.item_code_payable_credit = carrier_cr_spe.payment_item_code
            }

            if(item.payment_advice_items_type === '1' || item.payment_advice_items_type === '2' || item.payment_advice_items_type === '5' || item.item_code_payable_debit === '224103') {
                if(r.payment_advice_vessel && r.payment_advice_voyage) {
                    let v_y = _.find(VESSELS, function(o) { return o.vessel_name === r.payment_advice_vessel && o.voyage === r.payment_advice_voyage })
                    if(v_y) {
                        item.payment_advice_vessel_date = v_y.vessel_date
                    } else {
                        _disabled_message.push('Payment vessel not exist.')
                    }
                } else {
                    _disabled_message.push('Payment vessel not exist.')
                }
            }

            if(_disabled_message.length > 0) {
                item._disabled_message = _disabled_message.join('\r\n')
            } else {
                item._disabled_payable = false
            }
            payables.push(item)
        }
    }
    returnData.rows = payables
    return common.success(returnData)
}

exports.submitPayableAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let errMessage = []
    if(doc.payable_list) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        logger.error('token', token)
        if(token) {
            for(let pl of doc.payable_list) {
                try {
                    let biz_id = await seq.genU8SystemSeq('BIZ')
                    let payable_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.oughtpay_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                    let send_date = moment(pl.create_date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD')
                    let amount = new Decimal(pl.payment_advice_amount).toNumber()
                    let natamount = new Decimal(pl.payment_advice_amount).toNumber()
                    let currency_name = '美元'
                    let currency_rate = 1
                    let digest = ''
                    let entry_digest = ''
                    let item = null
                    let cust_vendor_code = pl.payment_advice_beneficiary_u8_vendor_code
                    let entry_cust_vendor_code = pl.payment_advice_beneficiary_u8_vendor_code
                    if(pl.payment_advice_items_type === '1') {
                        digest = 'MV ' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage + ' ' + pl.payment_advice_items
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        let itemcode = moment(pl.payment_advice_vessel_date, 'DD/MM/YYYY').format('YYYYMMDD') + '-' + await seq.genU8SystemOneSeq()
                        let itemname = pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        let citemccode = '01'
                        let citemcname = 'CONTAINER VESSEL'
                        if(pl.payment_vessel_type && pl.payment_vessel_type === '2') {
                            // 散货
                            citemccode = '02'
                            citemcname = 'GENERAL VESSEL'
                        }
                        item = await this.addFItem(itemcode, itemname, citemccode, citemcname)
                        if(!item) {
                            errMessage.push(pl.payment_advice_no + 'send error: item create faied')
                            continue
                        }
                    } else if(pl.payment_advice_items_type === '2') {
                        digest = 'Payable for freight tax/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                    } else if(pl.payment_advice_items_type === '3') {
                        digest = 'Payable to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for ' + pl.payment_advice_items + '/' +  pl.payment_advice_inv_cntrl
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + ' for depot-' + pl.payment_advice_inv_cntrl
                    } else if(pl.payment_advice_items_type === '4') {
                        digest = 'Payable to ' + pl.payment_advice_beneficiary_u8_vendor_alias + '-' + amount
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + ' for logistic/' +  pl.payment_advice_inv_cntrl
                        let itemcode = moment().format('YYYY') + '-' + await seq.genU8SystemOneSeq()
                        let itemname = pl.payment_advice_inv_cntrl
                        let citemccode = '03'
                        let citemcname = 'LOGISTIC BL'
                        item = await this.addFItem(itemcode, itemname, citemccode, citemcname)
                        if(!item) {
                            errMessage.push(pl.payment_advice_no + 'send error: item create faied')
                            continue
                        }
                    } else if(pl.payment_advice_items_type === '5') { 
                        digest = 'Payable to ' + pl.payment_advice_beneficiary_u8_vendor_alias
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage

                        let itemcode = moment(pl.payment_advice_vessel_date, 'DD/MM/YYYY').format('YYYYMMDD') + '-' + await seq.genU8SystemOneSeq()
                        let itemname = pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        let citemccode = '01'
                        let citemcname = 'CONTAINER VESSEL'
                        if(pl.payment_vessel_type && pl.payment_vessel_type === '2') {
                            // 散货
                            citemccode = '02'
                            citemcname = 'GENERAL VESSEL'
                        }
                        item = await this.addFItem(itemcode, itemname, citemccode, citemcname)
                        if(!item) {
                            errMessage.push(pl.payment_advice_no + 'send error: item create faied')
                            continue
                        }
                    } else if(pl.payment_advice_items_type === '9') { 
                        digest = 'Payable to ' + pl.payment_advice_beneficiary_u8_vendor_alias
                        entry_digest = 'Receivable from ' + pl.payment_advice_remarks_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                    }
                    
                    if(pl.payment_advice_currency === 'TZS') {
                        let format_amount = await this.getNatAmount(pl.payment_advice_currency, pl.payment_advice_amount, pl.payment_advice_rate)
                        natamount = format_amount.natamount
                        currency_name = 'TZS'
                        currency_rate = new Decimal(pl.payment_advice_rate).toNumber()
                    }

                    let entryitem = {
                        cust_vendor_code: entry_cust_vendor_code,
                        bdebitcredit: 1,
                        subjectcode: pl.item_code_payable_debit, // 应付借
                        amount: amount,
                        natamount: natamount,
                        currency_name: currency_name,
                        currency_rate: currency_rate,
                        digest: entry_digest
                    }
                    if(pl.item_code_payable_debit === '224103') {
                        if(!item) {
                            let itemcode = moment(pl.payment_advice_vessel_date, 'DD/MM/YYYY').format('YYYYMMDD') + '-' + await seq.genU8SystemOneSeq()
                            let itemname = pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                            let citemccode = '01'
                            let citemcname = 'CONTAINER VESSEL'
                            if(pl.payment_vessel_type && pl.payment_vessel_type === '2') {
                                // 散货
                                citemccode = '02'
                                citemcname = 'GENERAL VESSEL'
                            }
                            item = await this.addFItem(itemcode, itemname, citemccode, citemcname)
                            if(!item) {
                                errMessage.push(pl.payment_advice_no + 'send error: item create faied')
                                continue
                            }
                        }
                        entryitem.item_classcode = '97'
                        entryitem.item_code = item.citemcode
                    } else if(item && (pl.payment_advice_items_type === '1' || pl.payment_advice_items_type === '4')) {
                        entryitem.item_classcode = '97'
                        entryitem.item_code = item.citemcode
                    }
                    let entry = []
                    entry.push(entryitem)
                    
                    let header_bdebitcredit = 0 // 单据类型（0蓝单1红单，默认为0）
                    if(new Decimal(amount).cmp(new Decimal(0)) < 0) {
                        header_bdebitcredit = 1
                        amount = new Decimal(amount).abs().toNumber()
                        natamount = new Decimal(natamount).abs().toNumber()
                    }
                    let oughtpay = {
                        code: pl.payment_advice_no,
                        date: send_date,
                        cust_vendor_code: cust_vendor_code,
                        bdebitcredit: header_bdebitcredit,
                        subjectcode: pl.item_code_payable_credit, // 应付贷
                        operator: opUser.u8_alias ? opUser.u8_alias : opUser.user_name,
                        amount: amount,
                        natamount: natamount,
                        currency_name: currency_name,
                        currency_rate: currency_rate,
                        digest: digest,
                        entry: entry
                    }
                    if(item && pl.payment_advice_items_type !== '4') {
                        oughtpay.item_classcode = '97'
                        oughtpay.item_code = item.citemcode
                    }
                    if(pl.item_code_payable_debit === '113106' || pl.item_code_payable_debit === '113108' || pl.item_code_payable_debit === '113107' || pl.item_code_payable_debit === '224103') {
                        oughtpay.define11 = pl.payment_advice_remarks_u8_vendor_alias
                    }
                    let payable_param = {
                        oughtpay: oughtpay
                    }

                    logger.error('payable_url' + biz_id, payable_url)
                    logger.error('entry' + biz_id, entry)
                    logger.error('oughtpay' + biz_id, oughtpay)
                    logger.error('payable_param' + biz_id, payable_param)
                    await axios.post(payable_url, payable_param).then(async response => {
                        logger.error('payable_response' + biz_id, response.data)
                        let data = response.data
                        if(data) {
                            if(data.errcode === '0') {
                                let finance_payable_item = null
                                let finance_payable_entry_item = null
                                if(pl.payment_advice_items_type === '1') {
                                    if(item) {
                                        finance_payable_item = item.citemcode
                                        finance_payable_entry_item = item.citemcode
                                    }
                                } else if(pl.payment_advice_items_type === '4' || pl.payment_advice_items_type === '5') {
                                    if(item) {
                                        finance_payable_entry_item = item.citemcode
                                    }
                                } 
                                await tb_finance_payable.create({
                                    payment_advice_id: pl.payment_advice_id,
                                    finance_payable_amount: amount,
                                    finance_payable_currency: pl.payment_advice_currency,
                                    finance_payable_natamount: natamount,
                                    finance_payable_original_amount: amount,
                                    finance_payable_rate: currency_rate,
                                    finance_payable_code: pl.item_code_payable_debit,
                                    finance_payable_entry_code: pl.item_code_payable_credit,
                                    finance_payable_order_no: pl.payment_advice_no,
                                    finance_payable_u8_id: data.id,
                                    finance_payable_u8_trade_id:  data.tradeid,
                                    finance_payable_item: finance_payable_item,
                                    finance_payable_entry_item: finance_payable_entry_item
                                })
                            } else {
                                // todo 发送失败
                                errMessage.push(pl.payment_advice_no + 'send error: ' + data.errmsg)
                            }
                        } else {
                            // todo 发送失败
                            errMessage.push(pl.payment_advice_no + 'send error: no return')
                        }
                    }).catch(function (error) {
                        logger.error('payable_error' + biz_id, error)
                        errMessage.push(pl.payment_advice_no + 'send error: ' + error)
                    })
                } catch(err) {
                    errMessage.push(pl.payment_advice_no + 'send error: ' + err)
                }
            }
        } else {
            return common.error('u8_01')
        }
    }
    if(errMessage.length > 0) {
        returnData.code = '0'
        returnData.errMessage = errMessage.join(', ')
    } else {
        returnData.code = '1'
    }
    return common.success(returnData)
}

exports.queryPaymentAct= async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let queryStr = `SELECT pa.*, fp.finance_payable_id, fp.finance_payable_u8_id, fp.finance_payable_u8_trade_id, fp.finance_payment_date from tbl_zhongtan_payment_advice pa right join tbl_zhongtan_finance_payable fp on pa.payment_advice_id = fp.payment_advice_id  WHERE pa.state = 1 AND fp.state = 1 AND pa.payment_advice_status = '2' AND fp.finance_payable_u8_id IS NOT NULL AND fp.finance_payment_u8_id IS NULL`
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.payable_date && doc.search_data.payable_date.length > 1 && doc.search_data.payable_date[0]  && doc.search_data.payable_date[1]) {
            let start_date = doc.search_data.payable_date[0]
            let end_date = doc.search_data.payable_date[1]
            queryStr += ` AND fp.created_at >= ? and fp.created_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.inv_cntrl) {
            queryStr += ` AND pa.payment_advice_inv_cntrl like ? `
            replacements.push('%' + doc.search_data.inv_cntrl + '%')
        }
    }

    queryStr += ' ORDER BY fp.created_at DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    let payables = []
    if(rows && rows.length > 0) {
        queryStr = `SELECT * FROM tbl_zhongtan_payment_items WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEMS = await model.simpleSelect(queryStr, replacements)

        queryStr = `SELECT * FROM tbl_common_user WHERE state = '1' AND user_type = ?`
        replacements = [GLBConfig.TYPE_CUSTOMER]
        let COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)
        

        queryStr = `SELECT * FROM tbl_zhongtan_payment_item_code WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEM_CODES = await model.simpleSelect(queryStr, replacements)

        let VESSELS = []
        queryStr = `SELECT invoice_vessel_name AS vessel_name, invoice_vessel_voyage AS voyage, invoice_vessel_eta, invoice_vessel_ata, invoice_vessel_atd FROM tbl_zhongtan_invoice_vessel WHERE state = 1 AND invoice_vessel_name IS NOT NULL AND invoice_vessel_voyage IS NOT NULL AND invoice_vessel_name <> '' AND invoice_vessel_voyage <> '' GROUP BY invoice_vessel_name, invoice_vessel_voyage;`
        replacements = []
        let imVs = await model.simpleSelect(queryStr, replacements)
        if(imVs) {
          for(let i of imVs) {
            if(i.invoice_vessel_ata && moment(i.invoice_vessel_ata, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_ata
            } else if(i.invoice_vessel_eta && moment(i.invoice_vessel_eta, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_eta
            } else if(i.invoice_vessel_atd && moment(i.invoice_vessel_atd, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_atd
            }
            if(i.vessel_date) {
                VESSELS.push(i)
            }
          }
        }
        queryStr = `SELECT export_vessel_name AS vessel_name, export_vessel_voyage AS voyage, export_vessel_etd FROM tbl_zhongtan_export_vessel WHERE state = 1 AND export_vessel_name IS NOT NULL AND export_vessel_voyage IS NOT NULL AND export_vessel_name <> '' AND export_vessel_voyage <> '' AND STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') IS NOT NULL GROUP BY export_vessel_name, export_vessel_voyage;`
        replacements = []
        let exVs = await model.simpleSelect(queryStr, replacements)
        if(exVs) {
          for(let e of exVs) {
            let index = VESSELS.findIndex(item => item.vessel_name === e.vessel_name && item.voyage === e.voyage)
            if(index === -1) {
                if(e.export_vessel_etd && moment(e.export_vessel_etd, 'DD/MM/YYYY').isValid()) {
                    e.vessel_date = e.export_vessel_etd
                }
                VESSELS.push(e)
            }
          }
        }

        for(let r of rows) {
            let _disabled_message = []
            let item = JSON.parse(JSON.stringify(r))
            item._disabled = true
            if(r.payment_advice_amount) {
                let amount = r.payment_advice_amount.replace(/,/g, '')
                if(amount) {
                    amount = amount.trim()
                }
                item.payment_advice_amount = new Decimal(amount).toNumber()
            }
            if(opUser && opUser.u8_code) {
                item.operator_u8_code = opUser.u8_code
            } else {
                _disabled_message.push('Payment operator not exist in U8 system.')
            }
            let i_i = _.find(PAYMENT_ITEMS, function(o) { return o.payment_items_code === r.payment_advice_items})
            if(i_i) {
                item.payment_advice_items_name = i_i.payment_items_name
                item.payment_advice_items_type = i_i.payment_items_type
            }
            let b_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_beneficiary})
            if(b_c) {
                item.payment_advice_beneficiary_name = b_c.user_name
                if(b_c.u8_vendor_code && b_c.u8_vendor_alias) {
                    item.payment_advice_beneficiary_u8_vendor_code = b_c.u8_vendor_code
                    item.payment_advice_beneficiary_u8_vendor_alias = b_c.u8_vendor_alias
                } else {
                    _disabled_message.push('Payment beneficiary vendor not exist in U8 system.')
                }
            } else {
                _disabled_message.push('Payment beneficiary not exist.')
            }
            let r_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_remarks})
            if(r_c) {
                item.payment_advice_remarks_name = r_c.user_name
                if(r_c.u8_vendor_code && r_c.u8_vendor_alias) {
                    item.payment_advice_remarks_u8_vendor_code = r_c.u8_vendor_code
                    item.payment_advice_remarks_u8_vendor_alias = r_c.u8_vendor_alias
                } else {
                    _disabled_message.push('Payment remarks vendor not exist in U8 system.')
                }
            }  else {
                _disabled_message.push('Payment remarks not exist.')
            }
            if(item.payment_advice_items_type === '1' || item.payment_advice_items_type === '2' || item.payment_advice_items_type === '5') {
                if(r.payment_advice_vessel && r.payment_advice_voyage) {
                    let v_y = _.find(VESSELS, function(o) { return o.vessel_name === r.payment_advice_vessel && o.voyage === r.payment_advice_voyage })
                    if(v_y) {
                        item.payment_advice_vessel_date = v_y.vessel_date
                    } else {
                        _disabled_message.push('Payment vessel not exist.')
                    }
                } else {
                    _disabled_message.push('Payment vessel not exist.')
                }
            }
            item.create_date = moment(r.created_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            if(r.finance_payment_date) {
                item.finance_payment_date = moment(r.finance_payment_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
            } else {
                item.finance_payment_date = moment(r.created_at, 'YYYY-MM-DD').format('YYYY-MM-DD')
            }
            let payment_file = await tb_upload_file.findOne({
                where: {
                    uploadfile_index1: item.payment_advice_id,
                    api_name: 'PAYMENT ADVICE',
                    state: GLBConfig.ENABLE
                }
            })
            if(payment_file) {
                item.payment_advice_file_id = payment_file.uploadfile_id
                item.payment_advice_file_url = payment_file.uploadfile_url
            }

            let code = _.find(PAYMENT_ITEM_CODES, function(o) { return o.payment_item_code === item.payment_advice_items && o.item_code_payment_debit})
            if(code) {
                item.item_code_payment_debit = code.item_code_payment_debit
            } else {
                _disabled_message.push('Payment item subject code not exist.')
            }
            if(_disabled_message.length > 0) {
                item._disabled_message = _disabled_message.join('\r\n')
            } else {
                item._disabled = false
            }
            payables.push(item)
        }
    }
    returnData.rows = payables
    return common.success(returnData)
}

exports.submitPaymentAct = async req => {
    let doc = common.docValidate(req), user = req.user
    let opUser = await tb_user.findOne({
        where: {
            user_id: user.user_id,
            state: GLBConfig.ENABLE
        }
    })
    let returnData = {}
    let errMessage = []
    if(doc.payment_list) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        logger.error('token', token)
        if(token) {
            for(let pl of doc.payment_list) {
                let fp = await tb_finance_payable.findOne({
                    where: {
                        payment_advice_id: pl.payment_advice_id,
                        state: GLBConfig.ENABLE
                    }
                })
                if(fp) {
                    try {
                        let biz_id = await seq.genU8SystemSeq('BIZ')
                        let vouch_code = fp.finance_payment_order_no
                        if(!vouch_code) {
                            vouch_code = await seq.genU8SystemSeq('PAID')
                            fp.finance_payment_order_no = vouch_code
                            await fp.save()
                        }
                        let payment_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.pay_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
                        let send_date = moment(pl.finance_payment_date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD')
                        let send_date_m = moment(pl.finance_payment_date, 'YYYY-MM-DD hh:mm:ss').format('M')
                        let amount = new Decimal(pl.payment_advice_amount).toNumber()
                        let original_amount = new Decimal(pl.payment_advice_amount).toNumber()
                        let currency_name = 'USD'
                        let currency_rate = 1
                        let digest = ''
                        let entry_digest = ''
                        if(pl.payment_advice_items_type === '1') {
                            digest = 'MV ' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage + ' ' + pl.payment_advice_items + '/' + pl.payment_advice_inv_cntrl
                            entry_digest = 'MV ' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage + ' ' + pl.payment_advice_items
                        } else if(pl.payment_advice_items_type === '2') {
                            digest = 'Paid for freight tax/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                            entry_digest = 'Paid for freight tax/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        } else if(pl.payment_advice_items_type === '3') {
                            digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for depot'
                            entry_digest = 'Payable to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for ' + pl.payment_advice_inv_cntrl
                        } else if(pl.payment_advice_items_type === '4') {
                            digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for logistic'
                            entry_digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + '-' + pl.payment_advice_inv_cntrl
                        } else if(pl.payment_advice_items_type === '5') { 
                            digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for Stv.'
                            entry_digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        } else if(pl.payment_advice_items_type === '9') { 
                            digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + ' for Stv.'
                            entry_digest = 'Paid to ' + pl.payment_advice_beneficiary_u8_vendor_alias + '/' + pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                        }
                        if(pl.payment_advice_currency === 'TZS') {
                            let format_amount = await this.getNatAmount(pl.payment_advice_currency, pl.payment_advice_amount, pl.payment_advice_rate)
                            amount = format_amount.natamount
                            original_amount = format_amount.originalamount
                            currency_name = 'TZS'
                            currency_rate = new Decimal(pl.payment_advice_rate).toNumber()
                        }
                        let header_vouchtype = '49' // 单据类型(48=收款单;49=付款单)
                        if(new Decimal(amount).cmp(new Decimal(0)) < 0) {
                            header_vouchtype = '48'
                            amount = new Decimal(amount).abs().toNumber()
                            original_amount = new Decimal(original_amount).abs().toNumber()
                        }
                        let entryitem = {
                            customercode: pl.payment_advice_beneficiary_u8_vendor_code,
                            itemcode: pl.item_code_payment_debit, // 付款借
                            amount: amount,
                            originalamount: original_amount,
                            foreigncurrency: currency_name,
                            currencyrate: currency_rate,
                            cmemo: entry_digest
                        }

                        if(pl.payment_advice_items_type === '1') {
                            if(pl.finance_payable_item) {
                                entryitem.projectclass = '97'
                                entryitem.project = pl.finance_payable_item
                            } else {
                                let itemcode = moment(pl.payment_advice_vessel_date, 'DD/MM/YYYY').format('YYYYMMDD') + '-' + await seq.genU8SystemOneSeq()
                                let itemname = pl.payment_advice_vessel + ' ' + pl.payment_advice_voyage
                                let citemccode = '01'
                                let citemcname = 'CONTAINER VESSEL'
                                if(pl.payment_vessel_type && pl.payment_vessel_type === '2') {
                                    // 散货
                                    citemccode = '02'
                                    citemcname = 'GENERAL VESSEL'
                                }
                                let new_item = await this.addFItem(itemcode, itemname, citemccode, citemcname)
                                if(!new_item) {
                                    errMessage.push(pl.payment_advice_no + 'send error: item create faied')
                                    continue
                                } else {
                                    entryitem.projectclass = '97'
                                    entryitem.project = new_item.citemcode
                                }
                            }
                        }

                        let entry = []
                        entry.push(entryitem)

                        let balancecode = '1'
                        if(pl.payment_advice_method === 'CHEQUE') {
                            balancecode = '2'
                        } else if(pl.payment_advice_method === 'CASH') {
                            balancecode = '3'
                        } 
                        let pay = {
                            vouchcode: vouch_code,
                            vouchdate: send_date,
                            period: send_date_m, // 单据日期 月份
                            vouchtype: header_vouchtype,
                            customercode: pl.payment_advice_beneficiary_u8_vendor_code,
                            balancecode: balancecode,
                            balanceitemcode: '100299',
                            operator: opUser.u8_alias ? opUser.u8_alias : opUser.user_name,
                            amount: amount,
                            originalamount: original_amount,
                            foreigncurrency: currency_name,
                            currencyrate: currency_rate,
                            digest: digest,
                            entry: entry
                        }
                        let payment_param = {
                            pay: pay
                        }
                        logger.error('payment_url' + biz_id,  payment_url)
                        logger.error('entry' + biz_id, entry)
                        logger.error('pay' + biz_id, pay)
                        logger.error('payment_param' + biz_id, payment_param)
                        await axios.post(payment_url, payment_param).then(async response => {
                            logger.error('payment_response' + biz_id, response.data)
                            let data = response.data
                            if(data) {
                                if(data.errcode === '0') {
                                    fp.finance_payment_u8_id = data.id
                                    fp.finance_payment_u8_trade_id = data.tradeid
                                    if(pay.itemcode) {
                                        fp.finance_payment_item = pay.itemcode
                                    }
                                    fp.finance_payment_at = new Date()
                                    await fp.save()
                                } else {
                                    // todo 发送失败
                                    errMessage.push(pl.payment_advice_no + 'send error: ' + data.errmsg)
                                }
                            } else {
                                // todo 发送失败
                                errMessage.push(pl.payment_advice_no + 'send error: no return')
                            }
                        }).catch(function (error) {
                            logger.error('payment_error' + biz_id, error)
                            errMessage.push(pl.payment_advice_no + 'send error: ' + error)
                        })
                    } catch(err) {
                        errMessage.push(pl.payment_advice_no + 'send error: ' + err)
                    }
                } else {
                    errMessage.push(pl.payment_advice_no + 'may not exist or may have been deleted ')
                }
            }
        } else {
            errMessage.push('U8 system api token not exist')
        }
    }
    if(errMessage.length > 0) {
        returnData.code = '0'
        returnData.errMessage = errMessage.join(', ')
    } else {
        returnData.code = '1'
    }
    return common.success(returnData)
}

exports.watchU8PayableAct = async req => {
    let doc = common.docValidate(req)
    let fp = await tb_finance_payable.findOne({
        where: {
            finance_payable_id: doc.finance_payable_id,
            state: GLBConfig.ENABLE
        }
    })
    let ought_pay = ''
    if(fp && fp.finance_payable_u8_id) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.oughtpay_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${fp.finance_payable_u8_id}`
            logger.error('watchU8PayableAct', get_url)
            await axios.get(get_url).then(async response => {
                logger.error(response.data)
                let data = response.data
                if(data) {
                    if(data.errcode === '0') {
                        ought_pay = data.oughtpay
                    }
                }
            })
        }
    }
    if(ought_pay) {
        return common.success(ought_pay)
    } else {
        return common.error('u8_02')
    }
}

exports.queryCompleteAct = async req => {
    let doc = common.docValidate(req)
    let returnData = {}
    let queryStr = `SELECT pa.*, fp.finance_payable_id, fp.finance_payable_u8_id, fp.finance_payable_u8_trade_id, fp.finance_payment_u8_id, fp.finance_payment_u8_trade_id, fp.created_at AS finance_payable_at, fp.finance_payment_at from tbl_zhongtan_payment_advice pa right join tbl_zhongtan_finance_payable fp on pa.payment_advice_id = fp.payment_advice_id  WHERE pa.state = 1 AND fp.state = 1 AND pa.payment_advice_status = '2' AND fp.finance_payable_u8_id IS NOT NULL AND fp.finance_payment_u8_id IS NOT NULL`
    let replacements = []
    if(doc.search_data) {
        if(doc.search_data.payable_date && doc.search_data.payable_date.length > 1 && doc.search_data.payable_date[0]  && doc.search_data.payable_date[1]) {
            let start_date = doc.search_data.payable_date[0]
            let end_date = doc.search_data.payable_date[1]
            queryStr += ` AND fp.created_at >= ? and fp.created_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.payment_date && doc.search_data.payment_date.length > 1 && doc.search_data.payment_date[0]  && doc.search_data.payment_date[1]) {
            let start_date = doc.search_data.payment_date[0]
            let end_date = doc.search_data.payment_date[1]
            queryStr += ` AND fp.finance_payment_at >= ? and fp.finance_payment_at < ? `
            replacements.push(start_date)
            replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
        }
        if(doc.search_data.inv_cntrl) {
            queryStr += ` AND pa.payment_advice_inv_cntrl like ? `
            replacements.push('%' + doc.search_data.inv_cntrl + '%')
        }
    }

    queryStr += ' ORDER BY fp.finance_payment_at DESC'
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.total = result.count
    let rows = result.data
    let payables = []
    if(rows && rows.length > 0) {
        queryStr = `SELECT * FROM tbl_zhongtan_payment_items WHERE state = '1'`
        replacements = []
        let PAYMENT_ITEMS = await model.simpleSelect(queryStr, replacements)

        queryStr = `SELECT * FROM tbl_common_user WHERE state = '1' AND user_type = ?`
        replacements = [GLBConfig.TYPE_CUSTOMER]
        let COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)

        let VESSELS = []
        queryStr = `SELECT invoice_vessel_name AS vessel_name, invoice_vessel_voyage AS voyage, invoice_vessel_eta, invoice_vessel_ata, invoice_vessel_atd FROM tbl_zhongtan_invoice_vessel WHERE state = 1 AND invoice_vessel_name IS NOT NULL AND invoice_vessel_voyage IS NOT NULL AND invoice_vessel_name <> '' AND invoice_vessel_voyage <> '' GROUP BY invoice_vessel_name, invoice_vessel_voyage;`
        replacements = []
        let imVs = await model.simpleSelect(queryStr, replacements)
        if(imVs) {
          for(let i of imVs) {
            if(i.invoice_vessel_ata && moment(i.invoice_vessel_ata, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_ata
            } else if(i.invoice_vessel_eta && moment(i.invoice_vessel_eta, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_eta
            } else if(i.invoice_vessel_atd && moment(i.invoice_vessel_atd, 'DD/MM/YYYY').isValid()) {
                i.vessel_date = i.invoice_vessel_atd
            }
            if(i.vessel_date) {
                VESSELS.push(i)
            }
          }
        }
        queryStr = `SELECT export_vessel_name AS vessel_name, export_vessel_voyage AS voyage, export_vessel_etd FROM tbl_zhongtan_export_vessel WHERE state = 1 AND export_vessel_name IS NOT NULL AND export_vessel_voyage IS NOT NULL AND export_vessel_name <> '' AND export_vessel_voyage <> '' AND STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') IS NOT NULL GROUP BY export_vessel_name, export_vessel_voyage;`
        replacements = []
        let exVs = await model.simpleSelect(queryStr, replacements)
        if(exVs) {
          for(let e of exVs) {
            let index = VESSELS.findIndex(item => item.vessel_name === e.vessel_name && item.voyage === e.voyage)
            if(index === -1) {
                if(e.export_vessel_etd && moment(e.export_vessel_etd, 'DD/MM/YYYY').isValid()) {
                    e.vessel_date = e.export_vessel_etd
                }
                VESSELS.push(e)
            }
          }
        }

        for(let r of rows) {
            let _disabled_message = []
            let item = JSON.parse(JSON.stringify(r))
            if(r.payment_advice_amount) {
                let amount = r.payment_advice_amount.replace(/,/g, '')
                if(amount) {
                    amount = amount.trim()
                }
                item.payment_advice_amount = new Decimal(amount).toNumber()
            }
            let i_i = _.find(PAYMENT_ITEMS, function(o) { return o.payment_items_code === r.payment_advice_items})
            if(i_i) {
                item.payment_advice_items_name = i_i.payment_items_name
                item.payment_advice_items_type = i_i.payment_items_type
            }
            let b_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_beneficiary})
            if(b_c) {
                item.payment_advice_beneficiary_name = b_c.user_name
                if(b_c.u8_code && b_c.u8_alias) {
                    item.payment_advice_beneficiary_u8_customerr_code = b_c.u8_code
                    item.payment_advice_beneficiary_u8_customer_alias = b_c.u8_alias
                }
            }
            let r_c = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === r.payment_advice_remarks})
            if(r_c) {
                item.payment_advice_remarks_name = r_c.user_name
                if(r_c.u8_vendor_code && r_c.u8_vendor_alias) {
                    item.payment_advice_remarks_u8_vendor_code = r_c.u8_vendor_code
                    item.payment_advice_remarks_u8_vendor_alias = r_c.u8_vendor_alias
                }
            }
            if(item.payment_advice_items_type === '1' || item.payment_advice_items_type === '2' || item.payment_advice_items_type === '5') {
                if(r.payment_advice_vessel && r.payment_advice_voyage) {
                    let v_y = _.find(VESSELS, function(o) { return o.vessel_name === r.payment_advice_vessel && o.voyage === r.payment_advice_voyage })
                    if(v_y) {
                        item.payment_advice_vessel_date = v_y.vessel_date
                    }
                }
            }
            item.finance_payable_at = moment(r.finance_payable_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            item.finance_payment_at = moment(r.finance_payment_at, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD hh:mm:ss')
            let payment_file = await tb_upload_file.findOne({
                where: {
                    uploadfile_index1: item.payment_advice_id,
                    api_name: 'PAYMENT ADVICE',
                    state: GLBConfig.ENABLE
                }
            })
            if(payment_file) {
                item.payment_advice_file_id = payment_file.uploadfile_id
                item.payment_advice_file_url = payment_file.uploadfile_url
            }
            item.finance_payment_documnet_no = r.finance_payment_u8_id
            payables.push(item)
        }
    }
    returnData.rows = payables
    return common.success(returnData)
}

exports.watchPaymentAct = async req => {
    let doc = common.docValidate(req)
    let fp = await tb_finance_payable.findOne({
        where: {
            finance_payable_id: doc.finance_payable_id,
            state: GLBConfig.ENABLE
        }
    })
    let ought_paid = ''
    if(fp && fp.finance_payment_u8_id) {
        await this.getU8Token(false)
        let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
        if(token) {
            let get_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.pay_get_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&id=${fp.finance_payment_u8_id}`
            logger.error('watchPaymentAct', get_url)
            await axios.get(get_url).then(async response => {
                logger.error(response.data)
                let data = response.data
                if(data) {
                    if(data.errcode === '0') {
                        ought_paid = data.pay
                    }
                }
            })
        }
    }
    if(ought_paid) {
        return common.success(ought_paid)
    } else {
        return common.error('u8_02')
    }
}

exports.submitPayableVesselInfoAct = async req => {
    let doc = common.docValidate(req)
    if(doc.payable_list) {
        let submit_data = doc.submit_data
        if(submit_data.payable_vessel_info || submit_data.payable_vessel_type) {
            for(let pl of doc.payable_list) {
                let pa = await tb_payment_advice.findOne({
                    where: {
                        payment_advice_id: pl.payment_advice_id,
                        state: GLBConfig.ENABLE
                    }
                })
                if(pa) {
                    if(submit_data.payable_vessel_info && submit_data.payable_vessel_info.indexOf('/') >= 0) {
                        let vessels = submit_data.payable_vessel_info.split('/')
                        if(vessels && vessels.length === 2) {
                            pa.payment_advice_vessel = vessels[0]
                            pa.payment_advice_voyage = vessels[1]
                        }
                    }
                    if(submit_data.payable_vessel_type) {
                        pa.payment_vessel_type = submit_data.payable_vessel_type
                    }
                    await pa.save()
                }
            }
        }
    }
    return common.success()
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

exports.removePayableAct = async req => {
    let doc = common.docValidate(req)
    let fp = await tb_finance_payable.findOne({
        where: {
            payment_advice_id: doc.payment_advice_id,
            state: GLBConfig.ENABLE
        }
    })
    if(fp) {
        fp.state = GLBConfig.DISABLE
        await fp.save()
    }
    return common.success()
}

exports.removePaymentAct = async req => {
    let doc = common.docValidate(req)
    let fp = await tb_finance_payable.findOne({
        where: {
            payment_advice_id: doc.payment_advice_id,
            state: GLBConfig.ENABLE
        }
    })
    if(fp) {
        fp.finance_payment_order_no = null
        fp.finance_payment_u8_id = null
        await fp.save()
    }
    return common.success()
}

exports.submitPaymentInfoAct = async req => {
    let doc = common.docValidate(req)
    if(doc.payment_list) {
        let submit_data = doc.submit_data
        if(submit_data.finance_payment_date) {
            for(let pl of doc.payment_list) {
                let fp = await tb_finance_payable.findOne({
                    where: {
                        finance_payable_id: pl.finance_payable_id,
                        state: GLBConfig.ENABLE
                    }
                })
                if(fp) {
                    fp.finance_payment_date = submit_data.finance_payment_date
                    await fp.save()
                }
            }
        }
    }
    return common.success()
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

exports.addFItem = async (code, name, citemccode, citemcname) => {
    
    let dbItem = await tb_finance_item.findOne({
        where: {
            finance_item_type: 'payable',
            finance_item_name: name,
            state: GLBConfig.ENABLE
        }
    })
    if(dbItem) {
        return {
            citemcode: dbItem.finance_item_code,
            citemname: dbItem.finance_item_name,
            citemccode: dbItem.finance_item_ccode,
            citemcname: dbItem.finance_item_cname,
            citem_class: '97',
            citem_name: '项目管理',
            bclose: false
        }
    }
    
    await this.getU8Token(false)
    let token = await redisClient.get(GLBConfig.U8_CONFIG.token_name)
    let biz_id = await seq.genU8SystemSeq('BIZ')
    let item_url = GLBConfig.U8_CONFIG.host + GLBConfig.U8_CONFIG.fitem_add_api_url + `?from_account=${GLBConfig.U8_CONFIG.from_account}&to_account=${GLBConfig.U8_CONFIG.to_account}&app_key=${GLBConfig.U8_CONFIG.app_key}&token=${token}&biz_id=${biz_id}&sync=1` 
    let fitem = {
        citemcode: code,
        citemname: name,
        citemccode: citemccode,
        citemcname: citemcname,
        citem_class: '97',
        citem_name: '项目管理',
        bclose: false
    }
    let item_param = {
        fitem: fitem
    }
    logger.error('item_url' + biz_id, item_url)
    logger.error('item_param' + biz_id, item_param)
    let u8Item = ''
    await axios.post(item_url, item_param).then(async response => {
        logger.error('item_response' + biz_id, response.data)
        let data = response.data
        if(data) {
            if(data.errcode === '0') {
                u8Item = fitem
                await tb_finance_item.create({
                    finance_item_type: 'payable',
                    finance_item_code: code,
                    finance_item_name: name,
                    finance_item_ccode: citemccode,
                    finance_item_cname: citemcname,
                    finance_item_calss_code: '97',
                    finance_item_calss_name: '项目管理',
                })
            }
        }
    }).catch(function (error) {
        logger.error('item_error' + biz_id, error)
    })
    return u8Item
}

exports.getNatAmount = async (currency, amount, rate) =>  {
    if(currency === 'USD') {
        let tzs_amount = new Decimal(amount).times(new Decimal(rate))
        return {
            natamount: new Decimal(amount),
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
