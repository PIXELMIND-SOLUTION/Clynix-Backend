
import Pharmacy from "../Models/Pharmacy.js";
import Medicine from '../Models/Medicine.js';
import cloudinary from '../config/cloudinary.js';
import dotenv from 'dotenv';
import Order from "../Models/Order.js";
import Message from "../Models/Message.js";
import Prescription from "../Models/Prescription.js";
import Query from "../Models/Query.js";
import Rider from "../Models/Rider.js";
import User from "../Models/User.js";
import mongoose from "mongoose";
import { Notification } from "../Models/Notification.js";
import BankAccount from "../Models/BankAccount.js";
import VendorWithdrawal from "../Models/VendorWithdrawal.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});



/// Utility: Haversine formula to calculate distance in km
const calculateDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Delivery charge calculation per km (adjust rate as needed)
const calculateDeliveryCharge = (distanceKm) => {
  const ratePerKm = 5; // 5 currency units per km
  return Math.ceil(distanceKm * ratePerKm);
};


export const vendorLogin = async (req, res) => {
  try {
    const { vendorId, password } = req.body;

    // 🛡️ Validate inputs
    if (!vendorId || !password) {
      return res.status(400).json({ message: 'vendorId and password are required' });
    }

    // 🔍 Find vendor by vendorId
    const vendor = await Pharmacy.findOne({ vendorId });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // ✅ Check password
    if (vendor.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // ✅ Check status
    if (vendor.status !== 'Active') {
      return res.status(403).json({ message: `Vendor is not active. Current status: ${vendor.status}` });
    }

    // ✅ Successful login
    return res.status(200).json({
      message: 'Login successful',
      vendor: {
        id: vendor._id,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        vendorEmail: vendor.vendorEmail,
        vendorPhone: vendor.vendorPhone,
        pharmacyName: vendor.name,
        pharmacyImage: vendor.image,
        location: vendor.location,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        categories: vendor.categories,
        status: vendor.status,
      }
    });

  } catch (error) {
    console.error('Vendor Login Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 📋 Get vendor profile by ID (complete)
export const getVendorProfile = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID is required" });
    }

    // Find vendor by ID with all fields
    const vendor = await Pharmacy.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Return the complete vendor object including categories, location, products, etc.
    return res.status(200).json({
      message: "Vendor profile fetched successfully",
      vendor, // sending whole vendor document
    });
  } catch (error) {
    console.error("Error fetching vendor profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const addPharmacyByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params; // This is pharmacy _id
    const {
      name,
      image,
      latitude,
      longitude,
      categories,
      products,
      vendorName,
      vendorEmail,
      vendorPhone
    } = req.body;

    // Find the pharmacy by its _id (which is vendorId here)
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    // Update fields if provided
    if (name) pharmacy.name = name;
    if (latitude) pharmacy.latitude = parseFloat(latitude);
    if (longitude) pharmacy.longitude = parseFloat(longitude);
    if (vendorName) pharmacy.vendorName = vendorName;
    if (vendorEmail) pharmacy.vendorEmail = vendorEmail;
    if (vendorPhone) pharmacy.vendorPhone = vendorPhone;

    // Handle image upload
    if (req.files?.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'pharmacies',
      });
      pharmacy.image = uploaded.secure_url;
    } else if (image?.startsWith('http')) {
      pharmacy.image = image;
    }

    // Parse categories
    if (categories) {
      let parsedCategories = [];
      if (typeof categories === 'string') {
        parsedCategories = JSON.parse(categories);
      } else if (Array.isArray(categories)) {
        parsedCategories = categories;
      }
      pharmacy.categories = parsedCategories;
    }

    // Parse products
    if (products) {
      let parsedProducts = [];
      if (typeof products === 'string') {
        parsedProducts = JSON.parse(products);
      } else if (Array.isArray(products)) {
        parsedProducts = products;
      }
      pharmacy.products = parsedProducts;
    }

    // Save the updated pharmacy document
    await pharmacy.save();

    return res.status(200).json({
      message: 'Pharmacy updated successfully',
      pharmacy,
    });
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getCategoriesByVendorId = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const pharmacy = await Pharmacy.findById(vendorId);

    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy/vendor not found" });
    }

    // Return just the categories array
    return res.status(200).json({
      categories: pharmacy.categories || [],
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



// ➕ Create Medicine
export const createMedicine = async (req, res) => {
  try {
    const { name, price, mrp, description, categoryName } = req.body;  // Add 'mrp' to the destructuring
    const { vendorId } = req.params;  // get vendorId from params

    // ✅ Check pharmacy exists using vendorId as pharmacyId
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy (vendor) not found' });
    }

    // 🔍 Validate category exists in pharmacy categories
    const categoryExists = pharmacy.categories.some(
      cat => cat.name.toLowerCase() === categoryName?.toLowerCase()
    );
    if (!categoryExists) {
      return res.status(400).json({ message: `Category "${categoryName}" not found in this pharmacy` });
    }

    let images = [];

    // 📷 Case 1: uploaded files present in req.files.images (can be array or single file)
    if (req.files && req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      for (let file of files) {
        const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'medicines',
        });
        images.push(uploaded.secure_url);
      }
    } 
    // 🌐 Case 2: images URLs passed in body.images (array)
    else if (Array.isArray(req.body.images)) {
      images = req.body.images.filter(img => typeof img === 'string' && img.startsWith('http'));
    } 
    else {
      return res.status(400).json({ message: 'Images are required (upload or URL)' });
    }

    // 🏥 Create medicine
    const newMedicine = new Medicine({
      pharmacyId: vendorId,  // assign vendorId as pharmacyId
      name,
      images,
      price,
      mrp,  // Add MRP to the new medicine object
      description,
      categoryName,
    });

    await newMedicine.save();

    // Populate pharmacy info
    const populated = await Medicine.findById(newMedicine._id)
      .populate('pharmacyId', 'name location');

    res.status(201).json({
      message: 'Medicine created successfully',
      medicine: {
        name: populated.name,
        images: populated.images,
        price: populated.price,
        mrp: populated.mrp,  // Include MRP in the response
        description: populated.description,
        categoryName: populated.categoryName,
        pharmacy: populated.pharmacyId,
      }
    });
  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// 📦 Get all medicines for a vendor
export const getAllMedicinesByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // ✅ Check if vendor (pharmacy) exists
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Vendor (pharmacy) not found' });
    }

    // 🔍 Find medicines associated with this vendor
    const medicines = await Medicine.find({ pharmacyId: vendorId }).populate('pharmacyId', 'name location');

    res.status(200).json({
      message: 'Medicines fetched successfully',
      medicines,
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// ✏️ Update Medicine by Vendor
export const editMedicineByVendor = async (req, res) => {
  try {
    const { vendorId, medicineId } = req.params;
    const { name, price, mrp, description, categoryName, images } = req.body; // Include 'mrp' in destructuring

    // ✅ Check if pharmacy exists
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy (vendor) not found' });
    }

    // 🔍 Check if medicine exists and belongs to this vendor
    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId: vendorId });
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found for this vendor' });
    }

    // 🔍 Check if category is valid for this vendor
    const categoryExists = pharmacy.categories.some(
      (cat) => cat.name.toLowerCase() === categoryName?.toLowerCase()
    );

    if (!categoryExists) {
      return res.status(400).json({ message: `Category "${categoryName}" not found in this pharmacy` });
    }

    // 🛠 Update fields
    medicine.name = name || medicine.name;
    medicine.price = price || medicine.price;
    medicine.mrp = mrp || medicine.mrp;  // Update MRP if provided
    medicine.description = description || medicine.description;
    medicine.categoryName = categoryName || medicine.categoryName;

    // Handle image updates
    if (Array.isArray(images) && images.length > 0) {
      medicine.images = images;
    }

    await medicine.save();

    res.status(200).json({
      message: 'Medicine updated successfully',
      medicine: {
        name: medicine.name,
        price: medicine.price,
        mrp: medicine.mrp,  // Include MRP in the response
        description: medicine.description,
        categoryName: medicine.categoryName,
        images: medicine.images,
        pharmacyId: medicine.pharmacyId
      },
    });
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// ❌ Delete Medicine by Vendor
export const deleteMedicineByVendor = async (req, res) => {
  try {
    const { vendorId, medicineId } = req.params;

    // ✅ Check if medicine exists and belongs to this vendor
    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId: vendorId });
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found for this vendor' });
    }

    await Medicine.deleteOne({ _id: medicineId });

    res.status(200).json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// 📦 Get all orders for a vendor
