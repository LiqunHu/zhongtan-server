const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const numberToText = require('number2text')

const tb_verification = model.zhongtan_payment_verification
const tb_payment_advice = model.zhongtan_payment_advice
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_items = model.zhongtan_payment_items
const tb_user = model.common_user

exports.initAct = async () => {
  let returnData = {
    PAYMENT_VERIFICATION_STATE: GLBConfig.PAYMENT_VERIFICATION_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select pv.payment_verification_id, pv.payment_verification_state, pv.payment_advice_id, pa.*, cu.user_name AS payment_verification_create_user_name, cb.user_name as payment_advice_beneficiary_name, cr.user_name as payment_advice_remarks_name, pi.payment_items_name as payment_advice_items_name 
                  from tbl_zhongtan_payment_verification pv
                  LEFT JOIN tbl_zhongtan_payment_advice pa ON pv.payment_advice_id = pa.payment_advice_id AND pa.state = '1' 
                  LEFT JOIN tbl_common_user cu ON pv.payment_verification_create_user = cu.user_id AND pa.state = '1' 
                  left join tbl_common_user cb on pa.payment_advice_beneficiary = cb.user_id 
                  left join tbl_common_user cr on pa.payment_advice_remarks = cr.user_id
                  left join tbl_zhongtan_payment_items pi on pa.payment_advice_items = pi.payment_items_code
                  where pv.state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if (doc.search_data.verification_state) {
      queryStr += ' AND pv.payment_verification_state = ?'
      replacements.push(doc.search_data.verification_state)
    }
    
    if (doc.search_data.date && doc.search_data.date.length > 1 && doc.search_data.date[0] && doc.search_data.date[1]) {
      queryStr += ' and pv.created_at >= ? and pv.created_at < ? '
      replacements.push(doc.search_data.date[0])
      replacements.push(moment(doc.search_data.date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  }
  queryStr = queryStr + " order by pv.payment_verification_id desc "
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      let dd = JSON.parse(JSON.stringify(d))
      dd.created_at = moment(d.created_at).format('YYYY-MM-DD HH:mm:ss')
      rows.push(dd)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
    let ver = await tb_verification.findOne({
      where: {
        payment_verification_id: doc.payment_verification_id,
        state: GLBConfig.ENABLE
      }
    })
  if(ver) {
    ver.payment_verification_state = 'AP'
    ver.payment_verification_manager_user = user.user_id
    ver.payment_verification_manager_time = curDate
    

    let advice = await tb_payment_advice.findOne({
      where: {
        payment_advice_id: ver.payment_advice_id
      }
    })

    if(advice) {
      let advice_no = await seq.genPaymentAdviceSeq()
      advice.payment_advice_status = '2'
      advice.payment_advice_no = advice_no

      let items = await tb_payment_items.findOne({
        attributes: ['payment_items_code', 'payment_items_name'],
        where: {
          payment_items_code: advice.payment_advice_items
        }
      })
      let beneficiary = await tb_user.findOne({
        attributes: ['user_id', 'user_name'],
        where: {
          user_id: advice.payment_advice_beneficiary
        }
      })

      let remarks = await tb_user.findOne({
        attributes: ['user_id', 'user_name'],
        where: {
          user_id: advice.payment_advice_remarks
        }
      })

      let created = await tb_user.findOne({
        attributes: ['user_id', 'user_name'],
        where: {
          user_id: ver.payment_verification_create_user
        }
      })

      let checked = await tb_user.findOne({
        attributes: ['user_id', 'user_name'],
        where: {
          user_id: ver.payment_verification_business_user
        }
      })

      let approved = await tb_user.findOne({
        attributes: ['user_id', 'user_name'],
        where: {
          user_id: ver.payment_verification_manager_user
        }
      })

      // 生成支付单
      let renderData = {}
      renderData.payment_advice_no = advice_no
      renderData.payment_advice_method = advice.payment_advice_method
      renderData.payment_advice_items_name = items ? items.payment_items_name : ''
      renderData.payment_advice_inv_cntrl = advice.payment_advice_inv_cntrl
      renderData.payment_advice_beneficiary_name = beneficiary ? beneficiary.user_name : ''
      renderData.payment_advice_bank_account = advice.payment_advice_bank_account
      renderData.payment_advice_currency = advice.payment_advice_currency
      renderData.payment_advice_amount = formatCurrency(advice.payment_advice_amount)
      renderData.payment_advice_amount_str = numberToText(advice.payment_advice_amount)
      renderData.payment_advice_remarks_name = remarks ? remarks.user_name : ''
      renderData.payment_advice_prepared_user = created ? created.user_name : ''
      renderData.payment_advice_prepared_date = moment(ver.created_at).format('YYYY/MM/DD')
      renderData.payment_advice_checked_user = checked ? checked.user_name : ''
      renderData.payment_advice_checked_date = moment(ver.payment_verification_business_time).format('YYYY/MM/DD')
      renderData.payment_advice_approved_user = approved ? approved.user_name : ''
      renderData.payment_advice_approved_date = moment(ver.payment_verification_manager_time).format('YYYY/MM/DD')
      let fileInfo = await common.ejs2Pdf('paymentAdvice.ejs', renderData, 'zhongtan')
      await advice.save()

      await tb_uploadfile.create({
        api_name: 'PAYMENT ADVICE',
        user_id: user.user_id,
        uploadfile_index1: advice.payment_advice_id,
        uploadfile_index3: ver.payment_verification_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_acttype: 'advice',
        uploadfile_amount: advice.payment_advice_amount,
        uploadfile_currency: advice.payment_advice_currency,
        uploadfile_received_from: beneficiary ? beneficiary.user_name : '',
        uploadfile_customer_id: advice.payment_advice_beneficiary,
        uploadfile_invoice_no: advice_no,
        uploadfil_release_date: curDate,
        uploadfil_release_user_id: user.user_id
      })
    }
    await ver.save()
   }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verification.findOne({
    where: {
      payment_verification_id: doc.payment_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.payment_verification_state = 'MD'
    ver.payment_verification_manager_user = user.user_id
    ver.payment_verification_manager_time = curDate
    await ver.save()
  }
  return common.success()
}

function formatCurrency(num) {
  num = num.toString().replace(/[^\d.-]/g, '') //转成字符串并去掉其中除数字, . 和 - 之外的其它字符。
  if (isNaN(num)) num = '0' //是否非数字值
  let sign = num == (num = Math.abs(num))
  num = Math.floor(num * 100 + 0.50000000001) //下舍入
  let cents = num % 100 //求余 余数 = 被除数 - 除数 * 商
  cents = cents < 10 ? '0' + cents : cents //小于2位数就补齐
  num = Math.floor(num / 100).toString()
  for (let i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
    //每隔三位小数分始开隔
    //4 ==> 三位小数加一个分隔符，
    num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3))
  }
  return (sign ? '' : '-') + num + '.' + cents
}