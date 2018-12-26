const express = require('express')
const services = require('./service')
const router = express.Router()

// zhongtan
router.post('/configuration/PortConfig/:method', services.PortConfigControl)
// router.post('/configuration/VesselConfig/:method', services.VesselConfigSRV.VessleConfigResource)
// router.post('/configuration/VoyageConfig/:method', services.VoyageConfigSRV.VoyageConfigResource)
// router.post('/export/Booking/:method', services.BookingSRV.BookingResource)
// router.post('/export/BookingWork/:method', services.BookingWorkSRV.BookingWorkResource)
// router.post('/web/WebControl/:method', services.WebControlSRV.WebControlResource)
// router.post('/web/SailScheduleControl/:method', services.SailScheduleControlSRV.SailScheduleControlResource)
// router.post('/web/Web/:method', services.WebSRV.WebResource)

module.exports = router