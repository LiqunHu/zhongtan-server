const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_logistics_shipment_list', {
  shipment_list_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  shipment_list_bill_no: {
    // 提单号
    type: db.STRING(50),
    allowNull: false
  },
  shipment_list_cargo_type: {
    // 本地，过境
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_cntr_owner: {
    // 持箱人
    type: db.STRING(50),
    allowNull: false
  },
  shipment_list_size_type: {
    // 箱型尺寸
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_business_type: {
    // 业务类别
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_port_of_destination: {
    // 卸港
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_discharge_date: {
    // 进口卸船日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_depot_gate_out_date: {
    // 出口出场日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_port_of_loading: {
    // 装港
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_dar_customs_release_date: {
    // 客户确认日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_truck_departure_date: {
    // 出车日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_truck_plate: {
    // 车牌号
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_ata_destination: {
    // 目的地
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_delivery_date: {
    // 交付日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_empty_return_date: {
    // 进口还箱日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_loading_date: {
    // 出口 COSCO进场/OOCL装船日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_vendor: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_remark: {
    type: db.STRING(200),
    allowNull: true
  },
  shipment_list_cargo_weight: {
    // 单箱货重
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_ata_tz_border: {
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_ata_foreing_border: {
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_border_release_date: {
    // 
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_payment_status: {
    // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  shipment_list_total_freight: {
    // 总运费金额USD
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_total_freight_tzs: {
    // 总运费金额TZS
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_advance_payment: {
    // 预付
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_advance_percent: {
    // 预付比例
    type: db.STRING(10),
    allowNull: true
  },
  shipment_list_advance_payment_date: {
    // 预付支付日期
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_balance_payment: {
    // 余款
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_balance_payment_date: {
    // 余款支付日期
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_extra_charges_usd: {
    // 额外费用美元合计
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_extra_charges_usd_date: {
    // 额外费用美元最后支付日期
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_extra_charges_tzs: {
    // 额外费用先令合计
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_extra_charges_tzs_date: {
    // 额外费用先令最后支付日期
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_customer: {
    // 受瞟客户
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_extra_customer: {
    // 额外费用客户
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_receivable_status: {
    // 应收状态
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  shipment_list_receivable_freight: {
    // 应收运费
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_freight_invoice: {
    // 应收运费发票
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_freight_receipt: {
    // 应收运费收据
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_usd: {
    // 额外应收美元合计
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_tzs: {
    // 额外应收先令合计
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_usd_invoice: {
    // 额外应收美元最后开票时间
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_usd_receipt: {
    // 额外应收美元最后收据时间
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_tzs_invoice: {
    // 额外应收先令最后开票时间
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_receivable_extra_tzs_receipt: {
    // 额外应收先令最后收据时间
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_vessel_ata: {
    // 进口开港
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_vessel_etd: {
    // 出口截港
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_vessel_name: {
    // 船名
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_vessel_voyage: {
    // 航次
    type: db.STRING(50),
    allowNull: true
  }
})
