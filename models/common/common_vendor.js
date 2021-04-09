/* 用户表 */
const db = require('../../app/db')

module.exports = db.defineModel('tbl_common_vendor', {
  vendor_id: {
    type: db.UUID,
    defaultValue: db.UUIDV1,
    primaryKey: true
  },
  vendor_code: {
    type: db.STRING(20),
    allowNull: false
  },
  vendor_name: {
    type: db.STRING(50),
    allowNull: false
  },
  vendor_email: {
    type: db.STRING(100),
    allowNull: true
  },
  vendor_phone: {
    type: db.STRING(100),
    allowNull: true
  },
  vendor_address: {
    type: db.STRING(200),
    allowNull: true
  },
  vendor_bank_name: {
    type: db.STRING(50),
    allowNull: true
  },
  vendor_bank_account: {
    type: db.STRING(50),
    allowNull: true
  },
  vendor_bank_address: {
    type: db.STRING(200),
    allowNull: true
  },
  vendor_swift_code: {
    type: db.STRING(50),
    allowNull: true
  }
})
