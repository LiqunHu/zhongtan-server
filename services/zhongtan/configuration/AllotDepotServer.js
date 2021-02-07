const common = require('../../../util/CommonUtil')
const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_allot_depot = model.zhongtan_allot_depot
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers
const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT edi_depot_id, edi_depot_name FROM tbl_zhongtan_edi_depot WHERE state = ? AND edi_depot_is_wharf = ? ORDER BY edi_depot_name`
  let replacements = [GLBConfig.ENABLE, GLBConfig.DISABLE]
  let depots = await model.simpleSelect(queryStr, replacements)
  returnData.allotRules = {
    'COSCO': [],
    'OOCL': [],
  }
  if(depots) {
    for(let d of depots) {
      returnData.allotRules.COSCO.push({
        depot_name: d.edi_depot_name,
        depot_percent: 0
      })
      returnData.allotRules.OOCL.push({
        depot_name: d.edi_depot_name,
        depot_percent: 0
      })
    }
  }
  
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_zhongtan_allot_depot where state = "1" '
  let replacements = []
  queryStr += ' order by allot_depot_enabled desc'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let ap of result.data) {
    delete ap.user_password
    returnData.rows.push(ap)
  }

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let ad = await tb_allot_depot.findOne({
    where: {
      allot_depot_enabled: doc.allot_depot_enabled,
      state: GLBConfig.ENABLE
    }
  })
  if (ad) {
    ad.allot_depot_rules = doc.allot_depot_rules
    await ad.save()
  } else {
    await tb_allot_depot.create({
      allot_depot_enabled: doc.allot_depot_enabled,
      allot_depot_rules: doc.allot_depot_rules
    })
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = 'select * from tbl_zhongtan_allot_depot where state = "1" and allot_depot_id <> ? and allot_depot_enabled = ? '
  let replacements = [doc.new.allot_depot_id, doc.new.allot_depot_enabled]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length > 0) {
    return common.error('allot_depot_02')
  }else {
    let ad = await tb_allot_depot.findOne({
      where: {
        allot_depot_id: doc.new.allot_depot_id,
        state: GLBConfig.ENABLE
      }
    })
    if (ad) {
      ad.allot_depot_enabled = doc.new.allot_depot_enabled
      ad.allot_depot_rules = doc.new.allot_depot_rules
      await ad.save()
      return common.success()
    } else {
      return common.error('allot_depot_01')
    }
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let ad = await tb_allot_depot.findOne({
    where: {
      allot_depot_id: doc.allot_depot_id
    }
  })
  if (ad) {
    ad.state = GLBConfig.DISABLE
    await ad.save()
    return common.success()
  } else {
    return common.error('allot_depot_01')
  }
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT * FROM tbl_zhongtan_invoice_vessel WHERE state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if(doc.search_data.vessel_name) {
      queryStr = queryStr + ` AND invoice_vessel_name = ? `
      replacements.push(doc.search_data.vessel_name)
    }
    if(doc.search_data.vessel_voyage) {
      queryStr = queryStr + ` AND invoice_vessel_voyage = ? `
      replacements.push(doc.search_data.vessel_voyage)
    }
    if(doc.search_data.ata_date && doc.search_data.ata_date.length > 0 && doc.search_data.ata_date[0] && doc.search_data.ata_date[1]) {
      queryStr = queryStr + ` AND STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") >= ? AND STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") <= ? `
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(doc.search_data.ata_date[1])
    }
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") DESC `
  let result = await model.simpleSelect(queryStr, replacements)
  return common.success(result)
}

