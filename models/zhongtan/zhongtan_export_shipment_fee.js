const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_export_shipment_fee', {
  shipment_fee_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  // 与主表 tbl_zhongtan_export_proforma_masterbl.export_masterbl_id 保持同一类型。
  // 库里已由 VARCHAR(20) 改为 BIGINT，模型必须同步，否则非 production 环境跑
  // initscript/init-db.js 时 sync({alter: true}) 会按旧的 STRING(20) 把列改回去。
  export_masterbl_id: {
    type: db.IDNO,
    allowNull: false
  },
  fee_data_code: {
    type: db.STRING(20),
    allowNull: false
  },
  fee_data_fixed: {
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: true
  },
  shipment_fee_supplement: {
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: true
  },
  shipment_fee_type: {
    type: db.STRING(10),
    allowNull: false
  },
  shipment_fee_party: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_fixed_amount: {
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: true
  },
  shipment_fee_amount: {
    type: db.STRING(20),
    allowNull: true
  },
  shipment_fee_currency: {
    type: db.STRING(20),
    allowNull: true
  },
  shipment_fee_status: {
    type: db.STRING(10),
    allowNull: false
  },
  shipment_fee_save_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_save_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_submit_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_submit_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_undo_by: {
    type: db.STRING(20),
    allowNull: true
  },
  shipment_fee_undo_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_undo_remark: {
    type: db.STRING(200),
    allowNull: true
  },
  shipment_fee_approve_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_approve_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_decline_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_decline_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_decline_remark: {
    type: db.STRING(200),
    allowNull: true
  },
  shipment_fee_invoice_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_invoice_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_invoice_id: {
    type: db.STRING(20),
    allowNull: true
  },
  shipment_fee_invoice_no: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_receipt_by: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_fee_receipt_at: {
    type: db.DATE,
    allowNull: true
  },
  shipment_fee_receipt_id: {
    type: db.STRING(20),
    allowNull: true
  },
  shipment_fee_receipt_no: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_import: {
    // shipment list 导入
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  }
})

// 历史问题：本表 export_masterbl_id 原为 VARCHAR(20)，主表同名字段为 BIGINT，业务用数字
// 作条件时生成 `= 17545`，MySQL 把字符串列隐式转数字比较，index1 失效退化成 15 万行全表扫。
// 现已把列类型统一为 BIGINT（模型也同步为 db.IDNO），本钩子保留作为兼容层：
// 生成 `= '17545'` 时 MySQL 会把常量转成数字，索引照走，不影响性能。
// 待线上稳定运行一段时间后，可与各处显式 String() 一并清理。
module.exports.addHook('beforeFind', options => {
  if (!options || !options.where || typeof options.where !== 'object') {
    return
  }
  const val = options.where.export_masterbl_id
  if (typeof val === 'number') {
    options.where.export_masterbl_id = String(val)
  }
})
