const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_verification = model.zhongtan_payment_verification
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    SECTION_STATE: GLBConfig.PAYMENT_SECTION_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select pv.payment_verification_id, pv.payment_verification_state, pv.payment_advice_id, pa.*, CONCAT(pa.payment_advice_vessel, '/', pa.payment_advice_voyage) AS payment_advice_vessel_voyage, cu.user_name AS payment_verification_create_user_name, cb.user_name as payment_advice_beneficiary_name, cr.user_name as payment_advice_remarks_name, pi.payment_items_name as payment_advice_items_name 
                  from tbl_zhongtan_payment_verification pv
                  LEFT JOIN tbl_zhongtan_payment_advice pa ON pv.payment_advice_id = pa.payment_advice_id AND pa.state = '1' 
                  LEFT JOIN tbl_common_user cu ON pv.payment_verification_create_user = cu.user_id
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
      dd.atta_files = await tb_uploadfile.findAll({
        where: {
          uploadfile_index1: dd.payment_advice_id,
          api_name: 'PAYMENT ADVICE ATTACHMENT',
          state: GLBConfig.ENABLE
        }
      })
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
    ver.payment_verification_state = 'PB'
    ver.payment_verification_section_user = user.user_id
    ver.payment_verification_section_time = curDate
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
    ver.payment_verification_state = 'SD'
    ver.payment_verification_section_user = user.user_id
    ver.payment_verification_section_time = curDate
    await ver.save()
  }
  return common.success()
}