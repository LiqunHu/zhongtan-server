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
  let queryStr = `SELECT edi_depot_id, edi_depot_name, edi_depot_address FROM tbl_zhongtan_edi_depot WHERE state = ? AND edi_depot_is_wharf = ? ORDER BY edi_depot_name`
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
  
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE,
      container_special_type: GLBConfig.DISABLE
    },
    order: [['container_size_code', 'ASC']]
  })
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
        let coscoRule = []
        if(rule.COSCO) {
          for(let r of rule.COSCO) {
            if(r.depot_percent > 0) {
              coscoRule.push(r)
            }
          }
        }
        let ooclRule = []
        if(rule.OOCL) {
          for(let r of rule.OOCL) {
            if(r.depot_percent > 0) {
              ooclRule.push(r)
            }
          }
        }
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
          // 查询船提箱箱信息
          queryStr = `SELECT invoice_containers_bl, invoice_containers_size, COUNT(invoice_containers_size) AS container_size_count,
                       (SELECT invoice_masterbi_do_return_depot FROM tbl_zhongtan_invoice_masterbl WHERE invoice_vessel_id = c.invoice_vessel_id AND invoice_masterbi_bl = c.invoice_containers_bl) AS bl_return_depot 
                       FROM tbl_zhongtan_invoice_containers c WHERE invoice_vessel_id = ? AND state = 1 
                       GROUP BY invoice_containers_bl, invoice_containers_size ORDER BY invoice_containers_bl`
          replacements = [vessel.invoice_vessel_id]
          let bl_cons = await model.simpleSelect(queryStr, replacements)

          queryStr = `SELECT invoice_containers_bl FROM tbl_zhongtan_invoice_containers WHERE invoice_vessel_id = ? AND state = 1 
                    GROUP BY invoice_containers_bl HAVING COUNT(DISTINCT(invoice_containers_size)) > 1`
          replacements = [vessel.invoice_vessel_id]
          let multiple_cons = await model.simpleSelect(queryStr, replacements)
          if(bl_cons && bl_cons.length > 0) {
            let cosco_bl_cons = []
            let oocl_bl_cons = []
            let cosco_total = 0
            let oocl_total = 0
            for(let bc of bl_cons) {
              if(bc.invoice_containers_bl.indexOf('OOLU') >= 0) {
                oocl_bl_cons.push(bc)
                oocl_total = oocl_total + bc.container_size_count
              } else {
                cosco_bl_cons.push(bc)
                cosco_total = cosco_total + bc.container_size_count
              }
            }
            let multiple_cons_bls = []
            if(multiple_cons && multiple_cons.length > 0) {
              for(let m of multiple_cons) {
                multiple_cons_bls.push(m.invoice_containers_bl)
              }
            }
            if(cosco_bl_cons && cosco_bl_cons.length > 0) {
              let allot_result = await this.handleCarrierAllotDepot(cosco_bl_cons, coscoRule, cosco_total, special_cons, multiple_cons_bls)
              if(allot_result && allot_result.length > 0) {
                for(let cb of allot_result) {
                  if(cb.allot_return_depot) {
                    let bl = await tb_bl.findOne({
                      where: {
                        invoice_vessel_id: vessel.invoice_vessel_id,
                        invoice_masterbi_bl: cb.invoice_containers_bl
                      }
                    })
                    if(bl) {
                      bl.invoice_masterbi_do_return_depot = cb.allot_return_depot
                      await bl.save()
                    }
                  }
                }
              }
            }
            if(oocl_bl_cons && oocl_bl_cons.length > 0) {
              let allot_result = await this.handleCarrierAllotDepot(oocl_bl_cons, ooclRule, oocl_total, special_cons, multiple_cons_bls)
              if(allot_result && allot_result.length > 0) {
                for(let cb of allot_result) {
                  if(cb.allot_return_depot) {
                    let bl = await tb_bl.findOne({
                      where: {
                        invoice_vessel_id: vessel.invoice_vessel_id,
                        invoice_masterbi_bl: cb.invoice_containers_bl
                      }
                    })
                    if(bl) {
                      bl.invoice_masterbi_do_return_depot = cb.allot_return_depot
                      await bl.save()
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

exports.handleCarrierAllotDepot = async (bl_cons, depot_rules, total_count, special_cons, multiple_cons) => {
  let other_allot_depot_bl_cons = []
  let bans_con_count = 0
  
  if(bl_cons && bl_cons.length > 0 && depot_rules && depot_rules.length > 0) {
    // 优先分配存在禁令的箱型
    let bans_container_types = []
    for(let cre of depot_rules) {
      if(cre.bans && cre.bans.length > 0) {
        for(let b of cre.bans) {
          if(b && bans_container_types.indexOf(b) < 0) {
            bans_container_types.push(b)
          }
        }
      }
    }
    if(bans_container_types.length > 0) {
      
      for(let bc of bl_cons) {
        if(bans_container_types.indexOf(bc.invoice_containers_size) >= 0) {
          bans_con_count = bans_con_count + bc.container_size_count
        } else {
          other_allot_depot_bl_cons.push(bc)
        }
      }
      let allow_depot_set = []
      for(let cre of depot_rules) {
        if(cre.details) {
          for(let cd of cre.details) {
            if(cd.con_type && bans_container_types.indexOf(cd.con_type) >= 0) {
              // 该堆场允许分配存在禁令箱型
              let allow_depot = {
                depot_name: cre.depot_name,
                con_type: cd.con_type,
                con_name: cd.con_name,
                limit_count: parseInt(bans_con_count * cd.con_type_percent / 100),
              }
              allow_depot_set.push(allow_depot)
            }
          }
        }
      }
      if(allow_depot_set && allow_depot_set.length > 0) {
        let total_allow_count = 0
        for(let ad of allow_depot_set) {
          total_allow_count = total_allow_count + ad.limit_count
        }
        if(total_allow_count < bans_con_count) {
          if((bans_con_count - total_allow_count) < allow_depot_set.length) {
            allow_depot_set[0].limit_count = allow_depot_set[0].limit_count + (bans_con_count - total_allow_count)
          } else {
            if((bans_con_count - total_allow_count) % allow_depot_set.length === 0) {
              for(let ad of allow_depot_set) {
                ad.limit_count = ad.limit_count + (bans_con_count - total_allow_count) / allow_depot_set.length
              }
            } else {
              let avg_count = parseInt((bans_con_count - total_allow_count) / allow_depot_set.length)
              let last_count = avg_count + (bans_con_count - total_allow_count) % allow_depot_set.length
              for(let i = 0; i < allow_depot_set.length; ++i) {
                if(i === 0) {
                  allow_depot_set[i].limit_count = allow_depot_set[i].limit_count + last_count
                } else {
                  allow_depot_set[i].limit_count = allow_depot_set[i].limit_count + avg_count
                }
              }
            }
          }
        }

        for(let ad of allow_depot_set) {
          let bans_allot_depot_conunt = 0
          setDepot: for(let c of bl_cons) {
              if(!c.bl_return_depot && !c.allot_return_depot && (c.invoice_containers_size === ad.con_type || c.invoice_containers_size === ad.con_name)) {
                c.allot_return_depot = ad.depot_name
                bans_allot_depot_conunt = bans_allot_depot_conunt + c.container_size_count
                if(bans_allot_depot_conunt >= ad.limit_count) {
                  break setDepot
                }
              }
            }
        }

        // 查漏补缺
        for(let c of bl_cons) {
          if(!c.bl_return_depot && !c.allot_return_depot && bans_container_types.indexOf(c.invoice_containers_size) >= 0) {
            c.allot_return_depot = allow_depot_set[0].depot_name
          }
        }
      }
    }
    let other_allot_depot_total_count = total_count - bans_con_count
    // 处理剩余的箱子
    for(let cre of depot_rules) {
      cre.allot_count = 0
      let limit_count = parseInt(other_allot_depot_total_count * cre.depot_percent / 100)
      if(cre.details) {
        let final_limit_count = 0
        let total_con_type_percent = 0
        for(let d of cre.details) {
          total_con_type_percent = total_con_type_percent + d.con_type_percent
          d.allot_type_count = parseInt(limit_count * d.con_type_percent / 100)
          final_limit_count = final_limit_count + d.allot_type_count
        }
        if(final_limit_count > limit_count) {
          if(total_con_type_percent === 100) {
            cre.details[cre.details.length - 1].allot_type_count = cre.details[cre.details.length - 1].allot_type_count - (final_limit_count - limit_count)
          }else {
            limit_count = final_limit_count
          }
          cre.other_con_type_limit_count = 0
        } else {
          if(total_con_type_percent === 100) {
            cre.details[cre.details.length - 1].allot_type_count = cre.details[cre.details.length - 1].allot_type_count + (limit_count - final_limit_count)
            cre.other_con_type_limit_count = 0
          } else {
            cre.other_con_type_limit_count = limit_count - final_limit_count
          }
        }
      } else {
        cre.other_con_type_limit_count = 0
      }
      cre.limit_count = limit_count
    }
    for(let cre of depot_rules) {
      let exist_depot_count = 0
      for(let c of other_allot_depot_bl_cons) {
        if((c.bl_return_depot && c.bl_return_depot === cre.depot_name) 
          || (c.allot_return_depot && c.allot_return_depot === cre.depot_name)) {
          exist_depot_count = exist_depot_count + c.container_size_count
        }
      }
      if(exist_depot_count < cre.limit_count) {
        let diff_limit_count = cre.limit_count - exist_depot_count
        if(cre.details && cre.details.length > 0) {
          // 设置了按照箱型分配
          let detail_con_types = []
          for(let d of cre.details) {
            detail_con_types.push(d.con_type)
            let detail_diff_limit_count = d.allot_type_count
            for(let c of other_allot_depot_bl_cons) {
              if(multiple_cons && multiple_cons.length > 0 && multiple_cons.indexOf(c.invoice_containers_bl) >= 0) {
                continue
              }
              if(!c.bl_return_depot && !c.allot_return_depot && (c.invoice_containers_size === d.con_type || c.invoice_containers_size === d.con_name)) {
                if(special_cons.indexOf(c.invoice_containers_size) >= 0){
                  // 特殊箱型
                  if(cre.depot_name !== 'AFICD') {
                    c.allot_return_depot = cre.depot_name
                    detail_diff_limit_count = detail_diff_limit_count - c.container_size_count
                    diff_limit_count = diff_limit_count - c.container_size_count
                  }
                } else {
                  c.allot_return_depot = cre.depot_name
                  detail_diff_limit_count = detail_diff_limit_count - c.container_size_count
                  diff_limit_count = diff_limit_count - c.container_size_count
                }
              }
              if(detail_diff_limit_count <= 0 || diff_limit_count <= 0) {
                break
              }
            }
          }
          if(cre.other_con_type_limit_count && cre.other_con_type_limit_count > 0 && diff_limit_count > 0 && cre.other_con_type_limit_count > diff_limit_count) {
            diff_limit_count = cre.other_con_type_limit_count
          }
          if(diff_limit_count > 0) {
            for(let c of other_allot_depot_bl_cons) {
              if(!c.bl_return_depot && !c.allot_return_depot && detail_con_types.indexOf(c.invoice_containers_size) >= 0) {
                if(special_cons.indexOf(c.invoice_containers_size) >= 0) {
                  // 特殊箱型
                  if(cre.depot_name !== 'AFICD') {
                    c.allot_return_depot = cre.depot_name
                    diff_limit_count = diff_limit_count - c.container_size_count
                  }
                } else {
                  c.allot_return_depot = cre.depot_name
                  diff_limit_count = diff_limit_count - c.container_size_count
                }
                if(multiple_cons.indexOf(c.invoice_containers_bl) >= 0) {
                  for(let cc of other_allot_depot_bl_cons) {
                    if(!cc.bl_return_depot && !cc.allot_return_depot && cc.invoice_containers_bl === c.invoice_containers_bl) {
                      if(special_cons.indexOf(c.invoice_containers_size) >= 0) {
                        // 特殊箱型
                        if(cre.depot_name !== 'AFICD') {
                          cc.allot_return_depot = cre.depot_name
                          diff_limit_count = diff_limit_count - cc.container_size_count
                        }
                      } else {
                        cc.allot_return_depot = cre.depot_name
                        diff_limit_count = diff_limit_count - cc.container_size_count
                      }
                    }
                    if(diff_limit_count <= 0) {
                      break
                    }
                  }
                }
              }
              if(diff_limit_count <= 0) {
                break
              }
            }
          }
          if(diff_limit_count > 0) {
            for(let c of other_allot_depot_bl_cons) {
              if(!c.bl_return_depot && !c.allot_return_depot ) {
                if(special_cons.indexOf(c.invoice_containers_size) >= 0 && detail_con_types.indexOf(c.invoice_containers_size) < 0){
                  // 特殊箱型
                  if(cre.depot_name !== 'AFICD') {
                    c.allot_return_depot = cre.depot_name
                    diff_limit_count = diff_limit_count - c.container_size_count
                  }
                } else {
                  c.allot_return_depot = cre.depot_name
                  diff_limit_count = diff_limit_count - c.container_size_count
                }
              }
              if(diff_limit_count <= 0) {
                break
              }
            }
          }
          if(diff_limit_count > 0) {
            cre.diff_limit_count = diff_limit_count
          }
        } else {
          // 按顺序提取对应数量箱子，设置堆场
          for(let c of other_allot_depot_bl_cons) {
            if(!c.bl_return_depot && !c.allot_return_depot) {
              if(special_cons.indexOf(c.invoice_containers_size) >= 0){
                // 特殊箱型
                if(cre.depot_name !== 'AFICD') {
                  c.allot_return_depot = cre.depot_name
                  diff_limit_count = diff_limit_count - c.container_size_count
                }
              } else {
                c.allot_return_depot = cre.depot_name
                diff_limit_count = diff_limit_count - c.container_size_count
              }
            }
            if(diff_limit_count <= 0) {
              break
            }
          }
        }
      }
    }
    for(let c of other_allot_depot_bl_cons) {
      if(!c.bl_return_depot && !c.allot_return_depot) {
        // 还存在没有分配堆场的提单 随机分配
        for(let cre of depot_rules) {
          if(special_cons.indexOf(c.invoice_containers_size) >= 0 && cre.depot_name === 'AFICD'){
            // 特殊箱型
            continue
          }
          if(cre.diff_limit_count > 0) {
            c.allot_return_depot = cre.depot_name
            cre.diff_limit_count = cre.diff_limit_count - c.container_size_count
            break
          }
        }
      }
    }
    // 最后的查漏补缺
    for(let c of bl_cons) {
      if(!c.bl_return_depot && !c.allot_return_depot) {
        for(let cre of depot_rules) {
          if(special_cons.indexOf(c.invoice_containers_size) >= 0 && cre.depot_name === 'AFICD'){
            // 特殊箱型
            continue
          }
          c.allot_return_depot = cre.depot_name
          break
        }
      }
    }
  }
  return bl_cons
}