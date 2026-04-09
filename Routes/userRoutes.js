import express from 'express';
import { 
    registerUser,
     loginUser, 
     getUser, 
     createProfile, 
     editProfileImage, 
     getProfile,
     verifyMobile,
     resetPassword,
     updateUserLocation,
     getNearestPharmaciesByUser,
     addToCart,
     getCart,
     removeFromCart,
     addAddress,
     getAddresses,
     createBookingFromCart,
     getMyBookings,
     getPreviousOrders,
     removeDeliveredOrder,
     getNotifications,
     cancelOrder,
     getSinglePreviousOrder,
     updateUser,
     createQuery,
     sendPrescription,
     getPrescriptionsForUser,
     getUserOrderStatuses,
     reorderDeliveredOrder,
     togglePeriodicMedsPlan,
     createPeriodicOrders,
     sendPrescriptionToAdmin,
     getUserPeriodicOrders,
     sendMessage,
     getChatHistory,
     generateAndUploadInvoice,
     cancelPeriodicOrder,
     deleteAccount,
     confirmDeleteAccount,
     deleteUser,
     deleteNotification,
     bulkDeleteNotifications,
     respondToPrescriptionQuote,
     getPrescriptionQuoteDetails
    } from '../Controller/UserController.js'; // Import UserController
const router = express.Router();

// Registration Route
router.post('/register', registerUser);

// Login Route
router.post('/login', loginUser);
// Get user details (GET)
router.get('/get-user/:userId', getUser);  // Adding a middleware to verify JWT token

// Update user details (PUT)
// Create a new profile with Form Data (including profile image)
router.post('/create-profile/:id', createProfile);  // Profile creation with userId in params

// Edit the user profile by userId
router.put('/edit-profile/:userId', editProfileImage);  // Profile editing by userId

// Get the user profile by userId
router.get('/get-profile/:id', getProfile);  // Get profile by userId
router.post('/verify', verifyMobile);  // Get profile by userId
router.post('/reset-password', resetPassword);  // Get profile by userId
router.post('/add-location', updateUserLocation);  // Get profile by userId
router.get('/nearbypharmacy/:userId', getNearestPharmaciesByUser);
router.post('/addtocart/:userId', addToCart);
router.delete('/removeitemfromcart/:userId/:medicineId', removeFromCart);
router.get('/getcart/:userId', getCart);
router.post('/addaddress/:userId', addAddress);
router.get('/getmyaddress/:userId', getAddresses);
router.post('/create-booking/:userId', createBookingFromCart);
router.get('/mybookings/:userId', getMyBookings);
router.get('/mypreviousbookings/:userId', getPreviousOrders);
router.delete('/deleteorders/:userId/:orderId', removeDeliveredOrder);
router.get('/notifications/:userId', getNotifications);
router.put("/cancelorder/:userId/:orderId", cancelOrder);
router.get("/singlepreviousorder/:userId/:orderId", getSinglePreviousOrder);
router.put("/updateuser/:userId", updateUser);
router.post("/addquery", createQuery);
router.post("/sendprescriptions/:userId/:pharmacyId", sendPrescription);
router.get("/userprescriptions/:userId", getPrescriptionsForUser);
router.get("/order-status/:userId", getUserOrderStatuses);
router.post('/reorder/:userId/:orderId', reorderDeliveredOrder);
router.put("/periodicmedsplan/:userId", togglePeriodicMedsPlan);
router.post('/periodic-order/:userId', createPeriodicOrders);
router.post("/sendprescription/:userId/:pharmacyId", sendPrescriptionToAdmin);
router.get("/preodicorders/:userId", getUserPeriodicOrders);
router.post('/sendMessage/:userId/:riderId', sendMessage);
router.get('/getChatHistory/:userId/:riderId', getChatHistory);
router.get('/generate-invoice/:userId/:orderId', generateAndUploadInvoice);
router.put("/cancelpreodicorder/:userId/:orderId", cancelPeriodicOrder);

router.post('/deleteaccount', deleteAccount)
router.get('/confirm-delete-account/:token', confirmDeleteAccount);
router.delete('/delete-user/:userId', deleteUser);
router.delete('/:userId/notifications/:notificationId', deleteNotification);
router.delete('/:userId/notifications/bulk', bulkDeleteNotifications);



router.post('/users/:userId/prescription/:prescriptionId/respond', respondToPrescriptionQuote);
router.get('/prescription/:userId/:prescriptionId/quote', getPrescriptionQuoteDetails);





















export default router;
