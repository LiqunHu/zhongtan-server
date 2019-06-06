const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_billlading_sumcharges', {
  import_billlading_sumcharges_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_billlading_id: {
    type: db.IDNO,
    allowNull: false
  },
  import_billlading_sumcharges_pc: {
    // pc indicator
    type: db.STRING(2),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_sumcharges_currency: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_sumcharges_amt: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
