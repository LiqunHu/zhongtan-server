const _ = require('lodash')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_payment_items = model.zhongtan_payment_items
const tb_payment_item_code = model.zhongtan_payment_item_code
const tb_payment_code_carrier = model.zhongtan_payment_item_code_carrier

exports.initAct = async () => {
  let returnData = {}
  returnData.PAYMENT_ITEM_TYPE = GLBConfig.PAYMENT_ITEM_TYPE
  let queryStr = `SELECT user_id, user_name, user_bank_account_usd, user_bank_account_tzs FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData.COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_payment_items where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (payment_items_code like ? or payment_items_name like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data
  let rows = []

  queryStr = `SELECT user_id, user_name, user_bank_account_usd, user_bank_account_tzs FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  let COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)

  for(let d of result.data) {
    let item = JSON.parse(JSON.stringify(d))
    item._expanded = true
    if(d.payment_items_type) {
      let type = _.find(GLBConfig.PAYMENT_ITEM_TYPE, function(o) { return o.id === d.payment_items_type})
      if(type) {
        item.payment_items_type_name = type.text
      }

      let item_codes = await tb_payment_item_code.findAll({
        where: {
          payment_item_code: d.payment_items_code,
          state: GLBConfig.ENABLE
        }
      })
      if(item_codes && item_codes.length > 0) {
        item.item_code_payable_debit_1 = item_codes[0].item_code_payable_debit
        item.item_code_payable_credit = item_codes[0].item_code_payable_credit
        item.item_code_payment_debit = item_codes[0].item_code_payment_debit
        item.item_code_payment_credit = item_codes[0].item_code_payment_credit
        let item_carriers_1 = await tb_payment_code_carrier.findAll({
          where: {
            payment_item_code: d.payment_items_code,
            item_code_id: item_codes[0].item_code_id,
            state: GLBConfig.ENABLE
          }
        })
        if(item_carriers_1 && item_carriers_1.length > 0) {
          let carriers = []
          let carrier_names = []
          for(let ic of item_carriers_1) {
            carriers.push(ic.item_code_carrier)
            let carrier = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === ic.item_code_carrier})
            if(carrier) {
              carrier_names.push(carrier.user_name)
            }
          }
          item.item_code_payable_debit_carrier_1 = carriers
          item.item_code_payable_debit_carrier_name_1 = carrier_names
        } else {
          item.item_code_payable_debit_carrier_1 = []
          item.item_code_payable_debit_carrier_name_1 = []
        }
        if(item_codes.length > 1) {
          item.item_code_payable_debit_2 = item_codes[1].item_code_payable_debit
          item.item_code_payable_debit_carrier_2 = []
          item.item_code_payable_debit_carrier_name_2 = []

          let item_carriers_2 = await tb_payment_code_carrier.findAll({
            where: {
              payment_item_code: d.payment_items_code,
              item_code_id: item_codes[1].item_code_id,
              state: GLBConfig.ENABLE
            }
          })
          if(item_carriers_2 && item_carriers_2.length > 0) {
            let carriers = []
            let carrier_names = []
            for(let ic of item_carriers_2) {
              carriers.push(ic.item_code_carrier)
              let carrier = _.find(COMMON_CUSTOMER, function(o) { return o.user_id === ic.item_code_carrier})
            if(carrier) {
              carrier_names.push(carrier.user_name)
            }
            }
            item.item_code_payable_debit_carrier_2 = carriers
            item.item_code_payable_debit_carrier_name_2 = carrier_names
          }
        }
      }
    }
    rows.push(item)
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let addObj = await tb_payment_items.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ payment_items_code: doc.payment_items_code }, { payment_items_name: doc.payment_items_name }]
    }
  })
  if (addObj) {
    return common.error('discharge_port_02')
  }

  let obj = await tb_payment_items.create({
    payment_items_code: doc.payment_items_code,
    payment_items_name: doc.payment_items_name,
    payment_items_type: doc.payment_items_type
  })

  if(doc.item_code_payable_debit_1 && doc.item_code_payable_credit && doc.item_code_payment_credit) {
    let item_code = await tb_payment_item_code.create({
      payment_item_code: obj.payment_items_code,
      item_code_payable_debit: doc.item_code_payable_debit_1,
      item_code_payable_credit: doc.item_code_payable_credit,
      item_code_payment_debit: doc.item_code_payment_debit,
      item_code_payment_credit: doc.item_code_payment_credit
    })
    if(doc.item_code_payable_debit_carrier_1 && doc.item_code_payable_debit_carrier_1.length > 0) {
      for(let c of doc.item_code_payable_debit_carrier_1) {
        await tb_payment_code_carrier.create({
          payment_item_code: obj.payment_items_code,
          item_code_id: item_code.item_code_id,
          item_code_carrier: c
        })
      }
    }
  }
  if(doc.item_code_payable_debit_2) {
    let item_code = await tb_payment_item_code.create({
      payment_item_code: obj.payment_items_code,
      item_code_payable_debit: doc.item_code_payable_debit_2,
      item_code_payable_credit: doc.item_code_payable_credit,
      item_code_payment_debit: doc.item_code_payment_debit,
      item_code_payment_credit: doc.item_code_payment_credit
    })
    if(doc.item_code_payable_debit_carrier_2 && doc.item_code_payable_debit_carrier_2.length > 0) {
      for(let c of doc.item_code_payable_debit_carrier_2) {
        await tb_payment_code_carrier.create({
          payment_item_code: obj.payment_items_code,
          item_code_id: item_code.item_code_id,
          item_code_carrier: c
        })
      }
    }
  }
  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_payment_items.findOne({
    where: {
      payment_items_id: doc.old.payment_items_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_payment_items.findOne({
      where: {
        payment_items_id: {[Op.ne]: doc.old.payment_items_id},
        [Op.or]: [{ payment_items_code: doc.new.payment_items_code }, { payment_items_name: doc.new.payment_items_name }]
      }
    })
    if (updateObj) {
      return common.error('discharge_port_02')
    }

    obj.payment_items_code = doc.new.payment_items_code
    obj.payment_items_name = doc.new.payment_items_name
    obj.payment_items_type = doc.new.payment_items_type
    await obj.save()

    let item_codes = await tb_payment_item_code.findAll({
      where: {
        payment_item_code: obj.payment_items_code,
        state: GLBConfig.ENABLE
      }
    })
    if(item_codes && item_codes.length > 0) {
      for(let ic of item_codes) {
        ic.state = GLBConfig.DISABLE
        await ic.save()
      }
      let item_carriers_1 = await tb_payment_code_carrier.findAll({
        where: {
          payment_item_code: obj.payment_items_code,
          item_code_id: item_codes[0].item_code_id,
          state: GLBConfig.ENABLE
        }
      })
      if(item_carriers_1 && item_carriers_1.length > 0) {
        for(let ic of item_carriers_1) {
          ic.state = GLBConfig.DISABLE
          await ic.save()
        }
      }

      if(item_codes.length > 1) {
        let item_carriers_2 = await tb_payment_code_carrier.findAll({
          where: {
            payment_item_code: obj.payment_items_code,
            item_code_id: item_codes[1].item_code_id,
            state: GLBConfig.ENABLE
          }
        })
        if(item_carriers_2 && item_carriers_2.length > 0) {
          for(let ic of item_carriers_2) {
            ic.state = GLBConfig.DISABLE
            await ic.save()
          }
        }
      }
    }
    if(doc.new.item_code_payable_debit_1 && doc.new.item_code_payable_credit && doc.new.item_code_payment_credit) {
      let item_code = await tb_payment_item_code.create({
        payment_item_code: obj.payment_items_code,
        item_code_payable_debit: doc.new.item_code_payable_debit_1,
        item_code_payable_credit: doc.new.item_code_payable_credit,
        item_code_payment_debit: doc.new.item_code_payment_debit,
        item_code_payment_credit: doc.new.item_code_payment_credit
      })
      if(doc.new.item_code_payable_debit_carrier_1 && doc.new.item_code_payable_debit_carrier_1.length > 0) {
        for(let c of doc.new.item_code_payable_debit_carrier_1) {
          await tb_payment_code_carrier.create({
            payment_item_code: obj.payment_items_code,
            item_code_id: item_code.item_code_id,
            item_code_carrier: c
          })
        }
      }
    }
    if(doc.new.item_code_payable_debit_2) {
      let item_code = await tb_payment_item_code.create({
        payment_item_code: obj.payment_items_code,
        item_code_payable_debit: doc.new.item_code_payable_debit_2,
        item_code_payable_credit: doc.new.item_code_payable_credit,
        item_code_payment_debit: doc.new.item_code_payment_debit,
        item_code_payment_credit: doc.new.item_code_payment_credit
      })
      if(doc.new.item_code_payable_debit_carrier_2 && doc.new.item_code_payable_debit_carrier_2.length > 0) {
        for(let c of doc.new.item_code_payable_debit_carrier_2) {
          await tb_payment_code_carrier.create({
            payment_item_code: obj.payment_items_code,
            item_code_id: item_code.item_code_id,
            item_code_carrier: c
          })
        }
      }
    }
    return common.success(obj)
  } else {
    return common.error('discharge_port_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_payment_items.findOne({
    where: {
      payment_items_id: doc.payment_items_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

    let item_codes = await tb_payment_item_code.findAll({
      where: {
        payment_item_code: obj.payment_items_code,
        state: GLBConfig.ENABLE
      }
    })
    if(item_codes && item_codes.length > 0) {
      for(let ic of item_codes) {
        ic.state = GLBConfig.DISABLE
        await ic.save()
      }
      let item_carriers_1 = await tb_payment_code_carrier.findAll({
        where: {
          payment_item_code: obj.payment_items_code,
          item_code_id: item_codes[0].payment_items_id,
          state: GLBConfig.ENABLE
        }
      })
      if(item_carriers_1 && item_carriers_1.length > 0) {
        for(let ic of item_carriers_1) {
          ic.state = GLBConfig.DISABLE
          await ic.save()
        }
      }

      if(item_codes.length > 1) {
        let item_carriers_2 = await tb_payment_code_carrier.findAll({
          where: {
            payment_item_code: obj.payment_items_code,
            item_code_id: item_codes[1].payment_items_id,
            state: GLBConfig.ENABLE
          }
        })
        if(item_carriers_2 && item_carriers_2.length > 0) {
          for(let ic of item_carriers_2) {
            ic.state = GLBConfig.DISABLE
            await ic.save()
          }
        }
      }
    }
  } else {
    return common.error('discharge_port_01')
  }
}