export const getAllOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Find orders where this pharmacy is in the pharmacyResponses array
    const orders = await Order.find({
      'pharmacyResponses.pharmacyId': vendorId
    })
      .populate("assignedRider")
      .populate("userId", "name email mobile")
      .populate({
        path: 'orderItems.medicineId',
        populate: {
          path: 'pharmacyId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: 'Orders fetched successfully',
      orders: orders.map(order => {
        const orderObj = order.toObject();
        
        // Filter order items to only show items from this vendor
        orderObj.orderItems = orderObj.orderItems.filter(item => 
          item.medicineId?.pharmacyId?._id?.toString() === vendorId
        );
        
        return {
          ...orderObj,
          assignedRider: order.assignedRider ? {
            _id: order.assignedRider._id,
            name: order.assignedRider.name,
            email: order.assignedRider.email,
            phone: order.assignedRider.phone,
            address: order.assignedRider.address,
            city: order.assignedRider.city,
            state: order.assignedRider.state,
            pinCode: order.assignedRider.pinCode,
            profileImage: order.assignedRider.profileImage,
            rideImages: order.assignedRider.rideImages,
            deliveryCharge: order.assignedRider.deliveryCharge,
          } : null,
        };
      }).filter(order => order.orderItems.length > 0), // Only return orders that have items from this vendor
    });
  } catch (error) {
    console.error('Error fetching orders for vendor:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const updateOrderStatusByVendor = async (req, res) => {
  try {
    const { vendorId, orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const order = await Order.findById(orderId).populate("userId");
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.pharmacyResponses) order.pharmacyResponses = [];

    const pharmacyResponseIndex = order.pharmacyResponses.findIndex(
      (response) => response.pharmacyId.toString() === vendorId
    );

    if (pharmacyResponseIndex === -1) {
      return res.status(403).json({ message: "Order not assigned to this pharmacy" });
    }

    // =============================
    // VENDOR REJECTS ORDER
    // =============================
    if (status === "Rejected") {
      order.pharmacyResponses[pharmacyResponseIndex].status = "Rejected";
      order.pharmacyResponses[pharmacyResponseIndex].respondedAt = new Date();

      if (!order.rejectedPharmacies) order.rejectedPharmacies = [];
      if (!order.rejectedPharmacies.includes(vendorId)) {
        order.rejectedPharmacies.push(vendorId);
      }

      order.statusTimeline.push({
        status: "Rejected",
        message: `Pharmacy ${vendorId} rejected the order`,
        timestamp: new Date(),
      });

      await order.save();

      // 🔥 30s me reassignment
      scheduleReassignOrder(order._id);

      return res.status(200).json({
        message: "Order rejected by pharmacy, will try to reassign.",
        order,
      });
    }

    // =============================
    // VENDOR ACCEPTS ORDER
    // =============================
    if (status === "Accepted") {
      order.pharmacyResponses[pharmacyResponseIndex].status = "Accepted";
      order.pharmacyResponses[pharmacyResponseIndex].respondedAt = new Date();

      const allAccepted = order.pharmacyResponses.every(
        (response) => response.status === "Accepted"
      );

      if (allAccepted) {
        order.pharmacyResponse = "Accepted";
        order.status = "Accepted";
        order.statusTimeline.push({
          status: "Accepted",
          message: `Order accepted by pharmacy ${vendorId}`,
          timestamp: new Date(),
        });

        // Rider assign only if ALL pharmacies accepted
        if (!order.assignedRider) {
          const riders = await Rider.find({ status: "online" });
          let nearestRider = null;
          let minDistance = Infinity;

          const userLat = order.userId.location?.coordinates[1];
          const userLng = order.userId.location?.coordinates[0];

          for (const rider of riders) {
            if (!rider.latitude || !rider.longitude) continue;
            const distance = calculateDistance([rider.longitude, rider.latitude], [userLng, userLat]);
            if (distance < minDistance) {
              minDistance = distance;
              nearestRider = rider;
            }
          }

          if (nearestRider) {
            order.assignedRider = nearestRider._id;
            order.assignedRiderStatus = "Assigned";

            const baseFare = nearestRider.baseFare || 30;
            order.deliveryCharge = calculateDeliveryCharge(minDistance) + baseFare;

            order.statusTimeline.push({
              status: "Rider Assigned",
              message: `Rider ${nearestRider.name} assigned`,
              timestamp: new Date(),
            });

            nearestRider.notifications.push({
              message: "New order assigned to you",
              orderId: order._id,
              timestamp: new Date(),
            });

            await nearestRider.save();
          }
        }
      } else {
        order.pharmacyResponse = "Pending";
        order.statusTimeline.push({
          status: "Pending",
          message: `Pharmacy ${vendorId} accepted the order`,
          timestamp: new Date(),
        });
      }

      await order.save();

      return res.status(200).json({
        message: "Order accepted successfully",
        order,
      });
    }

    // =============================
    // OTHER STATUS UPDATE
    // =============================
    order.status = status;
    order.statusTimeline.push({
      status,
      message: `Order updated to ${status}`,
      timestamp: new Date(),
    });

    await order.save();

    return res.status(200).json({
      message: "Order status updated",
      order,
    });

  } catch (error) {
    console.error("updateOrderStatusByVendor error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// =============================
// REASSIGN ORDER AFTER 30s
// =============================
const scheduleReassignOrder = async (orderId) => {
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId);
      if (!order) return;

      if (order.status === "Accepted" || order.status === "Cancelled") return;

      const rejectedPharmacies = order.rejectedPharmacies || [];

      // Next available vendor
      const nextPharmacy = await Pharmacy.findOne({
        _id: { $nin: rejectedPharmacies },
        status: "active",
      });

      if (!nextPharmacy) {
        order.status = "Cancelled";
        order.statusTimeline.push({
          status: "Cancelled",
          message: "All pharmacies rejected. Order cancelled.",
          timestamp: new Date(),
        });
        await order.save();
        return;
      }

      // Assign new pharmacy
      order.pharmacyResponses.push({
        pharmacyId: nextPharmacy._id,
        status: "Pending",
        respondedAt: null,
      });
      order.statusTimeline.push({
        status: "Reassigned",
        message: `Order reassigned to pharmacy ${nextPharmacy._id}`,
        timestamp: new Date(),
      });

      await order.save();

    } catch (err) {
      console.error("Error in reassignment:", err);
    }
  }, 30 * 1000);
};



