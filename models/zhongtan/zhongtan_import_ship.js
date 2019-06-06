const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_ship', {
  import_ship_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_ship_srv_main: {
    // service code
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_ship_vessel_main: {
    // vessel code
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_ship_voyage_main: {
    // voyage code
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
