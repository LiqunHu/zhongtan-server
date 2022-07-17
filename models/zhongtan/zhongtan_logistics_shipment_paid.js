const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_logistics_shipment_paid', {
  logistics_paid_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  shipment_list_id: {
    // 关联ID
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  logistics_paid_status: {
    // 支付状态
    type: db.STRING(10),
    allowNull: false,
    defaultValue: '0'
  },
  logistics_paid_created_by: {
    // 创建人
    type: db.STRING(50),
    allowNull: true
  }
})
