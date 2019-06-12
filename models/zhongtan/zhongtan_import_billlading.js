const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_billlading', {
  import_billlading_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_billlading_customer_id: {
    type: db.UUID,
    defaultValue: '',
    allowNull: false
  },
  import_billlading_srv_code: {
    // service code
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_srv_name: {
    // service name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_vessel_code: {
    // vessel code
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_vessel_name: {
    // vessel name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_voyage: {
    // voyage code
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_por: {
    // PLACE OF RECEIPT
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_pod: {
    // PORT OF DISCHARGE
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_pol: {
    // PORT OF LOAD
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_fnd: {
    // PLACE OF DELIVERY
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_flag: {
    // SHIP FLAG
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_no: {
    // BLNUMBER
    type: db.STRING(80),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_cso_no: {
    // cso_no
    type: db.STRING(40),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_cso_no1: {
    // cso_no1
    type: db.STRING(80),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_shipper: {
    // shipper
    type: db.STRING(400),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_consignee: {
    // consignee
    type: db.STRING(400),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_notify_party: {
    // notify party
    type: db.STRING(400),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_also_notify_party: {
    // alse notify party
    type: db.STRING(400),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_ocean_freight_rate: {
    // ocean freight rate
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_ocean_freight_pc: {
    // pc indicator
    type: db.STRING(2),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_ocean_freight_ttl_ame: {
    // ttl ame
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_ocean_freight_currency: {
    // currency
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_ocean_freight_pay_loc: {
    // pay local
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_packno: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_unit: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_gross_weight_kg: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_gross_weight_lb: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_volume_cbm: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_total_volume_cft: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_remark: {
    type: db.STRING(3000),
    defaultValue: '',
    allowNull: false
  }
})
