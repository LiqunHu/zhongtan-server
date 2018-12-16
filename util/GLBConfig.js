module.exports = {
  INITPASSWORD: '123456',
  REDISKEY: {
    AUTH: 'REDISKEYAUTH',
    SMS: 'REDISKEYSMS'
  },
  MTYPE_ROOT: '00',
  MTYPE_LEAF: '01',
  MTYPEINFO: [
    {
      id: '00',
      text: '目录'
    },
    {
      id: '01',
      text: '菜单'
    }
  ],
  NODETYPEINFO: [
    {
      id: '00',
      text: '根'
    },
    {
      id: '01',
      text: '叶子'
    }
  ],
  DOMAIN_ADMINISTRATOR: '0',
  TYPE_DEFAULT: '00',
  TYPE_ADMINISTRATOR: '01',
  TYPE_OPERATOR: '02',
  AUTH: '1',
  NOAUTH: '0',
  AUTHINFO: [
    {
      id: '1',
      text: '需要授权'
    },
    {
      id: '0',
      text: '无需授权'
    }
  ],
  ENABLE: '1',
  DISABLE: '0',
  STATUSINFO: [
    {
      id: '1',
      text: '有效'
    },
    {
      id: '0',
      text: '无效'
    }
  ],
  TRUE: '1',
  FALSE: '0',
  TFINFO: [
    {
      id: '1',
      text: '是'
    },
    {
      id: '0',
      text: '否'
    }
  ],
  PackageUnitINFO: [
    {
      id: 'BAG',
      text: 'BAG'
    }
  ],
  VolumeUnitINFO: [
    {
      id: 'M3',
      text: 'M3'
    }
  ],
  WeightUnitINFO: [
    {
      id: 'KG',
      text: 'KG'
    }
  ],
  ContainerSizeINFO: [{ id: '20', text: '20' }, { id: '40', text: '40' }, { id: '45', text: '45' }],
  ContainerTypeINFO: [
    { id: 'GP', text: 'GP' },
    { id: 'HC', text: 'HC' },
    { id: 'HT', text: 'HT' },
    { id: 'OT', text: 'OT' },
    { id: 'PF', text: 'PF' },
    { id: 'RF', text: 'RF' },
    { id: 'RH', text: 'RH' },
    { id: 'TK', text: 'TK' },
    { id: 'FR', text: 'FR' }
  ],
  PayTypeINFO: [{ id: 'Prepaid', text: 'Prepaid' }, { id: 'Collect', text: 'Collect' }],
  PayCurrencyINFO: [{ id: 'CY', text: 'CY' }, { id: 'CFS', text: 'CFS' }],
  VesselServiceINFO: [{ id: 'EAX1', text: 'EAX1' }, { id: 'EAX2', text: 'EAX2' }, { id: 'EAX4', text: 'EAX4' }],
  PortCountryINFO: [{ id: 'TZ', text: 'TZ' }, { id: 'CN', text: 'CN' }, { id: 'SIN', text: 'SIN' }],
  BLSTATUS_PRE_BOOKING: 'PBK',
  BLSTATUS_BOOKING: 'BK',
  BLSTATUS_PUTBOX_APPLY: 'PA',
  BLSTATUS_PUTBOX_CONFIRM: 'PC',
  BLSTATUS_SUBMIT_LOADING: 'SL',
  BLSTATUS_REJECT_LOADING: 'RL',
  BLSTATUS_DECLARATION: 'DE',
  BLSTATUS_CONFIRM_INSTRUCTUON: 'CI',
  BLSTATUS_CDS_PROCESSING: 'CP',
  BLSTATUS_BILL_LADING: 'BL',
  BLSTATUSINFO: [
    { id: 'PBK', text: 'Pre-Booking', style: 'label-default' },
    { id: 'BK', text: 'Booking', style: 'label-booking' },
    { id: 'PA', text: 'Putbox Apply', style: 'label-putbox-apply' },
    { id: 'PC', text: 'Putbox Confirm', style: 'label-putbox-confirm' },
    { id: 'SL', text: 'Submit Loading', style: 'label-submit-loading' },
    { id: 'RL', text: 'Reject Loading', style: 'label-reject-loading' },
    { id: 'DE', text: 'Declaration', style: 'label-declaration' },
    { id: 'CI', text: 'Shipping Instruction', style: 'label-confirm-instruction' },
    { id: 'CP', text: 'CDS Processing', style: 'label-cds-processing' },
    { id: 'BL', text: 'Bill Lading', style: 'label-bill-lading' }
  ]
}
