const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_discharge_port', {
  discharge_port_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  discharge_port_code: {
    // 目的港代码
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  discharge_port_name: {
    // 目的港名称
    type: db.STRING(20),
    allowNull: false
  }
})
