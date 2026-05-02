import User from '../Models/User.js'
import Order from '../Models/Order.js'
import mongoose from 'mongoose';
import Admin from '../Models/Admin.js';
import cloudinary from '../config/cloudinary.js';
import Rider from '../Models/Rider.js';
import Ad from '../Models/Ad.js';
import Query from '../Models/Query.js';
import Prescription from '../Models/Prescription.js';
import { Notification } from '../Models/Notification.js';
import Pharmacy from '../Models/Pharmacy.js';
import Banner from '../Models/Banner.js';
import withdrawalRequestModel from '../Models/withdrawalRequestModel.js';
import Medicine from '../Models/Medicine.js';
import Message from '../Models/Message.js';
import Faq from '../Models/Faq.js';
import Coupon from '../Models/Coupon.js';
import VendorWithdrawal from '../Models/VendorWithdrawal.js';



export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 🔍 Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // 📧 Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already registered with this email' });
    }

    // ❌ No hashing
    const newAdmin = new Admin({ name, email, password });

    await newAdmin.save();

    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        createdAt: newAdmin.createdAt
      }
    });

  } catch (error) {
    console.error('Register Admin Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🛡️ Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // 🔍 Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // 🔓 Plaintext password check
    if (admin.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Return success (no token)
    return res.status(200).json({
      message: 'Login successful',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });

  } catch (error) {
    console.error('Login Admin Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const updateOrderStatus = async (req, res) => {
  const { userId, orderId } = req.params;
  const { status, message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: 'Invalid user or order ID' });
  }

  if (!status || !message) {
    return res.status(400).json({ message: 'Status and message are required' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId) {
      return res.status(404).json({ message: 'Order not found for this user' });
    }

    order.status = status;
    order.statusTimeline.push({
      status,
      message,
      timestamp: new Date()
    });

    await order.save();

    // ✅ Admin notification — matches your schema exactly
    const adminNotification = new Notification({
      type: 'Order',               // ✅ valid enum value
      referenceId: order._id,      // ✅ references the order
      message: `Order ${status}: ${message}`,
      status: 'Pending',
    });
    await adminNotification.save();

    // ✅ Push to user's notifications array (for user app)
    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          orderId: order._id,
          status,
          message,
          timestamp: new Date(),
          read: false
        }
      }
    });

    return res.status(200).json({
      message: 'Order status updated and notification sent',
      status,
      orderId
    });

  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get All Users
