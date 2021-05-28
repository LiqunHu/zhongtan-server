const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_payment_verification', {
  payment_verification_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_advice_id: {
    // 支付ID
    type: db.STRING(20),
    allowNull: false
  },
  payment_verification_state: {
    // 审核状态
    type: db.STRING(5),
    allowNull: false
  },
  payment_verification_create_user: {
    // 创建人
    type: db.STRING(50),
    allowNull: false
  },
  payment_verification_business_user: {
    // 商务审核人
    type: db.STRING(50),
    allowNull: true
  },
  payment_verification_business_time: {
    // 商务审核时间
    type: db.DATE,
    allowNull: true
  },
  payment_verification_manager_user: {
    // 经理审核人
    type: db.STRING(50),
    allowNull: true
  },
  payment_verification_manager_time: {
    // 经理审核时间
    type: db.DATE,
    allowNull: true
  },
  payment_verification_undo_user: {
    // 回退人
    type: db.STRING(50),
    allowNull: true
  },
  payment_verification_undo_time: {
    // 回退时间
    type: db.DATE,
    allowNull: true
  }
})
