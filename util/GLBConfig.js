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
  ContainerSizeINFO: [
    { id: '20', text: '20' },
    { id: '40', text: '40' },
    { id: '45', text: '45' }
  ],
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
  PayTypeINFO: [
    { id: 'Prepaid', text: 'Prepaid' },
    { id: 'Collect', text: 'Collect' }
  ],
  PayStatusINFO: [
    { id: 'CY', text: 'CY' },
    { id: 'CFS', text: 'CFS' }
  ],
  PortCountryINFO: [
    { id: 'TZ', text: 'TZ' },
    { id: 'CN', text: 'CN' },
    { id: 'SIN', text: 'SIN' }
  ],
  BLSTATUS_PRE_BOOKING: '1',
  BLSTATUSINFO: [
    {id:'1', text: 'Pre-Booking', style: 'label-default'}
  ]
}