// Get All Users with Addresses
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found!' });
    }

    // Format each user with address
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      aadhaarCardNumber: user.aadhaarCardNumber,
      profileImage: user.profileImage || 'https://img.freepik.com/premium-vector/student-avatar-illustration-user-profile-icon-youth-avatar_118339-4406.jpg?w=2000',
      addresses: user.myAddresses || [],
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return res.status(200).json({
      message: 'All users retrieved successfully!',
      users: formattedUsers
    });

  } catch (error) {
    console.error('Get All Users Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const getSingleUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Fetch orders for this user and populate nested fields
    const orders = await Order.find({ userId: user._id })
      .populate({
        path: 'orderItems.medicineId',
        populate: { path: 'pharmacyId', select: 'name' }
      })
      .populate('assignedRider');

    // Format orders array
    const formattedOrders = orders.map(order => ({
      id: order._id,
      deliveryAddress: order.deliveryAddress,
      orderItems: order.orderItems.map(item => ({
        id: item._id,
        name: item.medicineId?.name || "N/A",
        pharmacyName: item.medicineId?.pharmacyId?.name || "N/A",
        quantity: item.quantity,
        price: item.medicineId?.price || 0,
        total: (item.medicineId?.price || 0) * (item.quantity || 1),
      })),
      statusTimeline: order.statusTimeline.map(status => ({
        status: status.status,
        message: status.message,
        timestamp: status.timestamp,
      })),
      totalAmount: order.totalAmount,
      notes: order.notes,
      voiceNoteUrl: order.voiceNoteUrl,
      paymentMethod: order.paymentMethod,
      status: order.status,
      assignedRider: order.assignedRider
        ? {
          id: order.assignedRider._id,
          name: order.assignedRider.name,
          phone: order.assignedRider.phone,
          email: order.assignedRider.email,
          location: order.assignedRider.location,  // assuming location field exists
        }
        : null,
      assignedRiderStatus: order.assignedRiderStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    // Format user data as before
    const formattedUser = {
      id: user._id,
      name: user.name,
      email: user.email || null,
      mobile: user.mobile,
      code: user.code || null,
      status: user.status || null,
      profileImage:
        user.profileImage ||
        "https://img.freepik.com/premium-vector/student-avatar-illustration-user-profile-icon-youth-avatar_118339-4406.jpg?w=2000",
      location: user.location || { type: "Point", coordinates: [0, 0] },
      addresses: user.myAddresses?.map(addr => ({
        id: addr._id,
        house: addr.house,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        country: addr.country,
      })) || [],
      notifications: user.notifications?.map(note => ({
        id: note._id,
        orderId: note.orderId,
        status: note.status,
        message: note.message,
        timestamp: note.timestamp,
        read: note.read,
      })) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      orders: formattedOrders,
    };

    return res.status(200).json({
      message: "User details with orders retrieved successfully!",
      user: formattedUser,
    });
  } catch (error) {
    console.error("Get Single User Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updateUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const updateData = req.body; // { status: "inactive" }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    return res.status(200).json({
      message: 'User updated successfully!',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update User Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// Delete User by ID
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find user and delete
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    return res.status(200).json({ message: 'User deleted successfully!' });
  } catch (error) {
    console.error('Delete User Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const getAllOrders = async (req, res) => {
  try {
    // Fetch all orders, latest first
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      });

    return res.status(200).json({
      message: "All orders fetched successfully",
      totalOrders: orders.length,
      orders
    });

  } catch (error) {
    console.error("Get All Orders Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const getPrescriptionOrders = async (req, res) => {
  try {
    // Fetch all prescription orders, where isPrescriptionOrder is true, latest first
    const orders = await Order.find({ isPrescriptionOrder: true })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      });

    return res.status(200).json({
      message: "All prescription orders fetched successfully",
      totalOrders: orders.length,
      orders
    });

  } catch (error) {
    console.error("Get Prescription Orders Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};





// Get Today's Orders Only
export const getTodaysOrders = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Today at 00:00:00

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // Today at 23:59:59

    // Fetch only today's orders
    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      });

    return res.status(200).json({
      message: "All orders fetched successfully",
      totalOrders: orders.length,
      orders
    });

  } catch (error) {
    console.error("Get Today's Orders Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};




// Get All Cancelled Orders
export const getCancelledOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: "Cancelled" })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      });

    return res.status(200).json({
      message: "All orders fetched successfully",
      totalOrders: orders.length,
      orders
    });

  } catch (error) {
    console.error("Get Cancelled Orders Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};






// Get all Active Pharmacies (including password)
// Get all Active Pharmacies
export const getActivePharmacies = async (req, res) => {
  try {
    const activePharmacies = await Pharmacy.find({ status: "Active" });

    return res.status(200).json({
      message: "Active pharmacies fetched successfully",
      total: activePharmacies.length,
      pharmacies: activePharmacies,
    });
  } catch (error) {
    console.error("Error fetching active pharmacies:", error);
    return res.status(500).json({
      message: "Server error while fetching active pharmacies",
      error: error.message,
    });
  }
};



// Controller for fetching all inactive pharmacies
export const getInactivePharmacies = async (req, res) => {
  try {
    // Fetch pharmacies with 'Inactive' status
    const inactivePharmacies = await Pharmacy.find({ status: "Inactive" });

    // If no inactive pharmacies found, return an appropriate message
    if (!inactivePharmacies || inactivePharmacies.length === 0) {
      return res.status(200).json({
        message: "No inactive pharmacies found",
      });
    }

    return res.status(200).json({
      message: "Inactive pharmacies fetched successfully",
      total: inactivePharmacies.length,
      pharmacies: inactivePharmacies,
    });
  } catch (error) {
    console.error("Error fetching inactive pharmacies:", error);
    return res.status(500).json({
      message: "Server error while fetching inactive pharmacies",
      error: error.message,
    });
  }
};





export const getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find order by ID and populate user, medicines, pharmacy, and rider
    const order = await Order.findById(orderId)
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .populate({
        path: "orderItems.medicineId",
        select: "name price images description categoryName pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name location"
        }
      })
      .populate({
        path: "assignedRider",
        select: "name phone email latitude longitude profileImage"
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Convert to object to modify
    const orderObj = order.toObject();

    // ✅ Format order items with proper price extraction
    if (orderObj.orderItems && orderObj.orderItems.length > 0) {
      orderObj.orderItems = orderObj.orderItems.map(item => ({
        _id: item._id,
        medicineId: item.medicineId?._id,
        name: item.medicineId?.name || "Medicine not found",
        price: item.medicineId?.price || 0,  // ✅ Extract price from populated medicine
        quantity: item.quantity,
        totalPrice: (item.medicineId?.price || 0) * (item.quantity || 0),
        images: item.medicineId?.images || [],
        description: item.medicineId?.description || "",
        categoryName: item.medicineId?.categoryName || "",
        pharmacy: item.medicineId?.pharmacyId ? {
          id: item.medicineId.pharmacyId._id,
          name: item.medicineId.pharmacyId.name,
          location: item.medicineId.pharmacyId.location
        } : null
      }));
    }

    // Check if order is cancelled in timeline but might have pending reassignment
    const isActuallyCancelled = orderObj.status === "Cancelled";
    const hasReassignedInTimeline = orderObj.statusTimeline?.some(
      timeline => timeline.status === "Reassigned"
    );
    
    // If order is cancelled but has reassignment, it might be in process
    if (isActuallyCancelled && hasReassignedInTimeline) {
      // Check if there are any pending pharmacy responses
      const hasPendingResponse = orderObj.pharmacyResponses?.some(
        response => response.status === "Pending"
      );
      
      // If there's a pending response, order is not really cancelled
      if (hasPendingResponse) {
        orderObj.status = "Pending";
        orderObj.pharmacyResponse = "Pending";
      }
    }

    // Check pharmacy responses status for pending orders
    if (orderObj.status === "Pending" && orderObj.pharmacyResponses && orderObj.pharmacyResponses.length > 0) {
      // Check if any pharmacy has accepted
      const hasAccepted = orderObj.pharmacyResponses.some(
        response => response.status === "Accepted"
      );
      
      // Check if any pharmacy is still pending
      const hasPending = orderObj.pharmacyResponses.some(
        response => response.status === "Pending"
      );
      
      // Check if all pharmacies have rejected
      const allRejected = orderObj.pharmacyResponses.every(
        response => response.status === "Rejected"
      );

      if (hasAccepted) {
        // If any pharmacy accepted, show as Accepted
        orderObj.status = "Accepted";
      } else if (allRejected) {
        // Only show Cancelled if ALL pharmacies rejected AND no pending reassignment
        // Check if there are any other active pharmacies available in the system
        const medicineIds = orderObj.orderItems.map(item => item.medicineId?._id).filter(id => id);
        
        let otherPharmaciesExist = false;
        
        if (medicineIds.length > 0) {
          // Check if there are other active pharmacies with these medicines
          const otherPharmacies = await Pharmacy.find({
            _id: { $nin: orderObj.rejectedPharmacies || [] },
            status: "Active",
            products: { $in: medicineIds }
          }).limit(1);
          
          otherPharmaciesExist = otherPharmacies.length > 0;
        } else {
          // Check if there are any other active pharmacies
          const otherPharmacies = await Pharmacy.find({
            _id: { $nin: orderObj.rejectedPharmacies || [] },
            status: "Active"
          }).limit(1);
          
          otherPharmaciesExist = otherPharmacies.length > 0;
        }
        
        // Show Cancelled only if no other pharmacies available
        if (!otherPharmaciesExist) {
          orderObj.status = "Cancelled";
        } else {
          // Keep as Pending if reassignment is possible
          orderObj.status = "Pending";
        }
      } else if (hasPending) {
        // If some are pending, show as Pending
        orderObj.status = "Pending";
      }
    }

    // ✅ Also calculate subtotal and total if not present
    if (!orderObj.subtotal && orderObj.orderItems) {
      orderObj.subtotal = orderObj.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // Return with original structure, just status possibly modified
    return res.status(200).json({
      message: "Order fetched successfully",
      order: orderObj
    });

  } catch (error) {
    console.error("Get Single Order Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find and delete the order
    const deletedOrder = await Order.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json({
      message: "Order deleted successfully",
      deletedOrder
    });

  } catch (error) {
    console.error("Delete Order Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const logoutAdmin = async (req, res) => {
  try {
    // If using sessions in future: req.session.destroy()
    // If using tokens: you can blacklist the token (not needed here)

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout Admin Error:', error);
    return res.status(500).json({ message: 'Server error during logout' });
  }
};



// 🔹 Update User Status by Admin
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // active, inactive, suspended etc.

    // check status field
    if (!status) {
      return res.status(400).json({
        message: "Status field is required",
      });
    }

    // update user
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User status updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};



// 📌 Get All Payments (from Orders)
export const getAllPayments = async (req, res) => {
  try {
    // Fetch all orders where paymentMethod exists (means payment info available)
    const payments = await Order.find(
      { paymentMethod: { $exists: true, $ne: null } } // sirf unhi orders ko jo payment method ke sath hain
    )
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name mobile email profileImage"
      })
      .select("userId totalAmount paymentMethod status createdAt updatedAt");
    // sirf payment-related fields select kiye

    return res.status(200).json({
      message: "All payments fetched successfully",
      totalPayments: payments.length,
      payments
    });

  } catch (error) {
    console.error("Get All Payments Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const createRider = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      pinCode,
      latitude,
      longitude,
      deliveryCharge,
      status = "online",
    } = req.body;

    // =========================
    // 🔴 BASIC VALIDATION
    // =========================
    if (!name || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, and address are required",
      });
    }

    // =========================
    // 🔴 DUPLICATE VALIDATION
    // =========================
    const existingRider = await Rider.findOne({
      $or: [{ phone }, { email }],
    });

    if (existingRider) {
      return res.status(400).json({
        success: false,
        message:
          existingRider.phone === phone
            ? "Rider already exists with this phone number"
            : "Rider already exists with this email",
      });
    }

    // =========================
    // 🔴 LAT / LNG VALIDATION
    // =========================
    if (latitude && isNaN(latitude)) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be a valid number",
      });
    }

    if (longitude && isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be a valid number",
      });
    }

    // =========================
    // 🔴 DELIVERY CHARGE VALIDATION
    // =========================
    if (deliveryCharge && isNaN(deliveryCharge)) {
      return res.status(400).json({
        success: false,
        message: "Delivery charge must be a valid number",
      });
    }

    // =========================
    // 📸 UPLOAD PROFILE IMAGE
    // =========================
    let profileImageUrl = "";
    if (req.files?.profileImage) {
      const uploaded = await cloudinary.uploader.upload(
        req.files.profileImage.tempFilePath,
        { folder: "riders/profile" }
      );
      profileImageUrl = uploaded.secure_url;
    }

    // =========================
    // 🚲 UPLOAD RIDE IMAGES
    // =========================
    let rideImageUrls = [];
    if (req.files?.rideImages) {
      const rideFiles = Array.isArray(req.files.rideImages)
        ? req.files.rideImages
        : [req.files.rideImages];

      for (let file of rideFiles) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: "riders/vehicles",
        });
        rideImageUrls.push(uploaded.secure_url);
      }
    }

    // =========================
    // 🔐 RANDOM 4-DIGIT PASSWORD
    // =========================
    const password = Math.floor(1000 + Math.random() * 9000).toString();

    // =========================
    // ✅ CREATE RIDER
    // =========================
    const rider = new Rider({
      name,
      email,
      phone,
      address,
      city,
      state,
      pinCode,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      profileImage: profileImageUrl,
      rideImages: rideImageUrls,
      deliveryCharge: deliveryCharge ? parseFloat(deliveryCharge) : 0,
      password,
      status,
    });

    await rider.save();

    return res.status(201).json({
      success: true,
      message: "Rider created successfully",
      rider,
    });
  } catch (error) {
    console.error("Create Rider Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const updateRider = async (req, res) => {
  try {
    const { riderId } = req.params;
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      pinCode,
      latitude,
      longitude,
      deliveryCharge,
      drivingLicenseStatus,
      status, // New status field to update
    } = req.body;

    // Check if rider exists
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Update fields
    rider.name = name || rider.name;
    rider.email = email || rider.email;
    rider.phone = phone || rider.phone;
    rider.address = address || rider.address;
    rider.city = city || rider.city;
    rider.state = state || rider.state;
    rider.pinCode = pinCode || rider.pinCode;
    rider.drivingLicenseStatus = drivingLicenseStatus || rider.drivingLicenseStatus,
      rider.latitude = latitude ? parseFloat(latitude) : rider.latitude;
    rider.longitude = longitude ? parseFloat(longitude) : rider.longitude;
    rider.deliveryCharge = deliveryCharge ? parseFloat(deliveryCharge) : rider.deliveryCharge;

    // Update status only if provided and valid
    if (status && ["online", "offline"].includes(status)) {
      rider.status = status;
    }

    // Handle profile image update
    if (req.files?.profileImage) {
      const uploadedProfileImage = await cloudinary.uploader.upload(req.files.profileImage.tempFilePath, {
        folder: 'riders/profile',
      });
      rider.profileImage = uploadedProfileImage.secure_url;
    }

    // Handle ride images update
    if (req.files?.rideImages) {
      const rideFiles = Array.isArray(req.files.rideImages)
        ? req.files.rideImages
        : [req.files.rideImages];

      let rideImageUrls = [];
      for (let file of rideFiles) {
        const uploadedRideImage = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'riders/vehicles',
        });
        rideImageUrls.push(uploadedRideImage.secure_url);
      }
      rider.rideImages = rideImageUrls;
    }

    // Save updated rider
    await rider.save();

    return res.status(200).json({
      message: "Rider updated successfully",
      rider,
    });
  } catch (error) {
    console.error("Update Rider Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const deleteRider = async (req, res) => {
  try {
    const { riderId } = req.params;

    // 🌟 Find and delete rider
    const rider = await Rider.findByIdAndDelete(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Rider deleted successfully",
    });
  } catch (error) {
    console.error("Delete Rider Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};






export const getAllRiders = async (req, res) => {
  try {
    const riders = await Rider.find().sort({ createdAt: -1 });

    const enrichedRiders = await Promise.all(
      riders.map(async (rider) => {
        const totalAssigned = await Order.countDocuments({ assignedRider: rider._id });
        const totalCompleted = await Order.countDocuments({
          assignedRider: rider._id,
          assignedRiderStatus: "Completed"
        });

        return {
          _id: rider._id,
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          password: rider.password,
          wallet: rider.wallet || 0,
          deliveryCharge: rider.deliveryCharge || 0,
          totalOrdersAssigned: totalAssigned,
          totalOrdersCompleted: totalCompleted,
          profileImage: rider.profileImage,
          rideImages: rider.rideImages,
          address: rider.address,
          city: rider.city,
          state: rider.state,
          pinCode: rider.pinCode,
          status: rider.status,
          drivingLicenseStatus: rider.drivingLicenseStatus,
          drivingLicense: rider.drivingLicense,
          baseFare: rider.baseFare,
          accountDetails: rider.accountDetails || [],
          createdAt: rider.createdAt,
          additionalChargePerKm:rider.additionalChargePerKm,
          baseDistanceKm:rider.baseDistanceKm
        };
      })
    );

    res.status(200).json({
      message: "All riders with order stats and bank details fetched successfully",
      total: enrichedRiders.length,
      riders: enrichedRiders,
    });

  } catch (error) {
    console.error("Error in getAllRiders:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const getOnlineRiders = async (req, res) => {
  try {
    // Find only online riders
    const riders = await Rider.find({ status: "online" }).sort({ createdAt: -1 });

    // Enrich with order stats
    const enrichedRiders = await Promise.all(
      riders.map(async (rider) => {
        const totalAssigned = await Order.countDocuments({ assignedRider: rider._id });
        const totalCompleted = await Order.countDocuments({
          assignedRider: rider._id,
          assignedRiderStatus: "Completed"
        });

        return {
          _id: rider._id,
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          password: rider.password,
          wallet: rider.wallet || 0,
          deliveryCharge: rider.deliveryCharge || 0,
          totalOrdersAssigned: totalAssigned,
          totalOrdersCompleted: totalCompleted,
          profileImage: rider.profileImage,
          rideImages: rider.rideImages,
          address: rider.address,
          city: rider.city,
          state: rider.state,
          pinCode: rider.pinCode,
          status: rider.status,
          drivingLicenseStatus: rider.drivingLicenseStatus,
          drivingLicense: rider.drivingLicense,
          accountDetails: rider.accountDetails || [],
          createdAt: rider.createdAt,
        };
      })
    );

    res.status(200).json({
      message: "Online riders with order stats and bank details fetched successfully",
      total: enrichedRiders.length,
      riders: enrichedRiders,
    });

  } catch (error) {
    console.error("Error in getOnlineRiders:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// Create Ad
export const createAd = async (req, res) => {
  try {
    const { title, link } = req.body;

    if (!title || !link) {
      return res.status(400).json({ message: "Title and link are required" });
    }

    let imageUrl = "";

    // 📤 Upload image to Cloudinary
    if (req.files?.image) {
      const uploaded = await cloudinary.uploader.upload(
        req.files.image.tempFilePath,
        { folder: "ads" }
      );
      imageUrl = uploaded.secure_url;
    } else if (req.body.image?.startsWith("http")) {
      // agar frontend se direct URL aaya ho
      imageUrl = req.body.image;
    } else {
      return res.status(400).json({ message: "Ad image is required" });
    }

    // 🛠️ Create Ad
    const ad = new Ad({
      title,
      link,
      image: imageUrl,
    });

    await ad.save();

    return res.status(201).json({
      message: "Ad created successfully",
      ad,
    });
  } catch (error) {
    console.error("Create Ad Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// Get All Ads
export const getAllAds = async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json({ message: "All ads fetched successfully", total: ads.length, ads });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Single Ad
export const getAdById = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    res.json(ad);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Update Ad
export const updateAd = async (req, res) => {
  try {
    const { title, link, status } = req.body;
    let updateData = { title, link, status };

    if (req.file?.path) updateData.image = req.file.path;

    const ad = await Ad.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!ad) return res.status(404).json({ message: "Ad not found" });

    res.json({ message: "Ad updated successfully", ad });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete Ad
export const deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    res.json({ message: "Ad deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


// ✅ Get all queries
export const getAllQueries = async (req, res) => {
  try {
    const queries = await Query.find().sort({ createdAt: -1 });
    res.status(200).json(queries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching queries", error });
  }
};


// Controller to get all queries for riders (admin access)
export const getRiderQueries = async (req, res) => {
  try {
    // Fetch all queries where riderId exists and sort by creation date
    const queries = await Query.find({ riderId: { $exists: true } }).sort({ createdAt: -1 });

    // If no queries are found for riders
    if (!queries || queries.length === 0) {
      return res.status(404).json({ message: "No queries found for any rider" });
    }

    // Send the list of rider-related queries
    res.status(200).json(queries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching rider queries", error });
  }
};




// ✅ Update query status
export const updateQueryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const query = await Query.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!query) {
      return res.status(404).json({ message: "Query not found" });
    }

    res.status(200).json({ message: "Query status updated", query });
  } catch (error) {
    res.status(500).json({ message: "Error updating query", error });
  }
};

// ✅ Delete query
export const deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const query = await Query.findByIdAndDelete(id);

    if (!query) {
      return res.status(404).json({ message: "Query not found" });
    }

    res.status(200).json({ message: "Query deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting query", error });
  }
};


// ✅ Get All Prescriptions for Admin
// 🌟 Get All Prescriptions (with user info populated)
export const getAllPrescriptionsForAdmin = async (req, res) => {
  try {
    const prescriptions = await Prescription.find()
      .populate("userId", "name email") // only include user's name & email
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("Get All Prescriptions Error:", error);
    res.status(500).json({
      message: "Error fetching prescriptions",
      error: error.message,
    });
  }
};


// ✅ Delete Prescription (Admin)
export const deletePrescriptionForAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Prescription id is required in params" });
    }

    const deleted = await Prescription.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    res.status(200).json({
      message: "Prescription deleted successfully",
      prescription: deleted,
    });
  } catch (error) {
    console.error("Delete Prescription Error:", error);
    res.status(500).json({ message: "Error deleting prescription", error: error.message });
  }
};


export const getAllNotifications = async (req, res) => {
  try {
    // ✅ Fetch all — schema has no userId field so all are admin notifications
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .lean();

    const formattedNotifications = notifications.map(notification => ({
      _id: notification._id,
      title: `Order Update`,
      body: notification.message,
      type: notification.type,
      referenceId: notification.referenceId,
      message: notification.message,
      status: notification.status,
      read: notification.status === 'Seen',
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      total: formattedNotifications.length,
      notifications: formattedNotifications
    });

  } catch (error) {
    console.error("Get Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// DELETE a notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    return res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



// UPDATE: Notification by ID
export const updateNotification = async (req, res) => {
  const { id } = req.params;
  const { title, body } = req.body;

  try {
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID"
      });
    }

    // Find and update
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { title, body },
      { new: true, runValidators: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: updatedNotification
    });

  } catch (error) {
    console.error("Update Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating notification",
      error: error.message
    });
  }
};


// GET all delivered orders
export const getDeliveredOrders = async (req, res) => {
  try {
    // Fetch all orders with status "Delivered"
    const orders = await Order.find({ status: "Delivered" })
      .populate("userId", "name mobile") // get user info
      .populate("assignedRider", "name mobile vehicle") // get rider info
      .sort({ createdAt: -1 });

    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// GET all fully refunded orders
export const getRefundOrders = async (req, res) => {
  try {
    const refundOrders = await Order.find({ status: "Refunded" })
      .populate("userId", "name mobile") // populate user info
      .sort({ createdAt: -1 });

    return res.status(200).json({ refundOrders });
  } catch (error) {
    console.error("Error fetching refund orders:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



// export const getDashboardData = async (req, res) => {
//   try {
//     // Fetch all data in parallel
//     const [users, pharmacies, orders, medicines, riders] = await Promise.all([
//       User.find().lean(),
//       Pharmacy.find().lean(),
//       Order.find().lean(),
//       Medicine.find().lean(),
//       Rider.find().lean(),
//     ]);

//     // === Date Helpers ===
//     const now = new Date();
//     const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//     const daysAgo = (n) => {
//       const d = new Date();
//       d.setDate(d.getDate() - n);
//       return d;
//     };

//     const monthsAgo = (n) => {
//       const d = new Date();
//       d.setMonth(d.getMonth() - n);
//       return d;
//     };

//     // Count total orders (no filter)
//     const totalOrders = orders.length;

//     // Count today's orders using date-only comparison
//     const isToday = (dateStr) => {
//       const date = new Date(dateStr);
//       return (
//         date.getFullYear() === now.getFullYear() &&
//         date.getMonth() === now.getMonth() &&
//         date.getDate() === now.getDate()
//       );
//     };

//     const todaysOrdersCount = orders.filter(
//       (o) => o.createdAt && isToday(o.createdAt)
//     ).length;

//     // Count active pharmacies
//     const activePharmaciesCount = pharmacies.filter(ph => ph.status === "Active").length;
//     const inactivePharmaciesCount = pharmacies.filter(ph => ph.status === "Inactive").length;

//     // === Revenue Data ===
//     const revenueData = [
//       {
//         label: "Today",
//         revenue: orders
//           .filter(o => o.createdAt && new Date(o.createdAt) >= startOfToday)
//           .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
//       },
//       {
//         label: "Last 7 Days",
//         revenue: orders
//           .filter(o => o.createdAt && new Date(o.createdAt) >= daysAgo(7))
//           .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
//       },
//       {
//         label: "Last 1 Month",
//         revenue: orders
//           .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(1))
//           .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
//       },
//       {
//         label: "Last 6 Months",
//         revenue: orders
//           .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(6))
//           .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
//       },
//       {
//         label: "Last 12 Months",
//         revenue: orders
//           .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(12))
//           .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
//       },
//     ];

//     // === Medicine to Pharmacy Mapping ===
//     const medicineToPharmacyMap = new Map();
//     medicines.forEach(med => {
//       medicineToPharmacyMap.set(med._id.toString(), med.pharmacyId?.toString());
//     });

//     // === Pharmacy Revenue ===
//     const pharmacyRevenueMap = new Map();

//     orders.forEach(order => {
//       if (!order.totalAmount || !order.orderItems || order.orderItems.length === 0) return;

//       const perMedicineRevenue = order.totalAmount / order.orderItems.length;

//       order.orderItems.forEach(item => {
//         const medId = item.medicineId?.toString();
//         const pharmacyId = medicineToPharmacyMap.get(medId);
//         if (!pharmacyId) return;

//         const currentRevenue = pharmacyRevenueMap.get(pharmacyId) || 0;
//         pharmacyRevenueMap.set(pharmacyId, currentRevenue + perMedicineRevenue);
//       });
//     });

//     // === Top Pharmacies ===
//     const topPharmacies = pharmacies.map(ph => {
//       const revenue = pharmacyRevenueMap.get(ph._id.toString()) || 0;

//       const ordersCount = orders.filter(order =>
//         order.orderItems.some(item =>
//           medicineToPharmacyMap.get(item.medicineId?.toString()) === ph._id.toString()
//         )
//       ).length;

//       return {
//         name: ph.name,
//         revenue,
//         orders: ordersCount,
//       };
//     }).sort((a, b) => b.revenue - a.revenue);

//     // === User Orders Summary ===
//     const userOrdersMap = new Map();
//     orders.forEach(order => {
//       const userId = order.userId?.toString();
//       if (!userId) return;
//       if (!userOrdersMap.has(userId)) userOrdersMap.set(userId, []);
//       userOrdersMap.get(userId).push(order);
//     });

//     const userOrdersSummary = users.map(user => {
//       const userId = user._id.toString();
//       const userOrders = userOrdersMap.get(userId) || [];

//       const totalOrders = userOrders.length;
//       const medicinesOrdered = userOrders.reduce((sum, order) =>
//         sum + (order.orderItems?.length || 0), 0
//       );

//       const lastOrderDate = userOrders.reduce((latest, order) => {
//         const orderDate = order.createdAt ? new Date(order.createdAt) : null;
//         return orderDate && (!latest || orderDate > latest) ? orderDate : latest;
//       }, null);

//       let onTime = 0, delayed = 0, cancelled = 0;
//       userOrders.forEach(order => {
//         if (order.status === "cancelled") {
//           cancelled++;
//         } else if (order.status === "delivered") {
//           if (order.isDelayed) delayed++;
//           else onTime++;
//         }
//       });

//       return {
//         user: user.name || user.email || "Unknown",
//         lastOrder: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : "No Orders",
//         accountCreated: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : "Unknown",
//         totalOrders,
//         medicinesOrdered,
//         onTime,
//         delayed,
//         cancelled,
//       };
//     });

//     // === Pharmacy Insights ===
//     const pharmacyInsights = pharmacies.map(ph => {
//       const phId = ph._id.toString();

//       const totalOrders = orders.filter(order =>
//         order.orderItems.some(item =>
//           medicineToPharmacyMap.get(item.medicineId?.toString()) === phId
//         )
//       ).length;

//       let avgRating = 0;
//       if (ph.ratings?.length > 0) {
//         const sumRatings = ph.ratings.reduce((a, b) => a + b, 0);
//         avgRating = sumRatings / ph.ratings.length;
//       } else if (typeof ph.rating === "number") {
//         avgRating = ph.rating;
//       }

//       const medicinesAvailable = medicines.filter(med => med.pharmacyId?.toString() === phId).length;
//       const joinedDate = ph.createdAt ? new Date(ph.createdAt).toISOString().split("T")[0] : "Unknown";

//       return {
//         pharmacy: ph.name,
//         totalOrders,
//         avgRating: Number(avgRating.toFixed(2)),
//         medicinesAvailable,
//         joinedDate,
//       };
//     });

//     // === Online Riders ===
//     const onlineRidersCount = riders.filter(rider => rider.status === "online").length;

//     // === Final Response ===
//     res.json({
//       stats: {
//         totalUsers: users.length,
//         totalOrders,                      // ✅ FIXED
//         totalPharmacies: pharmacies.length,
//         totalMedicines: medicines.length,
//         totalRiders: riders.length,
//         onlineRiders: onlineRidersCount,
//         activePharmacies: activePharmaciesCount,
//         inactivePharmacies: inactivePharmaciesCount,
//         todaysOrders: todaysOrdersCount, // ✅ FIXED
//       },
//       revenueData,
//       topPharmacies,
//       userOrdersSummary,
//       pharmacyInsights,
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Failed to fetch dashboard data",
//       error: error.message,
//     });
//   }
// };


// ✅ Create Banner Controller

export const getDashboardData = async (req, res) => {
  try {
    // Fetch all data in parallel with proper filtering
    const [users, pharmacies, orders, medicines, riders] = await Promise.all([
      User.find().lean(),
      Pharmacy.find().lean(),
      Order.find().lean(),
      Medicine.find().populate('pharmacyId').lean(), // Populate to check pharmacy status
      Rider.find().lean(),
    ]);

    // === Date Helpers ===
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysAgo = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };

    const monthsAgo = (n) => {
      const d = new Date();
      d.setMonth(d.getMonth() - n);
      return d;
    };

    // Count total orders (no filter)
    const totalOrders = orders.length;

    // Count today's orders using date-only comparison
    const isToday = (dateStr) => {
      const date = new Date(dateStr);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };

    const todaysOrdersCount = orders.filter(
      (o) => o.createdAt && isToday(o.createdAt)
    ).length;

    // Count active pharmacies
    const activePharmaciesCount = pharmacies.filter(ph => ph.status === "Active").length;
    const inactivePharmaciesCount = pharmacies.filter(ph => ph.status === "Inactive").length;

    // ✅ FIXED: Count only medicines from ACTIVE pharmacies
    const activePharmacyIds = pharmacies
      .filter(ph => ph.status === "Active")
      .map(ph => ph._id.toString());
    
    const totalMedicines = medicines.filter(med => {
      const pharmacyId = med.pharmacyId?._id?.toString() || med.pharmacyId?.toString();
      return activePharmacyIds.includes(pharmacyId);
    }).length;

    // Count medicines from inactive pharmacies (for reference)
    const inactivePharmacyIds = pharmacies
      .filter(ph => ph.status === "Inactive")
      .map(ph => ph._id.toString());
    
    const inactiveMedicinesCount = medicines.filter(med => {
      const pharmacyId = med.pharmacyId?._id?.toString() || med.pharmacyId?.toString();
      return inactivePharmacyIds.includes(pharmacyId);
    }).length;

    // === Revenue Data ===
    const revenueData = [
      {
        label: "Today",
        revenue: orders
          .filter(o => o.createdAt && new Date(o.createdAt) >= startOfToday)
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      {
        label: "Last 7 Days",
        revenue: orders
          .filter(o => o.createdAt && new Date(o.createdAt) >= daysAgo(7))
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      {
        label: "Last 1 Month",
        revenue: orders
          .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(1))
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      {
        label: "Last 6 Months",
        revenue: orders
          .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(6))
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      {
        label: "Last 12 Months",
        revenue: orders
          .filter(o => o.createdAt && new Date(o.createdAt) >= monthsAgo(12))
          .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
    ];

    // === Medicine to Pharmacy Mapping (only active pharmacies) ===
    const medicineToPharmacyMap = new Map();
    medicines.forEach(med => {
      const pharmacyId = med.pharmacyId?._id?.toString() || med.pharmacyId?.toString();
      if (activePharmacyIds.includes(pharmacyId)) {
        medicineToPharmacyMap.set(med._id.toString(), pharmacyId);
      }
    });

    // === Pharmacy Revenue ===
    const pharmacyRevenueMap = new Map();

    orders.forEach(order => {
      if (!order.totalAmount || !order.orderItems || order.orderItems.length === 0) return;

      const perMedicineRevenue = order.totalAmount / order.orderItems.length;

      order.orderItems.forEach(item => {
        const medId = item.medicineId?.toString();
        const pharmacyId = medicineToPharmacyMap.get(medId);
        if (!pharmacyId) return;

        const currentRevenue = pharmacyRevenueMap.get(pharmacyId) || 0;
        pharmacyRevenueMap.set(pharmacyId, currentRevenue + perMedicineRevenue);
      });
    });

    // === Top Pharmacies ===
    const topPharmacies = pharmacies.map(ph => {
      const revenue = pharmacyRevenueMap.get(ph._id.toString()) || 0;

      const ordersCount = orders.filter(order =>
        order.orderItems.some(item => {
          const medId = item.medicineId?.toString();
          const phId = medicineToPharmacyMap.get(medId);
          return phId === ph._id.toString();
        })
      ).length;

      return {
        name: ph.name,
        revenue,
        orders: ordersCount,
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10); // Limit to top 10

    // === User Orders Summary ===
    const userOrdersMap = new Map();
    orders.forEach(order => {
      const userId = order.userId?.toString();
      if (!userId) return;
      if (!userOrdersMap.has(userId)) userOrdersMap.set(userId, []);
      userOrdersMap.get(userId).push(order);
    });

    const userOrdersSummary = users.map(user => {
      const userId = user._id.toString();
      const userOrders = userOrdersMap.get(userId) || [];

      const totalOrders = userOrders.length;
      const medicinesOrdered = userOrders.reduce((sum, order) =>
        sum + (order.orderItems?.length || 0), 0
      );

      const lastOrderDate = userOrders.reduce((latest, order) => {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        return orderDate && (!latest || orderDate > latest) ? orderDate : latest;
      }, null);

      let onTime = 0, delayed = 0, cancelled = 0;
      userOrders.forEach(order => {
        if (order.status === "Cancelled" || order.status === "cancelled") {
          cancelled++;
        } else if (order.status === "Delivered" || order.status === "delivered") {
          if (order.isDelayed) delayed++;
          else onTime++;
        }
      });

      return {
        user: user.name || user.email || "Unknown",
        lastOrder: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : "No Orders",
        accountCreated: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : "Unknown",
        totalOrders,
        medicinesOrdered,
        onTime,
        delayed,
        cancelled,
      };
    });

    // === Pharmacy Insights ===
    const pharmacyInsights = pharmacies.map(ph => {
      const phId = ph._id.toString();

      const totalOrders = orders.filter(order =>
        order.orderItems.some(item => {
          const medId = item.medicineId?.toString();
          const pharmacyId = medicineToPharmacyMap.get(medId);
          return pharmacyId === phId;
        })
      ).length;

      let avgRating = 0;
      if (ph.ratings?.length > 0) {
        const sumRatings = ph.ratings.reduce((a, b) => a + b, 0);
        avgRating = sumRatings / ph.ratings.length;
      } else if (typeof ph.rating === "number") {
        avgRating = ph.rating;
      }

      const medicinesAvailable = medicines.filter(med => {
        const pharmacyId = med.pharmacyId?._id?.toString() || med.pharmacyId?.toString();
        return pharmacyId === phId;
      }).length;
      
      const joinedDate = ph.createdAt ? new Date(ph.createdAt).toISOString().split("T")[0] : "Unknown";

      return {
        pharmacy: ph.name,
        totalOrders,
        avgRating: Number(avgRating.toFixed(2)),
        medicinesAvailable,
        joinedDate,
      };
    });

    // === Online Riders ===
    const onlineRidersCount = riders.filter(rider => rider.status === "online").length;

    // === Final Response (SAME STRUCTURE - NO CHANGES) ===
    res.json({
      stats: {
        totalUsers: users.length,
        totalOrders,
        totalPharmacies: pharmacies.length,
        totalMedicines,  // ✅ FIXED: Now only counts medicines from active pharmacies
        totalRiders: riders.length,
        onlineRiders: onlineRidersCount,
        activePharmacies: activePharmaciesCount,
        inactivePharmacies: inactivePharmaciesCount,
        todaysOrders: todaysOrdersCount,
        // Optional: Add this if you want to show inactive medicines count
        // inactiveMedicines: inactiveMedicinesCount,
      },
      revenueData,
      topPharmacies,
      userOrdersSummary,
      pharmacyInsights,
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
};

export const createBanner = async (req, res) => {
  try {
    // 🌟 Multiple images upload
    let bannerImageUrls = [];

    if (req.files?.images) {
      const bannerFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      for (let file of bannerFiles) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: "banners",
        });
        bannerImageUrls.push(uploaded.secure_url);
      }
    }

    if (bannerImageUrls.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    // 🛠️ Save banner in DB
    const banner = new Banner({
      images: bannerImageUrls,
    });

    await banner.save();

    return res.status(201).json({
      message: "Banner created successfully 🎉",
      banner,
    });
  } catch (error) {
    console.error("Create Banner Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// ✅ Get All Banners
export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    return res.status(200).json({
      message: "Banners fetched successfully",
      banners,
    });
  } catch (error) {
    console.error("Get All Banners Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Update Banner (replace images)
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    let bannerImageUrls = banner.images; // old images

    if (req.files?.images) {
      const bannerFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      bannerImageUrls = [];
      for (let file of bannerFiles) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: "banners",
        });
        bannerImageUrls.push(uploaded.secure_url);
      }
    }

    banner.images = bannerImageUrls;
    await banner.save();

    return res.status(200).json({
      message: "Banner updated successfully ✨",
      banner,
    });
  } catch (error) {
    console.error("Update Banner Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Delete Banner
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    await Banner.findByIdAndDelete(id);

    return res.status(200).json({ message: "Banner deleted successfully ❌" });
  } catch (error) {
    console.error("Delete Banner Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const acceptWithdrawalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    // ✅ Find the withdrawal request
    const request = await withdrawalRequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    // ✅ Try to find rider — but don't block if not found
    const rider = await Rider.findById(request.riderId);

    // If status is Approved, wallet deduction only if rider exists
    if (status === "Approved") {
      if (request.status !== "Requested") {
        return res.status(400).json({ message: "Only 'Requested' withdrawals can be accepted" });
      }

      if (rider) {
        if (request.amount > rider.wallet) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        rider.wallet -= request.amount;
        await rider.save();
      }
    }

    // ✅ Update withdrawal request status
    request.status = status;
    request.updatedAt = new Date();
    await request.save();

    // ✅ Fetch updated request fresh from DB to return full object
    const updatedRequest = await withdrawalRequestModel.findById(requestId).lean();

    return res.status(200).json({
      message: `Withdrawal request ${status.toLowerCase()} successfully`,
      remainingWallet: rider ? `₹${rider.wallet.toFixed(2)}` : null,
      request: updatedRequest,
    });

  } catch (error) {
    console.error("Error updating withdrawal request:", error);
    return res.status(500).json({ message: "Server error while updating withdrawal request" });
  }
};


export const getAllWithdrawalRequestsController = async (req, res) => {
  try {
    const requests = await withdrawalRequestModel
      .find()
      .sort({ createdAt: -1 })
      .populate('riderId', 'name email phone profileImage city state');

    // ✅ Return empty array instead of 404 so frontend always gets a response
    return res.status(200).json({
      message: "Withdrawal requests retrieved successfully",
      total: requests.length,
      requests: requests || [],
    });

  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    return res.status(500).json({ message: "Server error while fetching withdrawal requests" });
  }
};


export const deleteWithdrawalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    // Check if request exists
    const request = await withdrawalRequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    // Delete the request
    await withdrawalRequestModel.findByIdAndDelete(requestId);

    return res.status(200).json({ message: "Withdrawal request deleted successfully" });

  } catch (error) {
    console.error("Error deleting withdrawal request:", error);
    return res.status(500).json({ message: "Server error while deleting withdrawal request" });
  }
};



export const sendMessage = async (req, res) => {
  const { vendorId, vendorIds, message } = req.body;   // Body se vendorId aur vendorIds lena

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    if (vendorIds && Array.isArray(vendorIds)) {
      // Multiple vendors ko message bhejna
      console.log(`Sending message to vendors: ${vendorIds.join(', ')}`);
      console.log(`Message: ${message}`);

      // Save the message to the database
      const newMessage = new Message({
        vendorIds: vendorIds,
        message: message
      });

      await newMessage.save();  // Save message in DB

      // TODO: SMS/Email sending logic here

      return res.status(200).json({ success: true, message: `Message sent to ${vendorIds.length} vendors` });

    } else if (vendorId) {
      // Single vendor ko message bhejna
      const vendor = await Pharmacy.findById(vendorId);  // **Pharmacy** model me `vendorId` se check karenge
      if (!vendor) {
        return res.status(404).json({ error: "Vendor (Pharmacy) not found" });
      }

      console.log(`Sending message to ${vendor.name}`);
      console.log(`Message: ${message}`);

      // Save the message to the database
      const newMessage = new Message({
        vendorIds: [vendorId],  // Single vendorId
        message: message
      });

      await newMessage.save();  // Save message in DB

      // TODO: SMS/Email sending logic here

      return res.status(200).json({ success: true, message: `Message sent to ${vendor.name}` });
    }

    return res.status(400).json({ error: "No vendorId or vendorIds provided" });
  } catch (error) {
    console.error("Error in sendMessage controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};




// Get all messages (optionally you can filter by vendorId if needed)
export const getAllMessages = async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });

    const populatedMessages = await Promise.all(
      messages.map(async (msg) => {
        // Fetch vendor details for each vendorId in the message
        const populatedVendors = await Pharmacy.find({
          _id: { $in: msg.vendorIds },
        }).select('_id name vendorEmail');

        // Return message object with vendor details instead of just ObjectIds
        return {
          _id: msg._id,
          message: msg.message,
          sentAt: msg.sentAt,
          vendorIds: populatedVendors,
        };
      })
    );

    res.status(200).json(populatedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a message by ID
export const deleteMessage = async (req, res) => {
  const { id } = req.params; // assuming message ID comes from URL params

  try {
    const deleted = await Message.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Message not found" });
    }
    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



export const getAllRiderQueries = async (req, res) => {
  try {
    // ✅ Get only those queries where riderId exists (not null)
    const queries = await Query.find({ riderId: { $ne: null } })
      .populate('riderId', 'name mobile email');

    // ✅ If none found
    if (!queries.length) {
      return res.status(404).json({
        message: 'No rider queries found with a valid riderId',
        queries: []
      });
    }

    // ✅ Send only relevant queries
    res.status(200).json({
      message: 'Rider queries fetched successfully',
      queries
    });

  } catch (error) {
    console.error('Error fetching rider queries:', error);
    res.status(500).json({
      message: 'Error fetching rider queries',
      error: error.message
    });
  }
};



export const updateRiderQuery = async (req, res) => {
  try {
    const { queryId } = req.params; // Query ID in params
    const { status, message } = req.body; // Optional fields to update

    // Validate the queryId
    const query = await Query.findById(queryId);
    if (!query) {
      return res.status(404).json({ message: "Query not found" });
    }

    // Update the query
    if (status) {
      query.status = status;
    }
    if (message) {
      query.message = message;
    }

    // Save the updated query
    await query.save();

    // Send success response
    res.status(200).json({ message: "Query updated successfully", query });
  } catch (error) {
    console.error("Error updating rider query:", error);
    res.status(500).json({ message: "Error updating rider query", error });
  }
};



export const deleteRiderQuery = async (req, res) => {
  try {
    const { queryId } = req.params; // Query ID in params

    // Find the query by ID and delete it
    const query = await Query.findByIdAndDelete(queryId);
    if (!query) {
      return res.status(404).json({ message: "Query not found" });
    }

    // Send success response
    res.status(200).json({ message: "Query deleted successfully" });
  } catch (error) {
    console.error("Error deleting rider query:", error);
    res.status(500).json({ message: "Error deleting rider query", error });
  }
};



export const getAllPreodicOrders = async (req, res) => {
  try {
    // Fetch only orders with planType defined (not null)
    const orders = await Order.find({ planType: { $exists: true, $ne: null } })
      .populate('assignedRider', 'name phone')  // Populate assigned rider info
      .populate('userId', 'name mobile')  // Populate user info (name, mobile)
      .sort({ deliveryDate: -1 });  // Sort by deliveryDate descending

    if (orders.length === 0) {
      return res.status(200).json({ message: "No periodic orders found" });
    }

    res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        _id: order._id,
        userId: {
          _id: order.userId._id,
          name: order.userId.name,
          mobile: order.userId.mobile,
        },
        deliveryDate: order.deliveryDate,
        deliveryAddress: order.deliveryAddress,
        orderItems: order.orderItems,
        subtotal: order.subtotal,
        total: order.total,
        deliveryCharge: order.deliveryCharge,
        platformCharge: order.platformCharge,
        planType: order.planType,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        statusTimeline: order.statusTimeline,
        notes: order.notes,
        voiceNoteUrl: order.voiceNoteUrl,
        assignedRider: order.assignedRider ? {
          _id: order.assignedRider._id,
          name: order.assignedRider.name,
          phone: order.assignedRider.phone,
        } : null,
        assignedRiderStatus: order.assignedRiderStatus,
        createdAt: order.createdAt,
      })),
    });

  } catch (error) {
    console.error("Error fetching periodic orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




// Update Order Controller
export const updatePeriodicOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    Object.assign(order, updateData);
    await order.save();

    res.status(200).json({
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating the order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete Order Controller
export const deletePeriodicOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting the order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const createFaq = async (req, res) => {
  try {
    const { question, answer, date, type } = req.body;

    // Check if type is either 'rider' or 'user'
    if (!['rider', 'user'].includes(type)) {
      return res.status(400).json({ message: "Invalid type, must be 'rider' or 'user'" });
    }

    // Create new FAQ entry
    const newFaq = await Faq.create({
      question,
      answer,
      date: new Date(date),
      type,  // Storing the type (rider or user)
    });

    res.status(201).json({
      message: "FAQ created successfully",
      faq: newFaq,
    });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const getAllFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ date: -1 }); // Newest first
    res.status(200).json({ faqs });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Delete FAQ by ID
export const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    // Assuming the model is Faq
    const faq = await Faq.findByIdAndDelete(id);

    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }

    res.status(200).json({ message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Controller for getting FAQs for Rider
export const getAllFaqsForRider = async (req, res) => {
  try {
    // Find all FAQs where type is 'rider'
    const faqsForRider = await Faq.find({ type: "rider" });

    if (!faqsForRider || faqsForRider.length === 0) {
      return res.status(404).json({
        message: "No FAQs available for riders.",
      });
    }

    // Return the list of FAQs
    return res.status(200).json({
      faqs: faqsForRider,
    });
  } catch (error) {
    console.error("Error fetching FAQs for rider:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// Controller for getting FAQs for User
export const getAllFaqsForUser = async (req, res) => {
  try {
    // Find all FAQs where type is 'user'
    const faqsForUser = await Faq.find({ type: "user" });

    if (!faqsForUser || faqsForUser.length === 0) {
      return res.status(404).json({
        message: "No FAQs available for users.",
      });
    }

    // Return the list of FAQs
    return res.status(200).json({
      faqs: faqsForUser,
    });
  } catch (error) {
    console.error("Error fetching FAQs for user:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// ✅ Create a new coupon
export const addCoupon = async (req, res) => {
  const { couponCode, discountPercentage, expirationDate } = req.body;

  try {
    // Check if coupon already exists
    const existingCoupon = await Coupon.findOne({ couponCode });
    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    // Create and save new coupon
    const newCoupon = new Coupon({
      couponCode,
      discountPercentage,
      expirationDate,
    });
    await newCoupon.save();
    res.status(201).json({ message: "Coupon added successfully", coupon: newCoupon });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({ message: "Failed to add coupon", error });
  }
};

// ✅ Get all coupons
export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ message: "Coupons fetched successfully", coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Failed to fetch coupons", error });
  }
};



// ✅ Edit a coupon
export const editCoupon = async (req, res) => {
  const { id } = req.params;  // Get coupon ID from URL params
  const { couponCode, discountPercentage, expirationDate } = req.body;

  try {
    // Find the coupon by ID
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Update the coupon fields
    coupon.couponCode = couponCode || coupon.couponCode;
    coupon.discountPercentage = discountPercentage || coupon.discountPercentage;
    coupon.expirationDate = expirationDate || coupon.expirationDate;
    coupon.updatedAt = new Date();  // Update the timestamp

    // Save the updated coupon
    await coupon.save();
    res.status(200).json({ message: "Coupon updated successfully", coupon });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Failed to update coupon", error });
  }
};

// ✅ Delete a coupon
export const deleteCoupon = async (req, res) => {
  const { id } = req.params;  // Get coupon ID from URL params

  try {
    // Find and delete the coupon by ID
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ message: "Failed to delete coupon", error });
  }
};




// Set base fare configuration for all riders - POST
export const setBaseFareForAllRiders = async (req, res) => {
  try {
    const { baseFare, baseDistanceKm, additionalChargePerKm } = req.body;

    if (!baseFare || baseFare < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid base fare amount is required"
      });
    }

    if (!baseDistanceKm || baseDistanceKm < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid base distance in km is required"
      });
    }

    if (!additionalChargePerKm || additionalChargePerKm < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid additional charge per km is required"
      });
    }

    // Update all riders with new delivery charge configuration
    const result = await Rider.updateMany(
      {},
      { 
        $set: { 
          baseFare: parseFloat(baseFare),
          baseDistanceKm: parseFloat(baseDistanceKm),
          additionalChargePerKm: parseFloat(additionalChargePerKm),
          // Keep deliveryCharge for backward compatibility
          deliveryCharge: parseFloat(baseFare)
        } 
      }
    );

    res.status(200).json({
      success: true,
      message: `Delivery charge configuration updated for all ${result.modifiedCount} riders`,
      modifiedCount: result.modifiedCount,
      configuration: {
        baseFare: parseFloat(baseFare),
        baseDistanceKm: parseFloat(baseDistanceKm),
        additionalChargePerKm: parseFloat(additionalChargePerKm)
      }
    });

  } catch (error) {
    console.error("Error setting base fare:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get base fare configuration - GET
export const getBaseFareConfiguration = async (req, res) => {
  try {
    // Get first rider to get the configuration
    const rider = await Rider.findOne().select("baseFare baseDistanceKm additionalChargePerKm");
    
    if (!rider) {
      // Return default configuration if no riders exist
      return res.status(200).json({
        success: true,
        configuration: {
          baseFare: 30,
          baseDistanceKm: 2,
          additionalChargePerKm: 10
        },
        message: "Default configuration (no riders found)"
      });
    }

    res.status(200).json({
      success: true,
      configuration: {
        baseFare: rider.baseFare || 30,
        baseDistanceKm: rider.baseDistanceKm || 2,
        additionalChargePerKm: rider.additionalChargePerKm || 10
      }
    });

  } catch (error) {
    console.error("Error getting base fare configuration:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get current base fare configuration (from first rider)
export const getCurrentBaseFare = async (req, res) => {
  try {
    const rider = await Rider.findOne().select("baseFare baseDistanceKm additionalChargePerKm");
    
    res.status(200).json({
      success: true,
      configuration: {
        baseFare: rider?.baseFare || 30,
        baseDistanceKm: rider?.baseDistanceKm || 2,
        additionalChargePerKm: rider?.additionalChargePerKm || 10
      }
    });

  } catch (error) {
    console.error("Error getting base fare:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



// Update base fare for specific rider
export const updateRiderBaseFare = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { baseFare, baseDistanceKm, additionalChargePerKm } = req.body;

    if (baseFare && baseFare < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid base fare amount is required"
      });
    }

    if (baseDistanceKm && baseDistanceKm < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid base distance in km is required"
      });
    }

    if (additionalChargePerKm && additionalChargePerKm < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid additional charge per km is required"
      });
    }

    const updateData = {};
    if (baseFare !== undefined) updateData.baseFare = parseFloat(baseFare);
    if (baseDistanceKm !== undefined) updateData.baseDistanceKm = parseFloat(baseDistanceKm);
    if (additionalChargePerKm !== undefined) updateData.additionalChargePerKm = parseFloat(additionalChargePerKm);

    const rider = await Rider.findByIdAndUpdate(
      riderId,
      { $set: updateData },
      { new: true }
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Delivery charge configuration updated for rider ${rider.name}`,
      configuration: {
        baseFare: rider.baseFare,
        baseDistanceKm: rider.baseDistanceKm,
        additionalChargePerKm: rider.additionalChargePerKm
      },
      rider: rider
    });

  } catch (error) {
    console.error("Error updating rider base fare:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



export const getAllPrescriptionOrders = async (req, res) => {
  try {
    // First, fetch all prescriptions with user details (similar to getAllPrescriptionsForAdmin)
    const prescriptions = await Prescription.find()
      .populate("userId", "name email mobile profileImage")
      .sort({ createdAt: -1 });
    
    if (!prescriptions || prescriptions.length === 0) {
      return res.status(200).json({
        count: 0,
        prescriptions: []
      });
    }
    
    // Now, for each prescription, find if there's a linked order
    const prescriptionOrders = await Promise.all(
      prescriptions.map(async (prescription) => {
        // Find order that contains this prescription
        const order = await Order.findOne({
          $or: [
            { prescription: prescription._id },
            { prescriptionId: prescription._id },
            { "prescriptions": prescription._id }
          ]
        })
        .populate("assignedRider", "name email phone")
        .lean();
        
        // Format the prescription with order details
        const prescriptionObj = prescription.toObject();
        
        return {
          _id: prescriptionObj._id,
          userId: prescriptionObj.userId,
          images: prescriptionObj.images || [],
          notes: prescriptionObj.notes || "",
          status: prescriptionObj.status || "Pending",
          createdAt: prescriptionObj.createdAt,
          updatedAt: prescriptionObj.updatedAt,
          // Add order details if exists
          orderDetails: order ? {
            orderId: order._id,
            orderStatus: order.status,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            assignedRider: order.assignedRider,
            deliveryAddress: order.deliveryAddress,
            createdAt: order.createdAt
          } : null
        };
      })
    );
    
    res.status(200).json({
      count: prescriptionOrders.length,
      prescriptions: prescriptionOrders
    });
    
  } catch (error) {
    console.error("Get Prescription Orders Error:", error);
    res.status(500).json({
      message: "Error fetching prescription orders",
      error: error.message
    });
  }
};



export const getAllVendorQueries = async (req, res) => {
  try {
    // ✅ Get all queries
    const queries = await Query.find({})
      .populate('vendorId', 'vendorName vendorEmail vendorEmail'); // Populate vendor details

    // ✅ If no queries found
    if (!queries.length) {
      return res.status(404).json({
        message: 'No queries found from any vendor',
        queries: []
      });
    }

    // ✅ Send all relevant queries with vendor details
    res.status(200).json({
      message: 'All vendor queries fetched successfully',
      queries: queries.map(query => ({
        ...query.toObject(),
        vendor: query.vendorId ? {
          name: query.vendorId.vendorName,
          email: query.vendorId.vendorEmail,
          phone: query.vendorId.vendorEmail,
        } : null,
      })),
    });

  } catch (error) {
    console.error('Error fetching all vendor queries:', error);
    res.status(500).json({
      message: 'Error fetching all vendor queries',
      error: error.message
    });
  }
};



// Get all vendor withdrawal requests (ADMIN)
// Get all vendor withdrawal requests (ADMIN)
export const getAllWithdrawalRequests = async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 10, page = 1 } = req.query;

    // ✅ Only withdrawals having vendor
    const query = {
      vendor: { $ne: null }
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const withdrawals = await VendorWithdrawal.find(query)
      .populate({
        path: 'vendor',
        select: 'vendorName vendorEmail vendorPhone'
      })
      .populate({
        path: 'bankAccount',
        select: 'bankName accountNumber ifscCode accountHolderName'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VendorWithdrawal.countDocuments(query);

    const formattedWithdrawals = withdrawals
      .filter(w => w.vendor) // ✅ extra safety
      .map(w => ({
        _id: w._id,
        amount: w.amount,
        status: w.status,
        paymentMethod: w.paymentMethod,
        transactionId: w.transactionId,
        createdAt: w.createdAt,

        vendor: {
          vendorId: w.vendor._id,
          vendorName: w.vendor.vendorName,
          vendorEmail: w.vendor.vendorEmail,
          vendorPhone: w.vendor.vendorPhone
        },

        bankAccount: w.bankAccount
      }));

    res.status(200).json({
      success: true,
      message: 'Vendor withdrawal requests fetched successfully',
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



export const updateVendorWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status } = req.body;

    // Validate withdrawalId
    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal ID",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Find withdrawal
    const withdrawal = await VendorWithdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    // Update status only
    withdrawal.status = status;
    withdrawal.updatedAt = new Date();

    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal status updated successfully",
      status: withdrawal.status,
    });

  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};