exports.allotVesselDepotAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT * FROM tbl_zhongtan_invoice_vessel WHERE state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.search_data) {
    if(doc.search_data.vessel_name) {
      queryStr = queryStr + ` AND invoice_vessel_name = ? `
      replacements.push(doc.search_data.vessel_name)
    }
    if(doc.search_data.vessel_voyage) {
      queryStr = queryStr + ` AND invoice_vessel_voyage = ? `
      replacements.push(doc.search_data.vessel_voyage)
    }
    if(doc.search_data.ata_date && doc.search_data.ata_date.length > 0 && doc.search_data.ata_date[0] && doc.search_data.ata_date[1]) {
      queryStr = queryStr + ` AND STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") >= ? AND STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") <= ? `
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(doc.search_data.ata_date[1])
    }
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(invoice_vessel_ata, "%d/%m/%Y") DESC `
  let result = await model.simpleSelect(queryStr, replacements)
  if(result) {
    for(let r of result) {
      await this.handleAllotVesselDepot(r.invoice_vessel_id, doc.reset)
    }
  }
  return common.success()
}

exports.handleAllotVesselDepot = async (vessel_id, reset = '0') => {
  if(vessel_id) {
    // 查询满足条件的分配规则
    let vessel = await tb_vessel.findOne({
      where: {
        state: GLBConfig.ENABLE,
        invoice_vessel_id: vessel_id
      }
    })
    if(vessel && vessel.invoice_vessel_ata) {
      let queryStr = `SELECT * FROM tbl_zhongtan_allot_depot WHERE allot_depot_enabled <= ? ORDER BY allot_depot_enabled DESC LIMIT 1 `
      let replacements = [moment(vessel.invoice_vessel_ata, 'DD/MM/YYYY').format('YYYY-MM-DD')]
      let result = await model.simpleSelect(queryStr, replacements)
      if(result && result.length > 0) {
        let special_type = await tb_container_size.findAll({
          where: {
            state: GLBConfig.ENABLE,
            container_special_type: GLBConfig.ENABLE
          }
        })
        let special_cons = []
        if(special_type) {
          for(let t of special_type) {
            special_cons.push(t.container_size_code)
            special_cons.push(t.container_size_name)
          }
        }
        let rule = result[0].allot_depot_rules
        let coscoRule = rule.COSCO
        let ooclRule = rule.OOCL
        let vessel_bls = await tb_bl.findAll({
          where: {
            state: GLBConfig.ENABLE,
            invoice_vessel_id: vessel.invoice_vessel_id
          }
        })
        let vessel_cons = await tb_container.findAll({
          where: {
            state: GLBConfig.ENABLE,
            invoice_vessel_id: vessel.invoice_vessel_id
          }
        })
        if(vessel_bls && vessel_bls.length > 0 && vessel_cons && vessel_cons.length > 0) {
          if(reset && reset === GLBConfig.ENABLE) {
            // 删除未D/O提单分配的堆场
            for(let b of vessel_bls) {
              if(!b.invoice_masterbi_do_date && b.invoice_masterbi_do_return_depot) {
                b.invoice_masterbi_do_return_depot = ''
                await b.save()
              }
            }
          }
          let cosco_bl_cons = []
          let oocl_bl_cons = []
          let cosco_total = 0
          let oocl_total = 0
          for(let vb of vessel_bls) {
            if(vb.invoice_masterbi_bl.indexOf('COS') >= 0) {
              cosco_bl_cons.push({
                bl_id: vb.invoice_masterbi_id,
                bl: vb.invoice_masterbi_bl,
                depot: vb.invoice_masterbi_do_return_depot,
                is_special: GLBConfig.DISABLE
              })
            } else if(vb.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
              oocl_bl_cons.push({
                bl_id: vb.invoice_masterbi_id,
                bl: vb.invoice_masterbi_bl,
                depot: vb.invoice_masterbi_do_return_depot,
                is_special: GLBConfig.DISABLE
              })
            }
          }
          for(let vc of vessel_cons) {
            if(vc.invoice_containers_bl.indexOf('COS') >= 0) {
              cosco_total = cosco_total + 1
              for(let cbc of cosco_bl_cons) {
                if(cbc.bl === vc.invoice_containers_bl) {
                  if(cbc.con_count) {
                    cbc.con_count = cbc.con_count + 1
                  } else {
                    cbc.con_count = 1
                  }
                  if(special_cons.indexOf(vc.invoice_containers_size) >= 0) {
                    cbc.is_special = GLBConfig.ENABLE
                  }
                  break
                }
              }
            } else if(vc.invoice_containers_bl.indexOf('OOLU') >= 0) {
              oocl_total = oocl_total + 1
              for(let obc of oocl_bl_cons) {
                if(obc.bl === vc.invoice_containers_bl) {
                  if(obc.con_count) {
                    obc.con_count = obc.con_count + 1
                  } else {
                    obc.con_count = 1
                  }
                  if(special_cons.indexOf(vc.invoice_containers_size) >= 0) {
                    obc.is_special = GLBConfig.ENABLE
                  }
                  break
                }
              }
            }
          }
          let cosco_limit_total = 0
          let oocl_limit_total = 0
          for(let cre of coscoRule) {
            cre.limit_count = cosco_total * cre.depot_percent / 100
            cre.allot_count = 0
            cosco_limit_total = cosco_limit_total + cre.limit_count
          }
          if(cosco_limit_total !== cosco_total) {
            coscoRule[coscoRule.length - 1].limit_count = coscoRule[coscoRule.length - 1].limit_count + (cosco_total - cosco_limit_total)
          }
          for(let ore of ooclRule) {
            ore.limit_count = oocl_total * ore.depot_percent / 100
            ore.allot_count = 0
            oocl_limit_total = oocl_limit_total + ore.limit_count
          }
          if(oocl_limit_total !== oocl_total) {
            ooclRule[ooclRule.length - 1].limit_count = ooclRule[ooclRule.length - 1].limit_count + (oocl_total - oocl_limit_total)
          }
          for(let cbc of cosco_bl_cons) {
            if(cbc.depot) {
              for(let cre of coscoRule) {
                if(cbc.depot === cre.depot_name) {
                  cre.allot_count = cre.allot_count + cbc.con_count
                  break
                }
              }
            }            
          }
          for(let obc of oocl_bl_cons) {
            if(obc.depot) {
              for(let ore of ooclRule) {
                if(obc.depot === ore.depot_name) {
                  ore.allot_count = ore.allot_count + obc.con_count
                  break
                }
              }
            }            
          }
          for(let cbc of cosco_bl_cons) {
            if(cbc.is_special === GLBConfig.ENABLE && !cbc.depot && !cbc.allot_depot) {
              for(let cre of coscoRule) {
                if(cre.depot_name !== 'AFICD' && cre.allot_count < cre.limit_count) {
                  cbc.allot_depot = cre.depot_name
                  cre.allot_count = cre.allot_count + cbc.con_count
                  break
                }
              }
            }
          }
          for(let cbc of cosco_bl_cons) {
            if(cbc.is_special === GLBConfig.DISABLE && !cbc.depot && !cbc.allot_depot) {
              for(let cre of coscoRule) {
                if(cre.allot_count < cre.limit_count) {
                  cbc.allot_depot = cre.depot_name
                  cre.allot_count = cre.allot_count + cbc.con_count
                  break
                }
              }
            }
          }
          for(let cbc of cosco_bl_cons) {
            if(!cbc.depot && !cbc.allot_depot) {
              if(cbc.is_special === GLBConfig.ENABLE) {
                for(let cre of coscoRule) {
                  if(cre.depot_name !== 'AFICD') {
                    cbc.allot_depot = cre.depot_name
                    cre.allot_count = cre.allot_count + cbc.con_count
                    break
                  }
                }
              }else {
                for(let cre of coscoRule) {
                  cbc.allot_depot = cre.depot_name
                  cre.allot_count = cre.allot_count + cbc.con_count
                  break
                }
              }
            }
          }
          for(let obc of oocl_bl_cons) {
            if(obc.is_special === GLBConfig.ENABLE && !obc.depot && !obc.allot_depot) {
              for(let ore of ooclRule) {
                if(ore.depot_name !== 'AFICD' && ore.allot_count < ore.limit_count) {
                  obc.allot_depot = ore.depot_name
                  ore.allot_count = ore.allot_count + obc.con_count
                  break
                }
              }
            }
          }
          for(let obc of oocl_bl_cons) {
            if(obc.is_special === GLBConfig.DISABLE && !obc.depot && !obc.allot_depot) {
              for(let ore of ooclRule) {
                if(ore.allot_count < ore.limit_count) {
                  obc.allot_depot = ore.depot_name
                  ore.allot_count = ore.allot_count + obc.con_count
                  break
                }
              }
            }
          }
          for(let obc of oocl_bl_cons) {
            if(!obc.depot && !obc.allot_depot) {
              if(obc.is_special === GLBConfig.ENABLE) {
                for(let ore of ooclRule) {
                  if(ore.depot_name !== 'AFICD') {
                    obc.allot_depot = ore.depot_name
                    ore.allot_count = ore.allot_count + obc.con_count
                    break
                  }
                }
              }else {
                for(let ore of ooclRule) {
                  obc.allot_depot = ore.depot_name
                  ore.allot_count = ore.allot_count + obc.con_count
                  break
                }
              }
            }
          }
          for(let cbc of cosco_bl_cons) {
            if(cbc.allot_depot) {
              let bl = await tb_bl.findOne({
                where: {
                  invoice_masterbi_id: cbc.bl_id
                }
              })
              if(bl) {
                bl.invoice_masterbi_do_return_depot = cbc.allot_depot
                await bl.save()
              }
            }
          }
          for(let obc of oocl_bl_cons) {
            if(obc.allot_depot) {
              let bl = await tb_bl.findOne({
                where: {
                  invoice_masterbi_id: obc.bl_id
                }
              })
              if(bl) {
                bl.invoice_masterbi_do_return_depot = obc.allot_depot
                await bl.save()
              }
            }
          }
        }
      }
    }
  }
}