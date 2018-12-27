const express = require('express')
const services = require('./service')
const router = express.Router()

// zhongtan
router.post('/configuration/PortConfig/:method', services.PortConfigControl)
// router.post('/configuration/VesselConfig/:method', services.VesselConfigSRV.VessleConfigResource)
// router.post('/configuration/VoyageConfig/:method', services.VoyageConfigSRV.VoyageConfigResource)
// router.post('/export/Booking/:method', services.BookingSRV.BookingResource)
// router.post('/export/BookingWork/:method', services.BookingWorkSRV.BookingWorkResource)

router.post('/web/SailSchedule/:method', services.SailScheduleControl)
router.post('/web/WebConfig/:method', services.WebConfigControl)
router.post('/web/Web/:method', services.WebControl)

module.exports = router
