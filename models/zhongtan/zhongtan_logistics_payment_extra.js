const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_logistics_payment_extra', {
  payment_extra_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_extra_bl_no: {
    // 提单号
    type: db.STRING(50),
    allowNull: false
  },
  payment_extra_shipment_id: {
    // 关联shipment list id
    type: db.STRING(20),
    allowNull: false
  },
  payment_extra_vendor: {
    // 箱号
    type: db.STRING(50),
    allowNull: false
  },
  payment_extra_cntr_owner: {
    // 持箱人
    type: db.STRING(50),
    allowNull: false
  },
  payment_extra_cargo_type: {
    // 本地，过境
    type: db.STRING(20),
    allowNull: false
  },
  payment_extra_business_type: {
    // 业务类别
    type: db.STRING(20),
    allowNull: false
  },
  payment_extra_amount_usd: {
    // 额外费用美元
    type: db.STRING(20),
    allowNull: true
  },
  payment_extra_amount_tzs: {
    // 额外费用先令
    type: db.STRING(20),
    allowNull: true
  },
  payment_extra_status: {
    // 状态
    type: db.STRING(20),
    defaultValue: '6',
    allowNull: false
  },
  payment_extra_created_by: {
    // 创建人
    type: db.STRING(50),
    allowNull: false
  },
  payment_extra_type: {
    // 额外费用类别
    type: db.STRING(20),
    defaultValue: 'P',
    allowNull: false
  }
})
