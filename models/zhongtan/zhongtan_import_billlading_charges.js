const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_billlading_charges', {
  import_billlading_charges_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_billlading_id: {
    type: db.IDNO,
    allowNull: false
  },
  import_billlading_charges_type: {
    // type
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_description: {
    // description
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_basis: {
    // basis
    type: db.STRING(30),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_rate: {
    // rate
    type: db.STRING(30),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_pc: {
    // pc indicator
    type: db.STRING(30),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_ttl_ame: {
    // ttl ame
    type: db.STRING(30),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_pay_loc: {
    // pay local
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_charges_currency: {
    // currency
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  }
})
