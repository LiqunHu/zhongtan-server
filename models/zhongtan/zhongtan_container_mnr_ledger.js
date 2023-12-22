const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_container_mnr_ledger', {
  container_mnr_ledger_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  mnr_ledger_container_no_id: {
    // VESSEL NAME
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_vessel_id: {
    // VESSEL NAME
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_vessel_name: {
    // VESSEL NAME
    type: db.STRING(100),
    allowNull: true
  },
  mnr_ledger_vessel_voyage: {
    // VESSEL NAME
    type: db.STRING(50),
    allowNull: true
  },
  mnr_ledger_vessel_ata: {
    // VESSEL NAME
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_bl: {
    // VESSEL CODE
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_container_no: {
    // VOYAGE NUM
    type: db.STRING(50),
    allowNull: false
  },
  mnr_ledger_container_size: {
    type: db.STRING(20),
    allowNull: false
  },
  mnr_ledger_dv_amount: {
    // 集装箱残值
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_actual_charge_amount: {
    // 实际收取金额
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_loss_declaring_date: {
    // 全损申报时间
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_corresponding_payer_id: {
    type: db.STRING(50),
    allowNull: true
  },
  mnr_ledger_corresponding_payer: {
    // 付费方
    type: db.STRING(100),
    allowNull: true
  },
  mnr_ledger_payment_date: {
    // 付款日期
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_termination: {
    // 是否已结束
    type: db.STRING(200),
    allowNull: true
  },
  mnr_ledger_check_cash: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_check_no: {
    type: db.STRING(200),
    allowNull: true
  },
  mnr_ledger_bank_reference_no: {
    type: db.STRING(200),
    allowNull: true
  },
  mnr_ledger_invoice_amount: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_invoice_date: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_invoice_no: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_receipt_amount: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_receipt_date: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_receipt_no: {
    // 收据号
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_reedit_flg: {
    type: db.STRING(2),
    allowNull: true
  },
  mnr_ledger_description: {
    type: db.STRING(50),
    allowNull: true
  },
  mnr_ledger_destination: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_cargo_type: {
    type: db.STRING(20),
    allowNull: true
  },
  mnr_ledger_bank_info: {
    type: db.STRING(20),
    allowNull: true
  },
})
