module.exports = {
  INITPASSWORD: '123456',
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
  TYPE_EMPLOYEE: '02',
  TYPE_CUSTOMER: '03',
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
      text: 'valid'
    },
    {
      id: '0',
      text: 'invalid'
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
  YNINFO: [
    {
      id: 'Y',
      text: 'Y'
    },
    {
      id: 'N',
      text: 'N'
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
  VesselServiceINFO: [{ id: 'ALL', text: 'ALL' }, { id: 'EAX1', text: 'EAX1' }, { id: 'EAX2', text: 'EAX2' }, { id: 'EAX4', text: 'EAX4' }],
  PortCountryINFO: [{ id: 'TZ', text: 'TZ' }, { id: 'CN', text: 'CN' }, { id: 'SIN', text: 'SIN' }],
  BLSTATUS_PRE_BOOKING: 'PBK',
  BLSTATUS_BOOKING: 'BK',
  BLSTATUS_PUTBOX_APPLY: 'PA',
  BLSTATUS_PUTBOX_CONFIRM: 'PC',
  BLSTATUS_SUBMIT_LOADING: 'SL',
  BLSTATUS_REJECT_LOADING: 'RL',
  BLSTATUS_SUBMIT_CUSTOMS: 'SC',
  BLSTATUS_FEEDBACK_DECLARE: 'FD',
  BLSTATUS_CLEARANCE_APPROVAL: 'CA',
  BLSTATUS_LOADING_PERMISSION: 'LP',
  BLSTATUS_SHIPPING_INSTRUCTION: 'SI',
  BLSTATUS_CDS_PROCESSING: 'CP',
  BLSTATUS_FEEDBACK_BLDRAFT: 'FBD',
  BLSTATUS_SUBMIT_BILLLADING: 'SBL',
  BLSTATUS_REJECT_BILLLADING: 'RBL',
  BLSTATUS_APPROVE_BILLLADING: 'ABL',
  BLSTATUSINFO: [
    { id: 'PBK', text: 'Pre-Booking', style: 'label-default' },
    { id: 'BK', text: 'Booking', style: 'label-booking' },
    { id: 'PA', text: 'Pick Up Empty', style: 'label-pickup-apply' },
    { id: 'PC', text: 'Pick Up Confirm', style: 'label-pickup-confirm' },
    { id: 'SL', text: 'Submit Loading', style: 'label-submit-loading' },
    { id: 'RL', text: 'Reject Loading', style: 'label-reject-loading' },
    { id: 'SC', text: 'Submit Customs', style: 'label-submit-customs' },
    { id: 'FD', text: 'Feedback Declare', style: 'label-feedback-declare' },
    { id: 'CA', text: 'Declaration Approval', style: 'label-clearance-approval' },
    { id: 'LP', text: 'Loading Permission', style: 'label-loading-permission' },
    { id: 'SI', text: 'Shipping Instruction', style: 'label-shipping-instruction' },
    { id: 'CP', text: 'CDS Processing', style: 'label-cds-processing' },
    { id: 'FBD', text: 'Feedback BL Draft', style: 'label-feedback-bl-draft' },
    { id: 'SBL', text: 'Submit Bill Of Lading', style: 'label-submit-billlading' },
    { id: 'RBL', text: 'Reject Bill Of Lading', style: 'label-reject-billlading' },
    { id: 'ABL', text: 'Approve Bill Of Lading', style: 'label-approve-billlading' }
  ],
  LB_BATCH_STATE: [{ id: '0', text: 'Unused' }, { id: '1', text: 'Used' }, { id: '2', text: 'Cancel' }]
}
