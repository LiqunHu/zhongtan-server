const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const mailer = require('../../../util/Mail')

const tb_verificatione = model.zhongtan_export_verification
const tb_verification_log = model.zhongtan_export_verification_log
const tb_user = model.common_user
const tb_edi_depot = model.zhongtan_edi_depot
const tb_bl = model.zhongtan_export_masterbl
const tb_vessel = model.zhongtan_export_vessel

exports.initAct = async () => {
  let returnData = {
    RELEASE_STATE: GLBConfig.RELEASE_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select a.*, b.export_masterbl_bl, c.user_name as apply_user, d.user_name as empty_release_party from tbl_zhongtan_export_verification a 
                LEFT JOIN tbl_zhongtan_export_masterbl b ON a.export_masterbl_id = b.export_masterbl_id 
                LEFT JOIN tbl_common_user c ON a.export_verification_create_user = c.user_id
                LEFT JOIN tbl_common_user d ON a.export_verification_agent = d.user_id
                WHERE a.state = '1' AND a.export_verification_api_name IN ('EMPTY RELEASE')`
  let replacements = []
  if (doc.verification_state) {
    queryStr += ' AND a.export_verification_state = ?'
    replacements.push(doc.verification_state)
  }

  if (doc.bl) {
    queryStr += ' AND b.export_masterbl_bl = ?'
    replacements.push(doc.bl)
  }

  if (doc.start_date && doc.end_date) {
    queryStr += ' and a.created_at >= ? and a.created_at < ? '
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }

  queryStr = queryStr + " order by a.export_verification_id desc"
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data
  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let verificatione = await tb_verificatione.findOne({
    where: {
      export_verification_id: doc.export_verification_id,
      export_verification_state: 'PM',
      state: GLBConfig.ENABLE
    }
  })
  if(verificatione) {
    await tb_verification_log.create({
      export_masterbi_id: verificatione.export_masterbl_id,
      export_verification_id: verificatione.export_verification_id,
      user_id: user.user_id,
      api_name: verificatione.export_verification_api_name,
      verification_state: 'AP',
      verification_state_pre: verificatione.export_verification_state
    })
    verificatione.export_verification_state = 'AP'
    verificatione.export_verification_review_user = user.user_id
    verificatione.export_verification_review_date = curDate
    await verificatione.save()
    let bl = await tb_bl.findOne({
      where: {
        export_masterbl_id: verificatione.export_masterbl_id
      }
    })
    bl.export_masterbl_empty_release_approve_date = curDate
    await bl.save()
    if(verificatione.export_verification_api_name === 'EMPTY RELEASE') {
      // 发送放箱邮件
      if(verificatione.export_verification_depot) {
        let depot = await tb_edi_depot.findOne({
          where: {
            edi_depot_name: verificatione.export_verification_depot
          }
        })
        if(depot && depot.edi_depot_empty_release === '1' && depot.edi_depot_empty_release_email) {
          let agent = await tb_user.findOne({
            where: {
              user_id: verificatione.export_verification_agent
            }
          })
          let vessel = await tb_vessel.findOne({
            where: {
              export_vessel_id: bl.export_vessel_id
            }
          })
          let commonUser = await tb_user.findOne({
            where: {
              user_id: verificatione.export_verification_create_user
            }
          })
          let renderData = {}
          renderData.depotName = depot.edi_depot_name
          renderData.agentName = agent.user_name
          renderData.carrier = bl.export_masterbl_bl_carrier
          renderData.quantity = verificatione.export_verification_quantity
          renderData.billNo = bl.export_masterbl_bl
          if(bl.export_masterbl_agent_staff) {
            renderData.agent_staff = bl.export_masterbl_agent_staff
          } else {
            renderData.agent_staff = [{staff_name: '', staff_id: ''}, {staff_name: '', staff_id: ''}]
          }
          renderData.vessel = vessel.export_vessel_name
          renderData.voyage = vessel.export_vessel_voyage
          renderData.emptyReleaseParty = agent.user_name
          renderData.validTo = verificatione.export_verification_valid_to
          renderData.agentTIN = agent.user_tin
          renderData.validToStr = moment(verificatione.export_verification_valid_to).format('MMM DD, YYYY')
          renderData.user_name = commonUser.user_name
          renderData.user_phone = commonUser.user_phone
          renderData.user_email = commonUser.user_email
          let html = await common.ejs2Html('EmptyRelease.ejs', renderData)
          let mailSubject = 'EMPTY RELEASE ORDER - B/L#' + bl.export_masterbl_bl
          let mailContent = ''
          let mailHtml = html
          let attachments = []
          await mailer.sendEdiMail(GLBConfig.EMPTY_RELEASE_EMAIL_SENDER, depot.edi_depot_empty_release_email.split(';'), GLBConfig.EMPTY_RELEASE_CARBON_COPY.split(';'), GLBConfig.STORING_ORDER_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
        }
      }
    }
  }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
  let verificatione = await tb_verificatione.findOne({
    where: {
      export_verification_id: doc.export_verification_id,
      export_verification_state: 'PM',
      state: GLBConfig.ENABLE
    }
  })
  if(verificatione) {
    await tb_verification_log.create({
      export_masterbi_id: verificatione.export_masterbl_id,
      export_verification_id: verificatione.export_verification_id,
      user_id: user.user_id,
      api_name: verificatione.export_verification_api_name,
      verification_state: 'MD',
      verification_state_pre: verificatione.export_verification_state
    })
    verificatione.export_verification_state = 'MD'
    verificatione.export_verification_review_user = user.user_id
    verificatione.export_verification_review_date = new Date()
    await verificatione.save()

    let bl = await tb_bl.findOne({
      where: {
        export_masterbl_id: verificatione.export_masterbl_id
      }
    })
    if(!bl.export_masterbl_empty_release_approve_date) {
      bl.export_masterbl_empty_release_date = null
      bl.save()
    }
  }
  return common.success()
}