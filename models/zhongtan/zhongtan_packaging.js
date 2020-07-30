const db = require('../../app/db')

module.exports = db.defineModel('tbl_zhongtan_packaging', {
  packaging_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  packaging_kind: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  packaging_kind_ak: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  packaging_code: {
    type: db.STRING(20),
    unique: true,
    allowNull: false
  }
})
