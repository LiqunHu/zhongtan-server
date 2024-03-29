const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const mailer = require('../../../util/Mail')

const tb_verification = model.zhongtan_export_verification
const tb_verification_log = model.zhongtan_export_verification_log
const tb_user = model.common_user
const tb_edi_depot = model.zhongtan_edi_depot
const tb_vessel = model.zhongtan_export_proforma_vessel
const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_shipment_fee_log = model.zhongtan_export_shipment_fee_log

exports.initAct = async () => {
  let returnData = {
    RELEASE_STATE: GLBConfig.RELEASE_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select a.*, b.export_masterbl_bl, b.export_masterbl_cargo_type, c.user_name as apply_user, d.user_name as empty_release_party, r.user_name as review_user from tbl_zhongtan_export_verification a 
                LEFT JOIN tbl_zhongtan_export_proforma_masterbl b ON a.export_masterbl_id = b.export_masterbl_id 
                LEFT JOIN tbl_common_user c ON a.export_verification_create_user = c.user_id
                LEFT JOIN tbl_common_user r ON a.export_verification_review_user = r.user_id
                LEFT JOIN tbl_common_user d ON a.export_verification_agent = d.user_id
                WHERE a.state = '1' AND a.export_verification_api_name IN (?)`
  let api_name = ['SHIPMENT RELEASE', 'EXPORT DEMURRAGE INVOICE', 'BK CANCELLATION']
  let replacements = [api_name]
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
  returnData.rows = []
  if(result.data && result.data.length > 0) {
    for(let d of result.data) {
      let b = JSON.parse(JSON.stringify(d))
      b.created_at = moment(d.created_at).format('YYYY-MM-DD HH:mm:ss')
      if(d.export_verification_review_date) {
        b.review_at = moment(d.export_verification_review_date).format('YYYY-MM-DD HH:mm:ss')
      }
      returnData.rows.push(b)
    }
  }
  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let verificatione = await tb_verification.findOne({
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
    if(verificatione.export_verification_api_name === 'EMPTY RELEASE') {
      let bl = await tb_bl.findOne({
        where: {
          export_masterbl_id: verificatione.export_masterbl_id
        }
      })
      bl.export_masterbl_empty_release_approve_date = curDate
      await bl.save()
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
    } else if(verificatione.export_verification_api_name === 'SHIPMENT RELEASE') {
      let shipment_fee_log = await tb_shipment_fee_log.findAll({
        where: {
          shipment_relation_id: verificatione.export_verification_id
        }
      })
      if(shipment_fee_log) {
        for(let fl of shipment_fee_log) {
          if(fl.shipment_fee_status === 'SU') {
            fl.shipment_fee_status_pre = fl.shipment_fee_status
            fl.shipment_fee_status = 'AP'
            fl.shipment_fee_approve_by = user.user_id
            fl.shipment_fee_approve_at = curDate
            await fl.save()
            let sf = await tb_shipment_fee.findOne({
              where: {
                shipment_fee_id: fl.shipment_fee_id
              }
            })
            if(sf) {
              sf.shipment_fee_status = 'AP'
              sf.shipment_fee_approve_by = user.user_id
              sf.shipment_fee_approve_at = curDate
              await sf.save()
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let verificatione = await tb_verification.findOne({
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

    if(verificatione.export_verification_api_name === 'EMPTY RELEASE') {
      let bl = await tb_bl.findOne({
        where: {
          export_masterbl_id: verificatione.export_masterbl_id
        }
      })
      if(!bl.export_masterbl_empty_release_approve_date) {
        bl.export_masterbl_empty_release_date = null
        bl.save()
      }
    } else if(verificatione.export_verification_api_name === 'SHIPMENT RELEASE') {
      let shipment_fee_log = await tb_shipment_fee_log.findAll({
        where: {
          shipment_relation_id: verificatione.export_verification_id
        }
      })
      if(shipment_fee_log) {
        for(let fl of shipment_fee_log) {
          if(fl.shipment_fee_status === 'SU') {
            fl.shipment_fee_status_pre = fl.shipment_fee_status
            fl.shipment_fee_status = 'DE'
            fl.shipment_fee_decline_by = user.user_id
            fl.shipment_fee_decline_at = curDate
            await fl.save()
            let sf = await tb_shipment_fee.findOne({
              where: {
                shipment_fee_id: fl.shipment_fee_id
              }
            })
            if(sf) {
              sf.shipment_fee_status = 'DE'
              sf.shipment_fee_decline_by = user.user_id
              sf.shipment_fee_decline_at = curDate
              await sf.save()
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.verificationDetailAct = async req => {
  let doc = common.docValidate(req)
  let ver = await tb_verification.findOne({
    where: {
      export_verification_id: doc.export_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  let returnData = {}
  if(ver) {
    // 托单审核
    if(ver.export_verification_api_name === 'SHIPMENT RELEASE') {
      let bl = await tb_bl.findOne({
        where: {
          export_masterbl_id: ver.export_masterbl_id
        }
      })
      let vessel = await tb_vessel.findOne({
        where: {
          export_vessel_id: bl.export_vessel_id
        }
      })
      returnData = JSON.parse(JSON.stringify(bl))
      returnData.shipment_receivable = ver.export_verification_shipment_receivable
      returnData.shipment_payable = ver.export_verification_shipment_payable
      returnData.export_vessel_code = vessel.export_vessel_code
      returnData.export_vessel_name = vessel.export_vessel_name
      returnData.export_vessel_voyage = vessel.export_vessel_voyage
      returnData.export_vessel_etd = vessel.export_vessel_etd

      let queryStr =  `SELECT CONCAT(COUNT(export_container_size_type), ' x ', export_container_size_type) AS size_type 
                  FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type ORDER BY export_container_size_type `
      let replacements = [bl.export_vessel_id, bl.export_masterbl_bl, GLBConfig.ENABLE]
      let sts =  await model.simpleSelect(queryStr, replacements)
      if(sts) {
        let st = []
        for(let s of sts) {
          st.push(s.size_type)
        }
        returnData.shipment_size_type = st.join(';')
      }
      queryStr = `SELECT
                    fl.*, f.shipment_fee_type, 
                    f.fee_data_code AS fee_data_code,
                    f.shipment_fee_status AS shipment_fee_status_now,
                    up.user_name AS shipment_party,
                    us.user_name AS submit_user,
                    uu.user_name AS undo_user,
                    ua.user_name AS approve_user,
                    ud.user_name AS decline_user
                  FROM
                    tbl_zhongtan_export_shipment_fee_log fl
                    LEFT JOIN tbl_zhongtan_export_shipment_fee f ON fl.shipment_fee_id = f.shipment_fee_id
                    LEFT JOIN tbl_common_user up ON f.shipment_fee_party = up.user_id 
                    LEFT JOIN tbl_common_user us ON fl.shipment_fee_submit_by = us.user_id
                    LEFT JOIN tbl_common_user uu ON fl.shipment_fee_undo_by = uu.user_id
                    LEFT JOIN tbl_common_user ua ON fl.shipment_fee_approve_by = ua.user_id
                    LEFT JOIN tbl_common_user ud ON fl.shipment_fee_decline_by = ud.user_id 
                  WHERE
                    fl.shipment_relation_id = ? AND fl.state = ? AND f.state = ?`
      replacements = [ver.export_verification_id, GLBConfig.ENABLE, GLBConfig.ENABLE]
      let ver_shipment = await model.simpleSelect(queryStr, replacements)
      returnData.verification_shipment = {}
      if(ver_shipment && ver_shipment.length > 0) {
        queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? GROUP BY fee_data_code`
        replacements = [GLBConfig.ENABLE]
        let fds = await model.simpleSelect(queryStr, replacements)
        let shipment_receiveable = []
        let shipment_payable = []
        for(let s of ver_shipment) {
          s.this_submit_fee = GLBConfig.ENABLE
          for(let fd of fds) {
            if(fd.fee_data_code === s.fee_data_code) {
              s.fee_data_name = fd.fee_data_name
            }
          }
          if(s.shipment_fee_type === 'R') {
            shipment_receiveable.push(s)
          } else if(s.shipment_fee_type === 'P') {
            shipment_payable.push(s)
          }
        }

        queryStr = `SELECT
                    fl.*, f.shipment_fee_type, 
                    f.fee_data_code AS fee_data_code,
                    f.shipment_fee_status AS shipment_fee_status_now,
                    up.user_name AS shipment_party,
                    us.user_name AS submit_user,
                    uu.user_name AS undo_user,
                    ua.user_name AS approve_user,
                    ud.user_name AS decline_user
                  FROM
                    tbl_zhongtan_export_shipment_fee_log fl
                    LEFT JOIN tbl_zhongtan_export_shipment_fee f ON fl.shipment_fee_id = f.shipment_fee_id
                    LEFT JOIN tbl_common_user up ON f.shipment_fee_party = up.user_id 
                    LEFT JOIN tbl_common_user us ON fl.shipment_fee_submit_by = us.user_id
                    LEFT JOIN tbl_common_user uu ON fl.shipment_fee_undo_by = uu.user_id
                    LEFT JOIN tbl_common_user ua ON fl.shipment_fee_approve_by = ua.user_id
                    LEFT JOIN tbl_common_user ud ON fl.shipment_fee_decline_by = ud.user_id 
                  WHERE
                    fl.shipment_relation_id <> ? AND f.export_masterbl_id = ? AND fl.state = ? AND f.state = ? AND f.shipment_fee_status IN (?)`
        replacements = [ver.export_verification_id, ver.export_masterbl_id, GLBConfig.ENABLE, GLBConfig.ENABLE, ['SU', 'AP', 'IN', 'RE']]
        let other_ver_shipment = await model.simpleSelect(queryStr, replacements)
        for(let s of other_ver_shipment) {
          s.this_submit_fee = GLBConfig.DISABLE
          for(let fd of fds) {
            if(fd.fee_data_code === s.fee_data_code) {
              s.fee_data_name = fd.fee_data_name
            }
          }
          if(s.shipment_fee_type === 'R') {
            shipment_receiveable.push(s)
          } else if(s.shipment_fee_type === 'P') {
            shipment_payable.push(s)
          }
        }
        returnData.verification_shipment.receiveable = shipment_receiveable
        returnData.verification_shipment.payable = shipment_payable
      }
    }
  }
  return common.success(returnData)
}