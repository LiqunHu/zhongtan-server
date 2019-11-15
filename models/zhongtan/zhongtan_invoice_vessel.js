const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_vessel', {
  invoice_vessel_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_vessel_mrn: {
    // mrn
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_name: {
    // vessel name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_call_sign: {
    // call sign
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_voyage: {
    // voyage
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_departure_date: {
    // Departure Date
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_arrival_date: {
    // Arrival Date
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_tpa_uid: {
    // TPA UID
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
