const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_unusual_verification', {
  unusual_verification_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  unusual_invoice_id: {
    type: db.STRING(20),
    allowNull: false
  },
  unusual_verification_state: {
    type: db.STRING(20),
    allowNull: false
  },
  unusual_verification_create_user: {
    type: db.STRING(50),
    allowNull: false
  },
  unusual_verification_commercial_user: {
    type: db.STRING(20),
    allowNull: true
  },
  unusual_verification_commercial_time: {
    type: db.DATE,
    allowNull: true
  },
  unusual_verification_undo_user: {
    type: db.STRING(20),
    allowNull: true
  },
  unusual_verification_undo_time: {
    type: db.DATE,
    allowNull: true
  }
})