// Utility functions
function subtractMonths(date, months) {
  const d = new Date(date);
  const desiredMonth = d.getMonth() - months;
  d.setMonth(desiredMonth);
  if (d.getMonth() !== ((desiredMonth + 12) % 12)) {
    d.setDate(0);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function subtractDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(date, isToday) {
  const d = new Date(date);
  if (isToday) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } else {
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    return `${day}-${month}`;
  }
}

function generateDateLabels(startDate, endDate, isToday) {
  const labels = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    labels.push(formatDateLabel(current, isToday));
    current.setDate(current.getDate() + 1);
  }
  return labels;
}

export const getVendorDashboard = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { duration = "7days" } = req.query;

    const pharmacy = await Pharmacy.findById(vendorId).lean();
    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    const vendorMedicines = await Medicine.find({ pharmacyId: vendorId }, "_id");
    const medicineIds = vendorMedicines.map(m => m._id);

    const totalOrders = await Order.countDocuments({
      "orderItems.medicineId": { $in: medicineIds }
    });

    const medicinesCount = vendorMedicines.length;

    const revenueAgg = await Order.aggregate([
      {
        $match: {
          "orderItems.medicineId": { $in: medicineIds },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" }
        }
      }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

const todaysOrders = await Order.countDocuments({
  "orderItems.medicineId": { $in: medicineIds },
  createdAt: { $gte: startOfToday }
});


    const ordersDelivered = await Order.countDocuments({
      "orderItems.medicineId": { $in: medicineIds },
      status: "Delivered",
      updatedAt: { $gte: startOfToday }
    });

    const pendingDeliveries = await Order.countDocuments({
      "orderItems.medicineId": { $in: medicineIds },
      status: { $in: ["Pending", "Shipped"] }
    });


    

    const now = new Date();
    let startDate;

    if (duration === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (duration === "7days") {
      startDate = subtractDays(now, 6);
    } else if (duration === "1month" || duration === "month") {
      startDate = subtractMonths(now, 1);
    } else if (duration === "3months") {
      startDate = subtractMonths(now, 3);
    } else if (duration === "6months") {
      startDate = subtractMonths(now, 6);
    } else if (duration === "12months") {
      startDate = subtractMonths(now, 12);
    } else {
      startDate = subtractDays(now, 6);
    }

    const isToday = duration === "today";
    const dateFormat = isToday ? "%H:%M" : "%d-%b";
    const dateLabels = generateDateLabels(startDate, now, isToday);

    const revenueDataRaw = await Order.aggregate([
      {
        $match: {
          "orderItems.medicineId": { $in: medicineIds },
          createdAt: { $gte: startDate, $lte: now },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: dateFormat,
              date: "$createdAt"
            }
          },
          totalAmount: 1
        }
      },
      {
        $group: {
          _id: "$date",
          revenue: { $sum: "$totalAmount" }
        }
      }
    ]);

    const revenueMap = {};
    revenueDataRaw.forEach(item => {
      revenueMap[item._id] = item.revenue;
    });

    const revenueTrend = dateLabels.map(label => ({
      date: label,
      revenue: revenueMap[label] || 0
    }));

    const orderDataRaw = await Order.aggregate([
      {
        $match: {
          "orderItems.medicineId": { $in: medicineIds },
          createdAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: dateFormat,
              date: "$createdAt"
            }
          }
        }
      },
      {
        $group: {
          _id: "$date",
          count: { $sum: 1 }
        }
      }
    ]);

    const orderMap = {};
    orderDataRaw.forEach(item => {
      orderMap[item._id] = item.count;
    });

    const orderTrend = dateLabels.map(label => ({
      date: label,
      count: orderMap[label] || 0
    }));

    // ✅ Final response
    return res.status(200).json({
      summary: {
        orders: totalOrders,
        medicinesCount,
        revenue: totalRevenue,
        todaysOrders: todaysOrders  // Add today's orders count here
      },
      today: {
        ordersPlaced: todaysOrders,
        ordersDelivered,
        ordersPending: pendingDeliveries
      },
      trends: {
        revenueTrend,
        orderTrend
      },
      // ✅ Include revenueByMonth & paymentStatus here
      revenueByMonth: pharmacy.revenueByMonth || {},
      paymentStatus: pharmacy.paymentStatus || {}
    });

  } catch (error) {
    console.error("Error in getVendorDashboard:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const vendorLogout = async (req, res) => {
  try {
    // Clear the auth cookie (assuming cookie name is 'token' or adjust accordingly)
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // send secure flag only in prod
      sameSite: 'strict',
    });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Vendor Logout Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




export const getMessagesForVendor = async (req, res) => {
  const { vendorId } = req.params; // Get vendorId from URL params

  if (!vendorId) {
    return res.status(400).json({ error: "vendorId is required" });
  }

  try {
    // Check if the vendor exists
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor (Pharmacy) not found" });
    }

    // Find all messages where the vendorId is part of the vendorIds array
    const messages = await Message.find({
      vendorIds: vendorId // We check if vendorId is part of the vendorIds array in the message
    })
    .sort({ sentAt: -1 }); // Sort messages by sentAt in descending order

    if (messages.length === 0) {
      return res.status(200).json({ message: "No messages found for this vendor" });
    }

    // Clean the message data to only include message and sentAt
    const cleanMessages = messages.map(msg => ({
      message: msg.message,
      sentAt: msg.sentAt
    }));

    // Return the cleaned message data
    return res.status(200).json({
      success: true,
      vendor: vendor.name,  // Return vendor name in the response
      messages: cleanMessages  // Send the cleaned messages
    });

  } catch (error) {
    console.error("Error in getMessagesForVendor:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};





// Controller to update the vendor status
export const updateVendorStatus = async (req, res) => {
  const { vendorId } = req.params;  // Get vendorId from the URL params
  const { status } = req.body;      // Get the new status from the request body

  if (!vendorId || !status) {
    return res.status(400).json({ error: "vendorId and status are required" });
  }

  try {
    // Check if the vendor exists
    const vendor = await Pharmacy.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor (Pharmacy) not found" });
    }

    // Update the vendor's status
    vendor.status = status;
    await vendor.save();  // Save the updated vendor status to the database

    return res.status(200).json({
      success: true,
      message: `Vendor status updated to ${status}`,
      vendor: {
        name: vendor.name,
        status: vendor.status
      }
    });

  } catch (error) {
    console.error("Error in updateVendorStatus:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};




// 📝 Update vendor profile (with file upload support)
export const updateVendorProfile = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      name,
      email,
      phone,
      address,
      aadhar,
      panCard,
      license,
      status,
      image, // Add image to destructuring here
    } = req.body;

    // Check if vendor exists
    const vendor = await Pharmacy.findById(vendorId); // Assuming your vendor model is named 'Pharmacy'
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // 🌐 Image upload if new image is provided
    let imageUrl = vendor.image;
    if (req.files?.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'vendor_images',
      });
      imageUrl = uploaded.secure_url;
    } else if (image?.startsWith('http')) { // Use image from the request body
      imageUrl = image;
    }

    // 📝 Upload Aadhar, PAN Card, License documents if they exist
    let aadharFileUrl = vendor.aadharFile;
    if (req.files?.aadharFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.aadharFile.tempFilePath, {
        folder: 'vendor_aadhar_docs',
      });
      aadharFileUrl = uploaded.secure_url;
    }

    let panCardFileUrl = vendor.panCardFile;
    if (req.files?.panCardFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.panCardFile.tempFilePath, {
        folder: 'vendor_pancard_docs',
      });
      panCardFileUrl = uploaded.secure_url;
    }

    let licenseFileUrl = vendor.licenseFile;
    if (req.files?.licenseFile) {
      const uploaded = await cloudinary.uploader.upload(req.files.licenseFile.tempFilePath, {
        folder: 'vendor_license_docs',
      });
      licenseFileUrl = uploaded.secure_url;
    }

    // 🔄 Update fields
    vendor.name = name || vendor.name;
    vendor.email = email || vendor.email;
    vendor.phone = phone || vendor.phone;
    vendor.address = address || vendor.address;
    vendor.aadhar = aadhar || vendor.aadhar;
    vendor.panCard = panCard || vendor.panCard;
    vendor.license = license || vendor.license;
    vendor.image = imageUrl;
    vendor.aadharFile = aadharFileUrl;
    vendor.panCardFile = panCardFileUrl;
    vendor.licenseFile = licenseFileUrl;

    // 🟢 Update status if provided
    if (status) {
      const validStatuses = ['Active', 'Inactive', 'Suspended']; // You can add more valid statuses if needed
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      vendor.status = status;
    }

    // Save updated vendor profile
    await vendor.save();

    // Return updated vendor details
    res.status(200).json({
      message: 'Vendor profile updated successfully',
      vendor,
    });

  } catch (error) {
    console.error('Error updating vendor profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Function to add bank details to the vendor's profile
export const addBankDetails = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { accountNumber, ifscCode, branchName, bankName, accountHolderName } = req.body;

    // Validate input
    if (!accountNumber || !ifscCode || !branchName || !bankName || !accountHolderName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find the vendor by ID
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Add bank details to the vendor's bankDetails array
    vendor.bankDetails.push({
      accountNumber,
      ifscCode,
      branchName,
      bankName,
      accountHolderName, // Add account holder name to the bank details
    });

    // Save the vendor after adding the new bank details
    await vendor.save();

    // Return updated vendor details
    res.status(200).json({
      message: "Bank details added successfully",
      vendor,
    });
  } catch (error) {
    console.error("Error adding bank details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Function to edit bank details for the vendor
export const editBankDetails = async (req, res) => {
  try {
    const { vendorId, bankDetailId } = req.params; // Extract vendorId and bankDetailId from the URL params
    const { accountNumber, ifscCode, branchName, bankName, accountHolderName } = req.body;


    // Find the vendor by ID
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Find the bank detail by ID
    const bankDetail = vendor.bankDetails.id(bankDetailId); // Find the bank detail using bankDetailId
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank detail not found" });
    }

    // Update bank details
    bankDetail.accountNumber = accountNumber || bankDetail.accountNumber;
    bankDetail.ifscCode = ifscCode || bankDetail.ifscCode;
    bankDetail.branchName = branchName || bankDetail.branchName;
    bankDetail.bankName = bankName || bankDetail.bankName;
    bankDetail.accountHolderName = accountHolderName || bankDetail.accountHolderName;

    // Save the vendor after updating the bank detail
    await vendor.save();

    // Return the updated vendor details
    res.status(200).json({
      message: "Bank details updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("Error updating bank details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const getPrescriptionsForVendor = async (req, res) => {
  const { vendorId } = req.params; // Get vendorId from URL params

  if (!vendorId) {
    return res.status(400).json({ error: "vendorId is required" });
  }

  try {
    // Check if the vendor exists (Pharmacy in this case)
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor (Pharmacy) not found" });
    }

    // Find all prescriptions where pharmacyId matches the vendorId
    const prescriptions = await Prescription.find({
      pharmacyId: vendorId // We check if the pharmacyId matches the vendorId
    })
      .sort({ createdAt: -1 }) // Sort prescriptions by createdAt in descending order
      .populate({
        path: 'userId', // Populate the userId field
        select: 'name' // Select only the name field from the User model
      });

    if (prescriptions.length === 0) {
      return res.status(404).json({ message: "No prescriptions found for this vendor" });
    }

    // Clean the prescription data to only include relevant fields
    const cleanPrescriptions = prescriptions.map(prescription => ({
      prescriptionId: prescription._id, // Add Prescription ID
      userId: prescription.userId ? {
        userid: prescription.userId._id, // Add userId for reference
        name: prescription.userId.name || "Unknown" // Safely access user name
      } : { name: "Unknown" },
      prescriptionUrl: prescription.prescriptionUrl,
      status: prescription.status,
      createdAt: prescription.createdAt, // Or any other fields you want to include
    }));

    // Return the cleaned prescription data
    return res.status(200).json({
      success: true,
      vendor: vendor.name,  // Return vendor name in the response
      prescriptions: cleanPrescriptions  // Send the cleaned prescriptions
    });

  } catch (error) {
    console.error("Error in getPrescriptionsForVendor:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};







// 📦 Get pending orders for a vendor
export const getPendingOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // ✅ FIX: Correct query to find pending responses for this vendor
    const pendingOrders = await Order.find({
      pharmacyResponses: {
        $elemMatch: {
          pharmacyId: vendorId,
          status: 'Pending'
        }
      }
    })
      .populate("assignedRider")
      .populate("userId", "name email mobile")
      .populate({
        path: 'orderItems.medicineId',
        populate: {
          path: 'pharmacyId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: 'Pending orders fetched successfully',
      orders: pendingOrders.map(order => ({
        ...order.toObject(),
        assignedRider: order.assignedRider ? {
          _id: order.assignedRider._id,
          name: order.assignedRider.name,
          email: order.assignedRider.email,
          phone: order.assignedRider.phone,
          address: order.assignedRider.address,
          city: order.assignedRider.city,
          state: order.assignedRider.state,
          pinCode: order.assignedRider.pinCode,
          profileImage: order.assignedRider.profileImage,
          rideImages: order.assignedRider.rideImages,
          deliveryCharge: order.assignedRider.deliveryCharge,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching pending orders for vendor:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};





export const getPrescriptionOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Step 1: Find all medicines that belong to this vendor
    const vendorMedicines = await Medicine.find({ pharmacyId: vendorId }, '_id');
    const medicineIds = vendorMedicines.map(med => med._id);

    if (medicineIds.length === 0) {
      return res.status(200).json({
        message: 'No orders found for this vendor (no medicines listed).',
        orders: [],
      });
    }

    // Step 2: Find all orders with these medicine IDs in orderItems, and isPrescriptionOrder: true
    const orders = await Order.find({
      'orderItems.medicineId': { $in: medicineIds },
      isPrescriptionOrder: true,  // Only fetch prescription orders
    })
      .populate("assignedRider")  // Populate assigned rider details
      .populate("userId", "userId name email mobile") // Populate user details: name, email, and phone
      .sort({ createdAt: -1 }); // Sort orders by newest first

    if (orders.length === 0) {
      return res.status(404).json({ message: "No prescription orders found for this vendor" });
    }

    // Step 3: Send response
    return res.status(200).json({
      message: 'Prescription orders fetched successfully',
      orders: orders.map(order => ({
        ...order.toObject(),
        assignedRider: order.assignedRider ? {
          _id: order.assignedRider._id,
          name: order.assignedRider.name,
          email: order.assignedRider.email,
          phone: order.assignedRider.phone,
          address: order.assignedRider.address,
          city: order.assignedRider.city,
          state: order.assignedRider.state,
          pinCode: order.assignedRider.pinCode,
          profileImage: order.assignedRider.profileImage,
          rideImages: order.assignedRider.rideImages,
          deliveryCharge: order.assignedRider.deliveryCharge,
        } : null,
        user: order.userId ? {
          name: order.userId.name,
          email: order.userId.email,
          mobile: order.userId.mobile,
          userId: order.userId.userId
        } : null, // Add user info here
      })),
    });
  } catch (error) {
    console.error('Error fetching prescription orders for vendor:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// 📦 Get delivered orders for a vendor
export const getDeliveredOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Find orders assigned to this vendor and delivered
    const deliveredOrders = await Order.find({
      assignedPharmacy: vendorId,
      status: 'Delivered',
    })
      .populate("assignedRider")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: 'Delivered orders fetched successfully',
      orders: deliveredOrders.map(order => ({
        ...order.toObject(),
        assignedRider: order.assignedRider ? {
          _id: order.assignedRider._id,
          name: order.assignedRider.name,
          email: order.assignedRider.email,
          phone: order.assignedRider.phone,
          address: order.assignedRider.address,
          city: order.assignedRider.city,
          state: order.assignedRider.state,
          pinCode: order.assignedRider.pinCode,
          profileImage: order.assignedRider.profileImage,
          rideImages: order.assignedRider.rideImages,
          deliveryCharge: order.assignedRider.deliveryCharge,
        } : null,
        user: order.userId ? {
          name: order.userId.name,
          phone: order.userId.mobile,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching delivered orders for vendor:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};





export const createOrderFromPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.body;
    const { medicineDetails, notes, paymentMethod, paymentStatus } = req.body;
    const { vendorId, userId } = req.params;

    // Validate vendorId and userId
    if (!mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid vendorId or userId" });
    }

    // Find the prescription by ID
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    // Find the user associated with the userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch the pharmacy details associated with the vendorId
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ error: "Vendor (Pharmacy) not found" });
    }

    // Fetch user's first address (assuming the first address is the preferred one)
    const userAddress = user.myAddresses[0];
    if (!userAddress) {
      return res.status(404).json({ message: "User's address not found" });
    }

    // Create the delivery address object
    const deliveryAddress = {
      house: userAddress.house,
      street: userAddress.street,
      city: userAddress.city,
      state: userAddress.state,
      pincode: userAddress.pincode,
      country: userAddress.country,
    };

    // Manually creating order items based on vendor's manual entry, now using MRP instead of price
    const orderItems = medicineDetails.map((item) => ({
      medicineId: item.medicineId,
      name: item.name,
      quantity: item.quantity,
      mrp: item.mrp,  // MRP instead of price
      dosage: item.dosage,
      instructions: item.instructions,
    }));

    // Calculate Subtotal (price of all items without taxes/discounts)
    const subtotal = orderItems.reduce((acc, item) => acc + item.mrp * item.quantity, 0);

    // Optional: Add tax, discounts, shipping fees, etc.
    const taxRate = 0.18;  // Example: 18% tax
    const shippingFee = 50; // Example: Flat shipping fee
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount + shippingFee;  // Final total after adding tax and shipping

    // Create the order with additional information
    const newOrder = new Order({
      userId: userId,
      pharmacyId: pharmacy._id,
      vendorId: vendorId,
      deliveryAddress: deliveryAddress,  // Delivery address is now stored as an object
      subtotal,  // Store subtotal
      total,     // Store total
      totalAmount: total,
      orderItems,
      notes: notes || "",
      paymentMethod,
      paymentStatus: paymentStatus || "Pending",
      status: "Pending",
      isPrescriptionOrder: true,  // Mark this as a prescription-based order
      statusTimeline: [{
        status: "Pending",
        message: "Order placed by vendor",
        timestamp: new Date(),
      }],
      assignedRider: null,       // No rider assigned yet
      assignedRiderStatus: null, // Rider status is null
    });



    newOrder.assignedPharmacy = vendorId;

    // Save the order
    await newOrder.save();

    // Optionally notify the user
    user.notifications.push({
      orderId: newOrder._id,
      status: "Pending",
      message: `Your order has been placed successfully.`,
      timestamp: new Date(),
      read: false,
    });
    await user.save();

    return res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Error creating order from prescription:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// Update Prescription Status
export const updatePrescriptionStatus = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { status } = req.body;

    // Validate input
    if (!status) {
      return res.status(400).json({ message: "Status is required." });
    }

    // Update the prescription status
    const prescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      { status },
      { new: true } // Return the updated document
    );

    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    res.status(200).json({
      message: "Prescription status updated successfully.",
      prescription,
    });
  } catch (error) {
    console.error("Error updating prescription status:", error);
    res.status(500).json({ message: "Error updating prescription status", error: error.message });
  }
};



// Fetch all periodic orders for a vendor
export const getAllPeriodicOrdersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Step 1: Find all medicines that belong to this vendor
    const vendorMedicines = await Medicine.find({ pharmacyId: vendorId }, '_id');
    const medicineIds = vendorMedicines.map(med => med._id);

    if (medicineIds.length === 0) {
      return res.status(200).json({
        message: 'No medicines found for this vendor.',
        orders: [],
      });
    }

    // Step 2: Find all periodic orders (orders with planType) related to these medicine IDs
    const orders = await Order.find({
      'orderItems.medicineId': { $in: medicineIds },
      planType: { $exists: true, $ne: null }, // Orders with defined planType (periodic orders)
    })
      .populate('assignedRider', 'name phone') // Populate assigned rider info
      .populate('userId', 'name email mobile') // Populate user info
      .sort({ deliveryDate: -1 }); // Sort orders by deliveryDate descending

    if (orders.length === 0) {
      return res.status(200).json({ message: "No periodic orders found for this vendor" });
    }

    // Step 3: Send response with null-safe user check
    return res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        _id: order._id,
        userId: order.userId ? {
          _id: order.userId._id,
          name: order.userId.name,
          email: order.userId.email,
          mobile: order.userId.mobile,
        } : null,  // 🟢 Safe fallback if userId is null
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
    console.error("Error fetching periodic orders for vendor:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};





export const createVendorQuery = async (req, res) => {
  try {
    // Destructure the body to get the necessary fields
    const { vendorId, name, email, mobile, message } = req.body;

    // Validate that vendorId exists (optional but recommended)
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    // Create a new query document for the vendor
    const query = new Query({
      vendorId,
      name,
      email,
      mobile,
      message,
    });

    // Save the query to the database
    await query.save();

    // Send response
    res.status(201).json({ message: "Query submitted successfully", query });
  } catch (error) {
    // Handle any errors
    console.error("Error creating vendor query:", error);
    res.status(500).json({ message: "Error creating query", error });
  }
};


export const getVendorQueries = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Optional: Validate vendorId format
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendorId" });
    }

    // Find queries by vendorId
    const queries = await Query.find({ vendorId });

    if (!queries.length) {
      return res.status(200).json({ message: "No queries found for this vendor" });
    }

    // Send queries in response
    res.status(200).json({ queries });
  } catch (error) {
    console.error("Error fetching vendor queries:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




export const getAllNotificationsForVendor = async (req, res) => {
  try {
    // Extract vendorId from params
    const { vendorId } = req.params;

    // Validate vendorId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    // Find the vendor using the vendorId
    const pharmacy = await Pharmacy.findById(vendorId);

    if (!pharmacy) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Fetch all notifications for this vendor
    const notifications = pharmacy.notifications;

    // Send the notifications as a response
    return res.status(200).json({
      message: "Notifications fetched successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      message: "Server error while fetching notifications",
      error: error.message,
    });
  }
};



export const deleteNotificationForVendor = async (req, res) => {
  try {
    // Extract vendorId and notificationId from params
    const { vendorId, notificationId } = req.params;

    // Validate vendorId and notificationId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    // Find the vendor (pharmacy) by vendorId
    const pharmacy = await Pharmacy.findById(vendorId);

    if (!pharmacy) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Check if the notification exists in the vendor's notifications
    const notificationIndex = pharmacy.notifications.findIndex(
      (notification) => notification._id.toString() === notificationId
    );

    if (notificationIndex === -1) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Remove the notification from the notifications array
    pharmacy.notifications.splice(notificationIndex, 1);

    // Save the updated pharmacy document
    await pharmacy.save();

    // Send a success response
    return res.status(200).json({
      message: "Notification deleted successfully",
      notifications: pharmacy.notifications, // Optional: return the updated notifications array
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      message: "Server error while deleting notification",
      error: error.message,
    });
  }
};


export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;  // Get the orderId from the route parameter

    // Find and delete the order in the database by ID
    const order = await Order.findByIdAndDelete(orderId);

    // If the order does not exist
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const getVendorWallet = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Validate vendorId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    // Find the vendor (pharmacy) using vendorId
    const pharmacy = await Pharmacy.findById(vendorId);

    if (!pharmacy) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Return wallet info
    return res.status(200).json({
      message: "Vendor wallet fetched successfully",
      walletBalance: pharmacy.wallet || 0,
      walletTransactions: pharmacy.walletTransactions || [],
    });

  } catch (error) {
    console.error("Error fetching vendor wallet:", error);
    return res.status(500).json({
      message: "Server error while fetching vendor wallet",
      error: error.message,
    });
  }
};



// Add bank account
export const addBankAccount = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      accountType = "savings",
      upiId,
      branchName,
      isDefault = false,
    } = req.body;

    console.log("Received vendorId:", vendorId);

    // ✅ Validate vendorId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    // ✅ Find vendor using vendorId
    const vendor = await Pharmacy.findById(vendorId);
    console.log("Vendor fetched:", vendor);

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    // ✅ Check if account already exists for this vendor
    const existingAccount = await BankAccount.findOne({
      vendor: vendorId,
      $or: [
        { accountNumber: accountNumber },
        { upiId: upiId || null }
      ]
    });

    if (existingAccount) {
      return res.status(400).json({ success: false, message: "Bank account or UPI ID already exists" });
    }

    // ✅ Make first account default if needed
    const accountCount = await BankAccount.countDocuments({ vendor: vendorId });
    const defaultAccount = accountCount === 0 ? true : isDefault;

    // ✅ Create new bank account
    const bankAccount = new BankAccount({
      vendor: vendorId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
      upiId,
      branchName,
      isDefault: defaultAccount,
      status: "pending_verification"
    });

    await bankAccount.save();

    console.log("Bank account added:", bankAccount._id);

    return res.status(201).json({
      success: true,
      message: "Bank account added successfully",
      accountId: bankAccount._id,
      bankAccount
    });

  } catch (error) {
    console.error("Error adding bank account:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get all bank accounts
export const getBankAccounts = async (req, res) => {
 try {
    const { vendorId } = req.params;

    // ✅ Find vendor using vendorId
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const accounts = await BankAccount.find({ vendor: vendorId }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({ success: true, message: 'Bank accounts fetched successfully', accounts });

  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update bank account
export const updateBankAccount = async (req, res) => {
  try {
    const { vendorId, accountId } = req.params;
    const updateData = req.body;

    // ✅ Find vendor using vendorId
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // Check if account belongs to vendor
    const account = await BankAccount.findOne({ _id: accountId, vendor: vendorId });
    if (!account) return res.status(404).json({ success: false, message: 'Bank account not found' });

    delete updateData._id;
    delete updateData.vendor;
    delete updateData.createdAt;
    delete updateData.addedAt;

    if (updateData.accountNumber && updateData.accountNumber !== account.accountNumber) {
      const duplicateAccount = await BankAccount.findOne({ vendor: vendorId, accountNumber: updateData.accountNumber, _id: { $ne: accountId } });
      if (duplicateAccount) return res.status(400).json({ success: false, message: 'Account number already exists' });
    }

    if (updateData.isDefault === true) {
      await BankAccount.updateMany({ vendor: vendorId, _id: { $ne: accountId } }, { $set: { isDefault: false } });
    }

    const updatedAccount = await BankAccount.findByIdAndUpdate(accountId, { $set: updateData }, { new: true, runValidators: true });

    res.status(200).json({ success: true, message: 'Bank account updated successfully', bankAccount: updatedAccount });

  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete bank account
export const deleteBankAccount = async (req, res) => {
   try {
    const { vendorId, accountId } = req.params;

    // ✅ Find vendor using vendorId
    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const account = await BankAccount.findOne({ _id: accountId, vendor: vendorId });
    if (!account) return res.status(404).json({ success: false, message: 'Bank account not found' });

    if (account.isDefault) return res.status(400).json({ success: false, message: 'Cannot delete default account. Set another account as default first.' });

    const pendingWithdrawals = await WithdrawalRequest.countDocuments({ bankAccount: accountId, status: { $in: ['pending', 'processing'] } });
    if (pendingWithdrawals > 0) return res.status(400).json({ success: false, message: 'Cannot delete account with pending withdrawal requests' });

    await BankAccount.findByIdAndDelete(accountId);

    res.status(200).json({ success: true, message: 'Bank account deleted successfully' });

  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Request withdrawal
export const requestWithdrawal = async (req, res) => {
  try {
    const { vendorId } = req.params; // vendorId from params
    const { amount, accountId, paymentMethod = 'bank_transfer' } = req.body;

    // Validate vendorId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    // Find vendor (pharmacy)
    const pharmacy = await Pharmacy.findById(vendorId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Minimum withdrawal check
    if (amount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹100' });
    }

    // Sufficient balance check
    if (amount > pharmacy.wallet) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Check active bank account
    const bankAccount = await BankAccount.findOne({
      _id: accountId,
      vendor: vendorId,
    });

    // Create withdrawal request
    const withdrawalRequest = new VendorWithdrawal({
      vendor: vendorId,
      bankAccount: accountId,
      amount,
      paymentMethod,
      status: 'Requested'
    });

    await withdrawalRequest.save();

    // Debit pharmacy wallet
    pharmacy.wallet -= amount;
    pharmacy.walletTransactions.push({
      amount,
      type: 'debit',
      orderId: withdrawalRequest._id,
      createdAt: new Date()
    });

    await pharmacy.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawalRequest,
      newBalance: pharmacy.wallet
    });

  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get withdrawal requests
export const getWithdrawalRequests = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status, startDate, endDate, limit = 10, page = 1 } = req.query;

    const vendor = await Pharmacy.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Build query
    const query = { vendor: vendorId };

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
      .populate('bankAccount', 'bankName accountNumber ifscCode accountHolderName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VendorWithdrawal.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Withdrawal requests fetched successfully',
      withdrawals,
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