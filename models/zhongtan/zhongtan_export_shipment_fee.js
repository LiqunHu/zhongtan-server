const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_export_shipment_fee', {
  shipment_fee_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_masterbl_id: {
    type: db.STRING(20),
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

// 本表 export_masterbl_id 在库里是 VARCHAR(20)，而主表 tbl_zhongtan_export_proforma_masterbl
// 的同名字段是 BIGINT。业务代码大量用数字作为条件，Sequelize 4 会原样拼成 `= 17545`，
// MySQL 就会把字符串列隐式转换成数字再比较，导致 index1(export_masterbl_id) 失效，
// 每次查询退化成 15 万行全表扫描（实测约 100ms/次，30 条提单的页面累计 3 秒以上）。
// 这里统一把 where 里的数字转成字符串，生成 `= '17545'`，保证能走索引。
module.exports.addHook('beforeFind', options => {
  if (!options || !options.where || typeof options.where !== 'object') {
    return
  }
  const val = options.where.export_masterbl_id
  if (typeof val === 'number') {
    options.where.export_masterbl_id = String(val)
  }
})
