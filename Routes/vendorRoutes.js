import express from 'express';
import { addBankAccount, addBankDetails, addPharmacyByVendorId, createMedicine, createOrderFromPrescription, createVendorQuery, deleteBankAccount, deleteMedicineByVendor, deleteNotificationForVendor, deleteOrder, editBankDetails, editMedicineByVendor, getAllMedicinesByVendor, getAllNotificationsForVendor, getAllOrdersByVendor, getAllPeriodicOrdersByVendor, getBankAccounts, getCategoriesByVendorId, getDeliveredOrdersByVendor, getMessagesForVendor, getPendingOrdersByVendor, getPrescriptionOrdersByVendor, getPrescriptionsForVendor, getVendorDashboard, getVendorProfile, getVendorQueries, getVendorWallet, getWithdrawalRequests, requestWithdrawal, updateBankAccount, updateOrderStatusByVendor, updatePrescriptionStatus, updateVendorProfile, updateVendorStatus, vendorLogin, vendorLogout,
    sendPrescriptionQuote,getPendingPrescriptionsForVendor
 } from '../Controller/VendorController.js';
import { getAllPreodicOrders } from '../Controller/AdminControler.js';

const router = express.Router();

// Vendor login route
router.post('/login', vendorLogin);
router.post('/addpharmacy/:vendorId', addPharmacyByVendorId);
router.get('/categories/:vendorId', getCategoriesByVendorId);
router.post('/addmedicine/:vendorId', createMedicine);
router.get('/medicines/:vendorId', getAllMedicinesByVendor);
router.put('/updatemedicines/:vendorId/:medicineId', editMedicineByVendor);
router.delete('/deletemedicines/:vendorId/:medicineId', deleteMedicineByVendor);
router.get('/orders/:vendorId', getAllOrdersByVendor);
router.get('/dashboard/:vendorId', getVendorDashboard);
router.put("/orderstatus/:vendorId/:orderId", updateOrderStatusByVendor);
router.get('/getvendorprofile/:vendorId', getVendorProfile);
router.put('/updatevendorprofile/:vendorId', updateVendorProfile);
router.post('/logout', vendorLogout);
router.get('/getmessages/:vendorId', getMessagesForVendor);
router.put('/updatestatus/:vendorId', updateVendorStatus);
router.post('/addbankdetails/:vendorId', addBankDetails);
router.put('/editbankdetails/:vendorId/:bankDetailId', editBankDetails);
router.get("/getprescriptions/:vendorId", getPrescriptionsForVendor);
router.get('/pendingorders/:vendorId', getPendingOrdersByVendor);
router.get('/deliveredorders/:vendorId', getDeliveredOrdersByVendor);
router.post('/createOrderFromPrescription/:prescriptionId/:vendorId/:userId', createOrderFromPrescription);
router.patch('/updatePrescriptionStatus/:prescriptionId', updatePrescriptionStatus);
router.get('/periodicorders/:vendorId', getAllPeriodicOrdersByVendor);
router.get('/getPrescriptionOrdersByVendor/:vendorId', getPrescriptionOrdersByVendor);
router.post('/create-query/:vendorId', createVendorQuery);
router.get('/myqueries/:vendorId', getVendorQueries);
router.get('/notifications/:vendorId', getAllNotificationsForVendor);
router.delete("/deletenotification/:vendorId/:notificationId", deleteNotificationForVendor);
router.delete('/orders/:orderId', deleteOrder);
router.get('/getwallet/:vendorId', getVendorWallet);


// Bank account routes
router.post('/add-account/:vendorId', addBankAccount);
router.get('/accounts/:vendorId', getBankAccounts);
router.put('/accounts/:vendorId/:accountId', updateBankAccount);
router.delete('/accounts/:vendorId/:accountId', deleteBankAccount);

// Withdrawal routes
router.post('/withdraw/:vendorId', requestWithdrawal);
router.get('/withdrawals/:vendorId', getWithdrawalRequests);
router.post('/:vendorId/prescription/:prescriptionId/send-quote', sendPrescriptionQuote);
router.get('/:vendorId/prescriptions/pending', getPendingPrescriptionsForVendor);



export default router;
