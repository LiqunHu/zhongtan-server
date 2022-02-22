const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_verification = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_extra = model.zhongtan_logistics_payment_extra

exports.initAct = async () => {
  let returnData = {
    FREIGHT_STATE: GLBConfig.LOGISTICS_FREIGHT_STATE_SECTION
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select v.*, c.user_name, 
                CASE WHEN LOCATE('INVOICE', v.logistics_verification_api_name) > 0 THEN
                  (SELECT user_name FROM tbl_common_user WHERE user_id = v.logistics_verification_vendor)
                ELSE
                  (SELECT vendor_name FROM tbl_common_vendor WHERE vendor_id = v.logistics_verification_vendor)
                END vendor
                from tbl_zhongtan_logistics_verification v 
                LEFT JOIN tbl_common_user c ON v.logistics_verification_create_user = c.user_id
                WHERE v.state = ?`
  let replacements = [GLBConfig.ENABLE]
  if (doc.verification_state) {
    queryStr += ' AND v.logistics_verification_state = ?'
    replacements.push(doc.verification_state)
  }

  if (doc.start_date && doc.end_date) {
    queryStr += ' and v.created_at >= ? and v.created_at < ? '
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }

  if (doc.bl) {
    queryStr += ` AND EXISTS (SELECT 1 FROM tbl_zhongtan_logistics_verification_freight f 
                  LEFT JOIN tbl_zhongtan_logistics_shipment_list s ON f.shipment_list_id = s.shipment_list_id AND s.state = 1 
                  WHERE f.state = 1 AND f.logistics_verification_id = v.logistics_verification_id AND s.shipment_list_bill_no LIKE ?) `
    replacements.push('%' + doc.bl + '%')
  }

  queryStr = queryStr + " order by v.logistics_verification_id desc"
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      let dd = JSON.parse(JSON.stringify(d))
      dd.created_at = moment(d.created_at).format('YYYY-MM-DD HH:mm:ss')
      if(dd.logistics_verification_api_name === 'PAYMENT ADVANCE') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT ADVANCE ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      } else if(dd.logistics_verification_api_name === 'PAYMENT BALANCE') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT BALANCE ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      } else if(dd.logistics_verification_api_name === 'PAYMENT FULL') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT FULL ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      }
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
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'PB'
    ver.logistics_verification_section_user = user.user_id
    ver.logistics_verification_section_time = curDate
    await ver.save()

    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'PB'
        await v.save()
      }
    }
  }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'SD'
    ver.logistics_verification_section_user = user.user_id
    ver.logistics_verification_section_time = curDate
    await ver.save()

    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'SD'
        await v.save()
        if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT BALANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT FULL' 
            || ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
          let sp = await tb_shipment_list.findOne({
            where: {
              shipment_list_id: v.shipment_list_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sp) {
            if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT FULL') {
              sp.shipment_list_payment_status = '1'
            } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
              sp.shipment_list_payment_status = '3'
            } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
              sp.shipment_list_receivable_status = '1'
            }
            await sp.save()
          }
        } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
          let extra = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'P',
              state: GLBConfig.ENABLE
            }
          })
          if(extra) {
            extra.state = GLBConfig.DISABLE
            await extra.save()
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'PAYMENT EXTRA ATTACHMENT',
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
              payment_extra_type: 'P',
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
                sl.shipment_list_payment_status = '5'
              } else {
                sl.shipment_list_payment_status = '7'
              }
              await sl.save()
            }
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
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'EXTRA INVOICE ATTACHMENT',
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

exports.verificationDetailAct = async req => {
  let doc = common.docValidate(req)
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  let returnData = []
  if(ver) {
    // 托单审核
    if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT BALANCE' || ver.logistics_verification_api_name === 'PAYMENT FULL') {
      let queryStr = `SELECT sl.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor, vf.logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_shipment_list sl ON vf.shipment_list_id = sl.shipment_list_id 
                      LEFT JOIN tbl_common_vendor cv ON sl.shipment_list_vendor = cv.vendor_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      returnData = await model.simpleSelect(queryStr, replacements)
    } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
      let queryStr = `SELECT pe.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_payment_extra pe ON vf.shipment_list_id = pe.payment_extra_id AND pe.payment_extra_type = 'P'
                      LEFT JOIN tbl_common_vendor cv ON pe.payment_extra_vendor = cv.vendor_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      let extras = await model.simpleSelect(queryStr, replacements)
      if(extras) {
        for(let e of extras) {
          let ej = JSON.parse(JSON.stringify(e))
          let ea = await tb_uploadfile.findAll({
            where: {
              api_name: 'PAYMENT EXTRA ATTACHMENT',
              uploadfile_index1: ej.payment_extra_id,
              state: GLBConfig.ENABLE
            }
          })
          ej.files = []
          if(ea) {
            for(let a of ea) {
              ej.files.push({
                url: a.uploadfile_url
              })
            }
          }
          returnData.push(ej)
        }
      }
    } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
      let queryStr = `SELECT sl.*, cv.user_name AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_shipment_list sl ON vf.shipment_list_id = sl.shipment_list_id 
                      LEFT JOIN tbl_common_user cv ON sl.shipment_list_customer = cv.user_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      returnData = await model.simpleSelect(queryStr, replacements)
    } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
      let queryStr = `SELECT pe.*, cv.user_name AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_payment_extra pe ON vf.shipment_list_id = pe.payment_extra_id AND pe.payment_extra_type = 'R'
                      LEFT JOIN tbl_common_user cv ON pe.payment_extra_vendor = cv.user_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      let extras = await model.simpleSelect(queryStr, replacements)
      if(extras) {
        for(let e of extras) {
          let ej = JSON.parse(JSON.stringify(e))
          let ea = await tb_uploadfile.findAll({
            where: {
              api_name: 'EXTRA INVOICE ATTACHMENT',
              uploadfile_index1: ej.payment_extra_id,
              state: GLBConfig.ENABLE
            }
          })
          ej.files = []
          if(ea) {
            for(let a of ea) {
              ej.files.push({
                url: a.uploadfile_url
              })
            }
          }
          returnData.push(ej)
        }
      }
    }
  }
  return common.success(returnData)
}