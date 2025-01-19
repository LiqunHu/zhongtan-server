const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const numberToText = require('number2text')

const tb_unusual_invoice = model.zhongtan_unusual_invoice
const tb_verification = model.zhongtan_unusual_verification
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_items = model.zhongtan_payment_items
const tb_user = model.common_user

exports.initAct = async () => {
  let returnData = {
    COMMERCIAL_STATE: GLBConfig.UNUSUAL_VERIFICATION_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select uv.unusual_verification_id, uv.unusual_verification_state, uv.unusual_invoice_id, ui.*, concat(ui.unusual_invoice_vessel, '/', ui.unusual_invoice_voyaga) as unusual_invoice_vessel_voyage, cu.user_name AS unusual_invoice_create_user_name, cb.user_name as unusual_invoice_party_name, pi.payment_items_name as unusual_invoice_items_name 
                  from tbl_zhongtan_unusual_verification uv
                  LEFT JOIN tbl_zhongtan_unusual_invoice ui ON uv.unusual_invoice_id = ui.unusual_invoice_id AND ui.state = '1' 
                  LEFT JOIN tbl_common_user cu ON uv.unusual_verification_create_user = cu.user_id
                  left join tbl_common_user cb on ui.unusual_invoice_party = cb.user_id 
                  left join tbl_zhongtan_payment_items pi on ui.unusual_invoice_items = pi.payment_items_code
                  where uv.state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if (doc.search_data.verification_state) {
      queryStr += ' AND uv.unusual_verification_state = ?'
      replacements.push(doc.search_data.verification_state)
    }
    
    if (doc.search_data.date && doc.search_data.date.length > 1 && doc.search_data.date[0] && doc.search_data.date[1]) {
      queryStr += ' and uv.created_at >= ? and uv.created_at < ? '
      replacements.push(doc.search_data.date[0])
      replacements.push(moment(doc.search_data.date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
  }
  queryStr = queryStr + " order by uv.unusual_verification_id desc "
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
        unusual_verification_id: doc.unusual_verification_id,
        state: GLBConfig.ENABLE
      }
    })
  if(ver) {
    ver.unusual_verification_state = 'AP'
    ver.unusual_verification_commercial_user = user.user_id
    ver.unusual_verification_commercial_time = curDate
    let invoice = await tb_unusual_invoice.findOne({
      where: {
        unusual_invoice_id: ver.unusual_invoice_id
      }
    })
    if(invoice) {
      let invoice_no = await seq.genUnusualSeq()
      invoice.unusual_invoice_status = '2'
      invoice.unusual_invoice_no = invoice_no
      invoice.unusual_invoice_date = moment().format('YYYY/MM/DD HH:mm:ss')

      let items = await tb_payment_items.findOne({
        attributes: ['payment_items_code', 'payment_items_name'],
        where: {
          payment_items_code: invoice.unusual_invoice_items
        }
      })
      let party = await tb_user.findOne({
        where: {
          user_id: invoice.unusual_invoice_party
        }
      })

      let created = await tb_user.findOne({
        attributes: ['user_id', 'user_name', 'user_phone', 'user_email'],
        where: {
          user_id: ver.unusual_verification_create_user
        }
      })

      // 生成支付单
      let renderData = {}
      renderData.unusualParty = party ? party.user_name : ''
      renderData.partyTin = party ? party.user_tin : ''
      renderData.partyAddress = party ? party.user_address : ''
      renderData.cargoType = invoice.unusual_invoice_cargo_type
      renderData.invoiceDate = moment().format('YYYY/MM/DD')
      renderData.invoiceNo = invoice_no
      renderData.vesselName = invoice.unusual_invoice_vessel
      renderData.voyageNumber = invoice.unusual_invoice_voyaga
      renderData.unusualBl = invoice.unusual_invoice_bl
      renderData.unusualItems = items ? items.payment_items_name : ''
      renderData.unusualAmount = invoice.unusual_invoice_amount
      renderData.totalUnusualAmount =formatCurrency(invoice.unusual_invoice_amount)
      renderData.totalUnusualAmountStr = numberToText(invoice.unusual_invoice_amount, 'english')
      renderData.user_name = created ? created.user_name : ''
      renderData.user_phone = created ? created.user_phone : ''
      renderData.user_email = created ? created.user_email : ''
      let fileInfo = await common.ejs2Pdf('unusualInvoice.ejs', renderData, 'zhongtan')
      await ver.save()
      await invoice.save()
      await tb_uploadfile.create({
        api_name: 'UNUSUAL INVOICE',
        user_id: user.user_id,
        uploadfile_index1: invoice.unusual_invoice_id,
        uploadfile_index3: ver.unusual_verification_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_acttype: 'unusual',
        uploadfile_amount: invoice.unusual_invoice_amount,
        uploadfile_currency: 'USD',
        uploadfile_received_from: party ? party.user_name : '',
        uploadfile_customer_id: invoice.unusual_invoice_party,
        uploadfile_invoice_no: invoice_no,
        uploadfil_release_date: curDate,
        uploadfil_release_user_id: user.user_id
      })
      // 开票后拉入黑名单
      party.user_blacklist = GLBConfig.ENABLE
      party.blacklist_order = 'UNUSUAL_' + invoice.unusual_invoice_id
      await party.save()
    }
   }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verification.findOne({
    where: {
      unusual_verification_id: doc.unusual_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.unusual_verification_state = 'CD'
    ver.unusual_verification_commercial_user = user.user_id
    ver.unusual_verification_commercial_time = curDate
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