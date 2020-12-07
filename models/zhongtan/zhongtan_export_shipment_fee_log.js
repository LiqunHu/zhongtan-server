const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_export_shipment_fee_log', {
  shipment_fee_log_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  shipment_fee_id: {
    type: db.STRING(20),
    allowNull: false
  },
  export_masterbl_id: {
    type: db.STRING(20),
    allowNull: false
  },
  shipment_fee_status_pre: {
    type: db.STRING(10),
    allowNull: false
  },
  shipment_fee_status: {
    type: db.STRING(10),
    allowNull: false
  },
  shipment_fee_amount_pre: {
    type: db.STRING(50),
    allowNull: false
  },
  shipment_fee_amount: {
    type: db.STRING(50),
    allowNull: false
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
  }
})
