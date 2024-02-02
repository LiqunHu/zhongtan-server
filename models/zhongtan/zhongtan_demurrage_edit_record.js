const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_demurrage_edit_record', {
  demurrage_edit_record_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  demurrage_container_business_type: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_from: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_id: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  demurrage_container_bl: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_no: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_out: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_in: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_use: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_free: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_overdue: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_amount: {
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_container_operator: {
    type: db.STRING(50),
    allowNull: true
  }
})
