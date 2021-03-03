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
          if(bl_cons && bl_cons.length > 0) {
            let cosco_bl_cons = []
            let oocl_bl_cons = []
            let cosco_total = 0
            let oocl_total = 0
            for(let bc of bl_cons) {
              if(bc.invoice_containers_bl.indexOf('COS') >= 0) {
                cosco_bl_cons.push(bc)
                cosco_total = cosco_total + bc.container_size_count
              } else if(bc.invoice_containers_bl.indexOf('OOLU') >= 0) {
                oocl_bl_cons.push(bc)
                oocl_total = oocl_total + bc.container_size_count
              }
            }
            if(cosco_bl_cons && cosco_bl_cons.length > 0) {
              let allot_result = await this.handleCarrierAllotDepot(cosco_bl_cons, coscoRule, cosco_total, special_cons)
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
              let allot_result = await this.handleCarrierAllotDepot(oocl_bl_cons, ooclRule, oocl_total, special_cons)
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

        //   let cosco_bl_cons = []
        //   let oocl_bl_cons = []
        //   let cosco_total = 0
        //   let oocl_total = 0
        //   for(let vb of vessel_bls) {
        //     if(vb.invoice_masterbi_bl.indexOf('COS') >= 0) {
        //       cosco_bl_cons.push({
        //         bl_id: vb.invoice_masterbi_id,
        //         bl: vb.invoice_masterbi_bl,
        //         depot: vb.invoice_masterbi_do_return_depot,
        //         is_special: GLBConfig.DISABLE
        //       })
        //     } else if(vb.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
        //       oocl_bl_cons.push({
        //         bl_id: vb.invoice_masterbi_id,
        //         bl: vb.invoice_masterbi_bl,
        //         depot: vb.invoice_masterbi_do_return_depot,
        //         is_special: GLBConfig.DISABLE
        //       })
        //     }
        //   }
        //   for(let vc of vessel_cons) {
        //     if(vc.invoice_containers_bl.indexOf('COS') >= 0) {
        //       cosco_total = cosco_total + 1
        //       for(let cbc of cosco_bl_cons) {
        //         if(cbc.bl === vc.invoice_containers_bl) {
        //           if(cbc.con_count) {
        //             cbc.con_count = cbc.con_count + 1
        //           } else {
        //             cbc.con_count = 1
        //           }
        //           if(special_cons.indexOf(vc.invoice_containers_size) >= 0) {
        //             cbc.is_special = GLBConfig.ENABLE
        //           }
        //           break
        //         }
        //       }
        //     } else if(vc.invoice_containers_bl.indexOf('OOLU') >= 0) {
        //       oocl_total = oocl_total + 1
        //       for(let obc of oocl_bl_cons) {
        //         if(obc.bl === vc.invoice_containers_bl) {
        //           if(obc.con_count) {
        //             obc.con_count = obc.con_count + 1
        //           } else {
        //             obc.con_count = 1
        //           }
        //           if(special_cons.indexOf(vc.invoice_containers_size) >= 0) {
        //             obc.is_special = GLBConfig.ENABLE
        //           }
        //           break
        //         }
        //       }
        //     }
        //   }
        //   let cosco_limit_total = 0
        //   let oocl_limit_total = 0
        //   for(let cre of coscoRule) {
        //     cre.limit_count = cosco_total * cre.depot_percent / 100
        //     cre.allot_count = 0
        //     cosco_limit_total = cosco_limit_total + cre.limit_count
        //   }
        //   if(cosco_limit_total !== cosco_total) {
        //     coscoRule[coscoRule.length - 1].limit_count = coscoRule[coscoRule.length - 1].limit_count + (cosco_total - cosco_limit_total)
        //   }
        //   for(let ore of ooclRule) {
        //     ore.limit_count = oocl_total * ore.depot_percent / 100
        //     ore.allot_count = 0
        //     oocl_limit_total = oocl_limit_total + ore.limit_count
        //   }
        //   if(oocl_limit_total !== oocl_total) {
        //     ooclRule[ooclRule.length - 1].limit_count = ooclRule[ooclRule.length - 1].limit_count + (oocl_total - oocl_limit_total)
        //   }
        //   for(let cbc of cosco_bl_cons) {
        //     if(cbc.depot) {
        //       for(let cre of coscoRule) {
        //         if(cbc.depot === cre.depot_name) {
        //           cre.allot_count = cre.allot_count + cbc.con_count
        //           break
        //         }
        //       }
        //     }            
        //   }
        //   for(let obc of oocl_bl_cons) {
        //     if(obc.depot) {
        //       for(let ore of ooclRule) {
        //         if(obc.depot === ore.depot_name) {
        //           ore.allot_count = ore.allot_count + obc.con_count
        //           break
        //         }
        //       }
        //     }            
        //   }
        //   for(let cbc of cosco_bl_cons) {
        //     if(cbc.is_special === GLBConfig.ENABLE && !cbc.depot && !cbc.allot_depot) {
        //       for(let cre of coscoRule) {
        //         if(cre.depot_name !== 'AFICD' && cre.allot_count < cre.limit_count) {
        //           cbc.allot_depot = cre.depot_name
        //           cre.allot_count = cre.allot_count + cbc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let cbc of cosco_bl_cons) {
        //     if(cbc.is_special === GLBConfig.DISABLE && !cbc.depot && !cbc.allot_depot) {
        //       for(let cre of coscoRule) {
        //         if(cre.allot_count < cre.limit_count) {
        //           cbc.allot_depot = cre.depot_name
        //           cre.allot_count = cre.allot_count + cbc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let cbc of cosco_bl_cons) {
        //     if(!cbc.depot && !cbc.allot_depot) {
        //       if(cbc.is_special === GLBConfig.ENABLE) {
        //         for(let cre of coscoRule) {
        //           if(cre.depot_name !== 'AFICD') {
        //             cbc.allot_depot = cre.depot_name
        //             cre.allot_count = cre.allot_count + cbc.con_count
        //             break
        //           }
        //         }
        //       }else {
        //         for(let cre of coscoRule) {
        //           cbc.allot_depot = cre.depot_name
        //           cre.allot_count = cre.allot_count + cbc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let obc of oocl_bl_cons) {
        //     if(obc.is_special === GLBConfig.ENABLE && !obc.depot && !obc.allot_depot) {
        //       for(let ore of ooclRule) {
        //         if(ore.depot_name !== 'AFICD' && ore.allot_count < ore.limit_count) {
        //           obc.allot_depot = ore.depot_name
        //           ore.allot_count = ore.allot_count + obc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let obc of oocl_bl_cons) {
        //     if(obc.is_special === GLBConfig.DISABLE && !obc.depot && !obc.allot_depot) {
        //       for(let ore of ooclRule) {
        //         if(ore.allot_count < ore.limit_count) {
        //           obc.allot_depot = ore.depot_name
        //           ore.allot_count = ore.allot_count + obc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let obc of oocl_bl_cons) {
        //     if(!obc.depot && !obc.allot_depot) {
        //       if(obc.is_special === GLBConfig.ENABLE) {
        //         for(let ore of ooclRule) {
        //           if(ore.depot_name !== 'AFICD') {
        //             obc.allot_depot = ore.depot_name
        //             ore.allot_count = ore.allot_count + obc.con_count
        //             break
        //           }
        //         }
        //       }else {
        //         for(let ore of ooclRule) {
        //           obc.allot_depot = ore.depot_name
        //           ore.allot_count = ore.allot_count + obc.con_count
        //           break
        //         }
        //       }
        //     }
        //   }
        //   for(let cbc of cosco_bl_cons) {
        //     if(cbc.allot_depot) {
        //       let bl = await tb_bl.findOne({
        //         where: {
        //           invoice_masterbi_id: cbc.bl_id
        //         }
        //       })
        //       if(bl) {
        //         bl.invoice_masterbi_do_return_depot = cbc.allot_depot
        //         await bl.save()
        //       }
        //     }
        //   }
        //   for(let obc of oocl_bl_cons) {
        //     if(obc.allot_depot) {
        //       let bl = await tb_bl.findOne({
        //         where: {
        //           invoice_masterbi_id: obc.bl_id
        //         }
        //       })
        //       if(bl) {
        //         bl.invoice_masterbi_do_return_depot = obc.allot_depot
        //         await bl.save()
        //       }
        //     }
        //   }
        }
      }
    }
  }
}

exports.handleCarrierAllotDepot = async (bl_cons, depot_rules, total_count, special_cons) => {
  if(bl_cons && bl_cons.length > 0 && depot_rules && depot_rules.length > 0) {
    for(let cre of depot_rules) {
      cre.allot_count = 0
      let limit_count = parseInt(total_count * cre.depot_percent / 100)
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
      for(let c of bl_cons) {
        if((c.bl_return_depot && c.bl_return_depot === cre.depot_name) || (c.allot_return_depot && c.allot_return_depot === cre.depot_name)) {
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
            for(let c of bl_cons) {
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
            for(let c of bl_cons) {
              if(!c.bl_return_depot && !c.allot_return_depot && detail_con_types.indexOf(c.invoice_containers_size) < 0) {
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
          if(diff_limit_count > 0) {
            cre.diff_limit_count = diff_limit_count
          }
        } else {
          // 按顺序提取对应数量箱子，设置堆场
          for(let c of bl_cons) {
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
    for(let c of bl_cons) {
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