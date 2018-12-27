const db = require('../../app/db')

module.exports = db.defineModel('tbl_zhongtan_port', {
  port_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  port_country: {
    type: db.STRING(30),
    defaultValue: '',
    allowNull: true
  },
  port_name: {
    type: db.STRING(20),
    unique: true,
    allowNull: false
  },
  port_name_cn: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  port_code: {
    type: db.STRING(20),
    unique: true,
    allowNull: false
  }
})
