const db = require('../../util/db')

module.exports = db.defineModel('tbl_zhongtan_portinfo', {
  portinfo_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  portinfo_country: {
    type: db.STRING(30),
    defaultValue: '',
    allowNull: true
  },
  portinfo_name: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  portinfo_name_cn: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  portinfo_code: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
})
