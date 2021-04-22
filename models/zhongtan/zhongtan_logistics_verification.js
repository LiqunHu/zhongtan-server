const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_logistics_verification', {
  logistics_verification_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  logistics_verification_vendor: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_verification_business_type: {
    type: db.STRING(20),
    allowNull: false
  },
  logistics_verification_cntr_owner: {
    type: db.STRING(20),
    allowNull: false
  },
  logistics_verification_cargo_type: {
    type: db.STRING(20),
    allowNull: false
  },
  logistics_verification_api_name: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_verification_state: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_verification_amount: {
    type: db.STRING(20),
    allowNull: false
  },
  logistics_verification_create_user: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_verification_business_user: {
    type: db.STRING(50),
    allowNull: true
  },
  logistics_verification_business_time: {
    type: db.DATE,
    allowNull: true
  },
  logistics_verification_manager_user: {
    type: db.STRING(50),
    allowNull: true
  },
  logistics_verification_manager_time: {
    type: db.DATE,
    allowNull: true
  },
  logistics_verification_undo_user: {
    type: db.STRING(50),
    allowNull: true
  },
  logistics_verification_undo_time: {
    type: db.DATE,
    allowNull: true
  }
})
