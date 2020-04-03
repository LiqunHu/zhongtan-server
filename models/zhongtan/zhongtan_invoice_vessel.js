const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_vessel', {
  invoice_vessel_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_vessel_name: {
    // VESSEL NAME
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_code: {
    // VESSEL CODE
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_voyage: {
    // VOYAGE NUM
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_eta: {
    // ETA
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_ata: {
    // ATA
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_atd: {
    // ATD
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_vessel_call_sign: {
    // 呼号
    type: db.STRING(20),
    allowNull: true
  }
})
