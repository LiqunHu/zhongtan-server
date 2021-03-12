const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_shipinfo', {
  import_shipinfo_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_shipinfo_vessel_code: {
    // vessel code
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_shipinfo_vessel_name: {
    // voyage name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_business_type: {
    type: db.STRING(5),
    defaultValue: 'I',
    allowNull: false
  }
})
