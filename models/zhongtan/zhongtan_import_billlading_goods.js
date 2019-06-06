const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_billlading_goods', {
  import_billlading_goods_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_billlading_id: {
    type: db.IDNO,
    allowNull: false
  },
  import_billlading_goods_description: {
    // description
    type: db.STRING(3000),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_package_number: {
    // package number
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_package_unit: {
    // package unit
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_gross_weight_kg: {
    // gross weight kg
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_gross_weight_lb: {
    // gross weight lb
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_volume_cbm: {
    // volume cbm
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_volume_cft: {
    // volume cft
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_goods_marks_num: {
    // marks
    type: db.STRING(500),
    defaultValue: '',
    allowNull: false
  }
})
