const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_proforma_container', {
  export_container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_container_bl: {
    // 提单信息
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: true
  },
  export_seal_no: {
    // 封号
    type: db.STRING(20),
    allowNull: true
  },
  export_container_soc_type: {
    // SOC
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_size_type: {
    // 箱型箱类
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_package: {
    // 包装数
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_package_unit: {
    // 包装类型
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_weight: {
    // 货重
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_weight_unit: {
    // 货重单位
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_volumn: {
    // 体积
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_volumn_unit: {
    // 体积单位
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_edi_loading_date: {
    // 装船船日期
    type: db.STRING(20),
    allowNull: true
  },
  export_container_edi_depot_gate_out_date: {
    // 堆场出场时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_edi_wharf_gate_in_date: {
    // 码头进场时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_get_depot_name: {
    // 提箱堆场
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_free_days: {
    // 计算免箱天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_demurrage_days: {
    // 计算滞期天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_demurrage_amount: {
    // 计算滞期费
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_storing_days: {
    // 计算堆存天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_payty: {
    // 收费应收对象
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_time: {
    // 计算发票时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_release_time: {
    // 计算发票审核时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_days: {
    // 计算发票滞期天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_amount: {
    // 计算发票金额
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_receipt_time: {
    // 计算收据时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_receipt_release_time: {
    // 计算收据审核时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_receipt_days: {
    // 计算收据超期天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_receipt_amount: {
    // 计算收据金额
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_demurrage_deduction: {
    // 计算滞期费减免金额
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_reset: {
    // 重新计算发票
    type: db.STRING(20),
    allowNull: true
  },
  export_container_edi_storing_days: {
    // edi堆存天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_current_demurrage_days: {
    // 当天滞期天数
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_invoice_date: {
    // 最新发票日期
    type: db.STRING(20),
    allowNull: true
  },
  export_container_cal_receipt_date: {
    // 最新收据日期
    type: db.STRING(20),
    allowNull: true
  }
})
