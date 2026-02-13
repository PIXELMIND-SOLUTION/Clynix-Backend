
import Order from "../Models/Order.js";
import Rider from "../Models/Rider.js";
import mongoose from "mongoose";
import moment from 'moment'; // Optional, but helpful
import withdrawalRequestModel from "../Models/withdrawalRequestModel.js";
import cloudinary from '../config/cloudinary.js';
import Query from "../Models/Query.js";
import User from "../Models/User.js";
import Pharmacy from "../Models/Pharmacy.js";
import Medicine from "../Models/Medicine.js";




export const signupRider = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Check if phone already registered
    const existingRider = await Rider.findOne({ phone });
    if (existingRider) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    let drivingLicenseUrl = "";
    let profileImageUrl = "";
    let drivingLicenseStatus = "Pending"; // Default status

    // 📂 Driving License Upload
    if (req.files && req.files.drivingLicense) {
      const file = req.files.drivingLicense;
      const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "rider_licenses",
      });
      drivingLicenseUrl = uploaded.secure_url;
    } else if (req.body.drivingLicense && req.body.drivingLicense.startsWith("http")) {
      drivingLicenseUrl = req.body.drivingLicense;
    } else {
      return res.status(400).json({ message: "Driving license is required (upload or URL)" });
    }

    // 📷 Profile Image Upload (optional but recommended)
    if (req.files && req.files.profileImage) {
      const profileFile = req.files.profileImage;
      const uploadedProfile = await cloudinary.uploader.upload(profileFile.tempFilePath, {
        folder: "rider_profiles",
      });
      profileImageUrl = uploadedProfile.secure_url;
    } else if (req.body.profileImage && req.body.profileImage.startsWith("http")) {
      profileImageUrl = req.body.profileImage;
    }

    // 🆕 Create new rider
    const newRider = new Rider({
      name,
      email,
      phone,
      password,
      drivingLicense: drivingLicenseUrl,
      drivingLicenseStatus,
      profileImage: profileImageUrl || "", // Optional
    });

    await newRider.save();

    res.status(201).json({
      message: "Rider registered successfully",
      rider: newRider,
    });
  } catch (error) {
    console.error("🔥 Signup Rider Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const loginRider = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    // Find rider and select the password
    const rider = await Rider.findOne({ phone }).select("+password");

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Check if driving license status is "Approved"
    if (rider.drivingLicenseStatus !== "Approved") {
      return res.status(403).json({ message: "Your driving license is not approved yet. Please wait for approval." });
    }

    // Simple password match
    if (String(password).trim() !== String(rider.password).trim()) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Remove password from response
    const { password: _, ...riderData } = rider.toObject();

    return res.status(200).json({
      message: "Login successful",
      rider: riderData,
    });
  } catch (error) {
    console.error("Login Rider Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const getRiderProfile = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    // 🧠 Get rider by ID (include password if needed, or exclude)
    const rider = await Rider.findById(riderId).select('-password'); // hiding password for safety

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Rider profile fetched successfully",
      rider,
    });
  } catch (error) {
    console.error("🔥 Get Rider Profile Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// ✅ Forgot Password (by email) without bcrypt
export const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Email, new password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await Rider.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // ⚠️ Save password directly (NOT recommended in production)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const updateRiderProfileImage = async (req, res) => {
  try {
    const { riderId } = req.params;

    // ✅ Check if file exists
    if (!req.files?.profileImage) {
      return res.status(400).json({ message: "Profile image file is required" });
    }

    // ✅ Find rider
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // 🌟 Upload new profile image to Cloudinary
    const uploaded = await cloudinary.uploader.upload(
      req.files.profileImage.tempFilePath,
      { folder: "riders/profile" }
    );

    // 🛠️ Update profileImage field
    rider.profileImage = uploaded.secure_url;
    await rider.save();

    return res.status(200).json({
      message: "Profile image updated successfully",
      rider,
    });
  } catch (error) {
    console.error("Update Profile Image Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};





export const getRiderOrderStats = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { filter = 'thisWeek' } = req.query;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    // 📅 Generate date range based on filter
    let startDate = new Date();
    let endDate = new Date();

    switch (filter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'thisWeek':
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
        const diffToMonday = (dayOfWeek + 6) % 7; // convert to Mon-based
        startDate.setDate(today.getDate() - diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'lastMonth':
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      default:
        const d = new Date();
        const dow = d.getDay();
        const diff = (dow + 6) % 7;
        startDate.setDate(d.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
    }

    // 🔍 Get ALL orders in date range (not just completed)
    const allOrders = await Order.find({
      assignedRider: riderId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('assignedRider', 'deliveryCharge');

    const pendingCount = allOrders.filter(o => o.status === 'Pending').length;
    const cancelledCount = allOrders.filter(o => o.status === 'Cancelled').length;
    const completedOrders = allOrders.filter(o => ['Completed', 'Delivered'].includes(o.status));
    const completedCount = completedOrders.length;
    const totalToday = allOrders.length;

    // 🧮 Earnings per day
    const earningsPerDay = {
      Mon: 0, Tue: 0, Wed: 0, Thu: 0,
      Fri: 0, Sat: 0, Sun: 0,
    };
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const order of completedOrders) {
      const dayIndex = new Date(order.createdAt).getDay();
      const dayName = days[dayIndex];
      const riderCharge = order?.assignedRider?.deliveryCharge || 0;
      earningsPerDay[dayName] += riderCharge;
    }

    const totalEarnings = completedOrders.reduce(
      (sum, o) => sum + (o?.assignedRider?.deliveryCharge || 0),
      0
    );

    // ✅ Final Response
    return res.status(200).json({
      message: "Rider stats fetched successfully",
      filterUsed: filter,
      orders: {
        todayOrders: totalToday,
        pending: pendingCount,
        cancelled: cancelledCount,
        completed: completedCount,
      },
      earnings: {
        totalEarnings,
        earningsPerDay
      }
    });

  } catch (error) {
    console.error("Get Rider Order Stats Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// Utility function to calculate distance (in kilometers) between two coordinates using Haversine formula
const calculateDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Calculate estimated time based on distance and average speed
const calculateTime = (distance) => {
  const speed = 30; // Speed in km/h, assuming a rider's average speed
  const timeInHours = distance / speed; // Time in hours
  const timeInMinutes = Math.round(timeInHours * 60); // Convert time to minutes
  return timeInMinutes;
};

// Add time to a given timestamp (order creation time)
const addMinutesToTime = (time, minutesToAdd) => {
  const newTime = new Date(time);
  newTime.setMinutes(newTime.getMinutes() + minutesToAdd);
  return newTime;
};

// Format a date into 12-hour format (AM/PM)
const formatTimeTo12Hour = (date) => {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12; // Convert 24-hour to 12-hour format
  hours = hours ? hours : 12; // '0' becomes 12
  minutes = minutes < 10 ? '0' + minutes : minutes; // Add leading zero if needed
  return `${hours}:${minutes} ${ampm}`;
};

// // Controller to get new orders for the rider
// export const getNewOrdersForRiderController = async (req, res) => {
//   try {
//     const { riderId } = req.params;

//     console.log("🚀 Fetching orders for riderId:", riderId);

//     if (!mongoose.Types.ObjectId.isValid(riderId)) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Invalid rider ID" 
//       });
//     }

//     // Step 1: Check if rider exists
//     const rider = await Rider.findById(riderId);
//     if (!rider) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Rider not found" 
//       });
//     }
//     console.log("✅ Rider found:", rider.fullName);

//     // Step 2: Fetch orders without populate first
//     const rawOrders = await Order.find({ 
//       assignedRider: new mongoose.Types.ObjectId(riderId), 
//       assignedRiderStatus: 'Assigned' 
//     }).lean();

//     console.log(`📦 Raw orders found: ${rawOrders.length}`);

//     if (rawOrders.length === 0) {
//       return res.status(200).json({ 
//         success: true,
//         message: 'No new orders assigned to you',
//         newOrders: [] 
//       });
//     }

//     // Step 3: Now populate with correct paths
//     const newOrders = await Order.find({ 
//       assignedRider: new mongoose.Types.ObjectId(riderId), 
//       assignedRiderStatus: 'Assigned' 
//     })
//     .populate({
//       path: 'orderItems.medicineId',
//       model: 'Medicine', 
//       select: 'name mrp description images pharmacyId'
//     })
//     .populate({
//       path: 'userId',
//       model: 'User', 
//       select: 'name mobile location'
//     })
//     .populate({
//       path: 'pharmacyResponses.pharmacyId',
//       model: 'Pharmacy', 
//       select: 'name address contactNumber latitude longitude'
//     })
//     .lean();

//     console.log(`✅ Orders after populate: ${newOrders.length}`);

//     if (newOrders.length === 0) {
//       return res.status(200).json({ 
//         success: true,
//         message: 'No new orders assigned to you',
//         newOrders: [] 
//       });
//     }

//     // Step 4: Debug populate results
//     const firstOrder = newOrders[0];
//     console.log("🔍 First order after populate:");
//     console.log("- OrderItems length:", firstOrder.orderItems?.length);
//     console.log("- First medicineId:", firstOrder.orderItems?.[0]?.medicineId);
//     console.log("- Pharmacy responses:", firstOrder.pharmacyResponses);

//     const riderLat = parseFloat(rider.latitude);
//     const riderLon = parseFloat(rider.longitude);
//     const deliveryCharge = parseFloat(rider.deliveryCharge) || 0;

//     // Helper functions (no changes here)
//     const calculateDistance = (point1, point2) => {
//       const [lon1, lat1] = point1;
//       const [lon2, lat2] = point2;
//       const R = 6371; // Earth's radius in kilometers
//       const dLat = (lat2 - lat1) * Math.PI / 180;
//       const dLon = (lon2 - lon1) * Math.PI / 180;
//       const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
//                 Math.sin(dLon / 2) * Math.sin(dLon / 2);
//       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//       return R * c;
//     };

//     const calculateTime = (distance) => {
//       const averageSpeed = 20; // km/h
//       const timeInHours = distance / averageSpeed;
//       return timeInHours * 60;
//     };

//     const addMinutesToTime = (date, minutes) => {
//       return new Date(date.getTime() + minutes * 60000);
//     };

//     const formatTimeTo12Hour = (date) => {
//       return date.toLocaleTimeString('en-US', {
//         hour: '2-digit',
//         minute: '2-digit',
//         hour12: true
//       });
//     };


//     // Step 6: Process orders - Process all accepted pharmacies
//     const updatedOrders = newOrders.map(order => {
//       console.log(`\n🔧 Processing order: ${order._id}`);

//       if (!order.orderItems || order.orderItems.length === 0) {
//         console.log("❌ Order has no items");
//         return null;
//       }

//       // Here, I will show the pharmacy responses directly.
//       const acceptedPharmacies = order.pharmacyResponses.filter(response => response.status === "Accepted");

//       if (acceptedPharmacies.length === 0) {
//         console.log("❌ No accepted pharmacies found");
//         return null; // You can handle this differently if needed
//       }

//       const user = order.userId;
//       if (!user) {
//         console.log("❌ User not found");
//         return null;
//       }

//       // Check user location
//       let userLocation = null;
//       if (user.location && user.location.coordinates) {
//         userLocation = user.location.coordinates;
//       } else if (Array.isArray(user.location)) {
//         userLocation = user.location;
//       } else if (user.location && user.location.longitude && user.location.latitude) {
//         userLocation = [user.location.longitude, user.location.latitude];
//       }

//       if (!userLocation || userLocation.length < 2) {
//         console.log("❌ User location missing or invalid");
//         return null;
//       }

      
//       // Now returning only the pharmacy responses in `order.pharmacyResponses`
//       return {
//         order: {
//           _id: order._id,
//           orderId: `ORD${order._id.toString().substring(0, 8).toUpperCase()}`,
//           userId: order.userId,
//           deliveryAddress: order.deliveryAddress,
//           orderItems: order.orderItems,
//           totalAmount: order.totalAmount,
//           status: order.status,
//           notes: order.notes,
//           paymentMethod: order.paymentMethod,
//           createdAt: order.createdAt,
//           pharmacyResponses: acceptedPharmacies // Show only the accepted pharmacies here
//         }
//       };
//     }).filter(order => order !== null);

//     console.log(`🎯 Final orders to return: ${updatedOrders.length}`);

//     return res.status(200).json({ 
//       success: true,
//       message: updatedOrders.length > 0 ? 'New orders fetched successfully' : 'No orders with complete location data',
//       newOrders: updatedOrders
//     });
//   } catch (error) {
//     console.error("❌ Error fetching new orders for rider:", error);
//     return res.status(500).json({ 
//       success: false,
//       message: "Server error while fetching new orders.",
//       error: error.message 
//     });
//   }
// };


// Extend the existing getNewOrdersForRiderController with pharmacy pickup info
export const getNewOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    console.log("🚀 Fetching orders for riderId:", riderId);

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid rider ID" 
      });
    }

    // Step 1: Check if rider exists
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ 
        success: false, 
        message: "Rider not found" 
      });
    }
    console.log("✅ Rider found:", rider.name);

    // Step 2: Fetch orders without populate first
    const rawOrders = await Order.find({ 
      assignedRider: new mongoose.Types.ObjectId(riderId), 
      assignedRiderStatus: 'Assigned' 
    }).lean();

    console.log(`📦 Raw orders found: ${rawOrders.length}`);

    if (rawOrders.length === 0) {
      return res.status(200).json({ 
        success: true,
        message: 'No new orders assigned to you',
        newOrders: [] 
      });
    }

    // Step 3: Now populate with correct paths
    const newOrders = await Order.find({ 
      assignedRider: new mongoose.Types.ObjectId(riderId), 
      assignedRiderStatus: 'Assigned' 
    })
    .populate({
      path: 'orderItems.medicineId',
      model: 'Medicine', 
      select: 'name mrp description images pharmacyId'
    })
    .populate({
      path: 'userId',
      model: 'User', 
      select: 'name mobile location'
    })
    .populate({
      path: 'pharmacyResponses.pharmacyId',
      model: 'Pharmacy', 
      select: 'name address vendorPhone latitude longitude image'
    })
    .lean();

    console.log(`✅ Orders after populate: ${newOrders.length}`);

    if (newOrders.length === 0) {
      return res.status(200).json({ 
        success: true,
        message: 'No new orders assigned to you',
        newOrders: [] 
      });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);
    const deliveryCharge = parseFloat(rider.deliveryCharge) || 0;

    // Helper functions for distance calculation
    const calculateDistance = (point1, point2) => {
      const [lon1, lat1] = point1;
      const [lon2, lat2] = point2;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const calculateTime = (distance) => {
      const averageSpeed = 20;
      const timeInHours = distance / averageSpeed;
      return timeInHours * 60;
    };

    const addMinutesToTime = (date, minutes) => {
      return new Date(date.getTime() + minutes * 60000);
    };

    const formatTimeTo12Hour = (date) => {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    // Process orders - Enhanced with pharmacy pickup information
    const updatedOrders = newOrders.map(order => {
      console.log(`\n🔧 Processing order: ${order._id}`);

      if (!order.orderItems || order.orderItems.length === 0) {
        console.log("❌ Order has no items");
        return null;
      }

      const acceptedPharmacies = order.pharmacyResponses.filter(response => response.status === "Accepted");

      if (acceptedPharmacies.length === 0) {
        console.log("❌ No accepted pharmacies found");
        return null;
      }

      const user = order.userId;
      if (!user) {
        console.log("❌ User not found");
        return null;
      }

      // Check user location
      let userLocation = null;
      if (user.location && user.location.coordinates) {
        userLocation = user.location.coordinates;
      } else if (Array.isArray(user.location)) {
        userLocation = user.location;
      } else if (user.location && user.location.longitude && user.location.latitude) {
        userLocation = [user.location.longitude, user.location.latitude];
      }

      if (!userLocation || userLocation.length < 2) {
        console.log("❌ User location missing or invalid");
        return null;
      }

      // ============= EXTENSION: Add pharmacy pickup information =============
      // Group order items by pharmacy for pickup information
      const pharmacyPickupMap = {};
      
      order.orderItems.forEach(item => {
        if (item.medicineId && item.medicineId.pharmacyId) {
          const pharmacyId = item.medicineId.pharmacyId._id?.toString() || item.medicineId.pharmacyId.toString();
          
          if (!pharmacyPickupMap[pharmacyId]) {
            // Find pharmacy response details
            const pharmacyResponse = acceptedPharmacies.find(
              response => response.pharmacyId._id?.toString() === pharmacyId || 
                         response.pharmacyId.toString() === pharmacyId
            );
            
            pharmacyPickupMap[pharmacyId] = {
              pharmacyId: pharmacyId,
              pharmacyName: item.medicineId.pharmacyId.name || 'Unknown Pharmacy',
              pharmacyAddress: item.medicineId.pharmacyId.address || 'Address not available',
              pharmacyPhone: item.medicineId.pharmacyId.vendorPhone || 'Phone not available',
              pharmacyLatitude: item.medicineId.pharmacyId.latitude,
              pharmacyLongitude: item.medicineId.pharmacyId.longitude,
              pharmacyImage: item.medicineId.pharmacyId.image || null,
              responseStatus: pharmacyResponse?.status || 'Accepted',
              medicines: [],
              totalItems: 0,
              isPickupCompleted: false // This will be checked against pickup proofs
            };
          }
          
          // Add medicine to this pharmacy's pickup list
          pharmacyPickupMap[pharmacyId].medicines.push({
            medicineId: item.medicineId._id,
            name: item.medicineId.name,
            mrp: item.medicineId.mrp,
            quantity: item.quantity,
            images: item.medicineId.images || [],
            description: item.medicineId.description,
            isPicked: false // Will be updated based on proofs
          });
          
          pharmacyPickupMap[pharmacyId].totalItems += item.quantity;
        }
      });
      
      // Check which pharmacies already have pickup proofs
      if (order.beforePickupProof && order.beforePickupProof.length > 0) {
        const completedPickups = new Set();
        order.beforePickupProof.forEach(proof => {
          if (proof.pharmacyId) {
            const pharmacyId = proof.pharmacyId.toString();
            completedPickups.add(pharmacyId);
            
            // Mark specific medicines as picked if medicineId exists
            if (proof.medicineId) {
              const medicineId = proof.medicineId.toString();
              if (pharmacyPickupMap[pharmacyId]) {
                pharmacyPickupMap[pharmacyId].medicines.forEach(med => {
                  if (med.medicineId.toString() === medicineId) {
                    med.isPicked = true;
                  }
                });
              }
            }
          }
        });
        
        // Mark pharmacies as completed if all medicines are picked
        Object.keys(pharmacyPickupMap).forEach(pharmacyId => {
          const pharmacyData = pharmacyPickupMap[pharmacyId];
          const allMedicinesPicked = pharmacyData.medicines.every(med => med.isPicked === true);
          pharmacyData.isPickupCompleted = allMedicinesPicked;
        });
      }
      
      // Convert map to array for response
      const pharmacyPickups = Object.values(pharmacyPickupMap);
      
      // Calculate estimated earnings
      let estimatedEarning = 0;
      if (rider.deliveryCharge) {
        // Calculate distance from rider to first pharmacy and then to user
        let totalDistance = 0;
        
        if (pharmacyPickups.length > 0) {
          const firstPharmacy = pharmacyPickups[0];
          // Rider to first pharmacy
          totalDistance += calculateDistance(
            [riderLon, riderLat],
            [parseFloat(firstPharmacy.pharmacyLongitude), parseFloat(firstPharmacy.pharmacyLatitude)]
          );
          
          // Last pharmacy to user
          const lastPharmacy = pharmacyPickups[pharmacyPickups.length - 1];
          totalDistance += calculateDistance(
            [parseFloat(lastPharmacy.pharmacyLongitude), parseFloat(lastPharmacy.pharmacyLatitude)],
            userLocation
          );
        }
        
        estimatedEarning = deliveryCharge + (totalDistance * 2); // Base + per km rate
      }

      // ============= END OF EXTENSION =============

      // Return the enhanced order with pharmacy pickup info and estimated earnings
      return {
        order: {
          _id: order._id,
          orderId: `ORD${order._id.toString().substring(0, 8).toUpperCase()}`,
          userId: order.userId,
          deliveryAddress: order.deliveryAddress,
          orderItems: order.orderItems,
          totalAmount: order.totalAmount,
          status: order.status,
          notes: order.notes,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          pharmacyResponses: acceptedPharmacies,
          // ============= NEW FIELDS ADDED WITHOUT BREAKING EXISTING STRUCTURE =============
          pharmacyPickups: pharmacyPickups, // Array of pharmacies with medicines to pick
          pickupProgress: {
            totalPharmacies: pharmacyPickups.length,
            completedPharmacies: pharmacyPickups.filter(p => p.isPickupCompleted).length,
            totalMedicines: pharmacyPickups.reduce((sum, p) => sum + p.totalItems, 0),
            pickedMedicines: pharmacyPickups.reduce((sum, p) => 
              sum + p.medicines.filter(m => m.isPicked).length, 0
            )
          },
          estimatedEarning: Math.round(estimatedEarning * 100) / 100,
          nextPharmacy: pharmacyPickups.find(p => !p.isPickupCompleted) || null
        }
      };
    }).filter(order => order !== null);

    console.log(`🎯 Final orders to return: ${updatedOrders.length}`);

    return res.status(200).json({ 
      success: true,
      message: updatedOrders.length > 0 ? 'New orders fetched successfully' : 'No orders with complete location data',
      newOrders: updatedOrders
    });
  } catch (error) {
    console.error("❌ Error fetching new orders for rider:", error);
    return res.status(500).json({ 
      success: false,
      message: "Server error while fetching new orders.",
      error: error.message 
    });
  }
};


/**
 * ============================================================
 * SINGLE NEW API - Pharmacy Pickup Verification with Image Capture
 * ============================================================
 * 
 * This API handles:
 * 1. Get single pharmacy pickup details (when no image uploaded)
 * 2. Upload pickup verification image
 * 3. Mark medicines as picked
 * 4. Auto-determine next pharmacy
 * 5. Return final summary when all pharmacies completed
 */
export const pharmacyPickupVerification = async (req, res) => {
  try {
    const { riderId, orderId, pharmacyId } = req.params;
    const { action } = req.query; // 'details' or 'verify'
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || 
        !mongoose.Types.ObjectId.isValid(orderId) ||
        !mongoose.Types.ObjectId.isValid(pharmacyId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid rider ID, order ID, or pharmacy ID" 
      });
    }

    // Verify rider exists and is assigned to this order
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ 
        success: false,
        message: "Rider not found" 
      });
    }

    // Fetch order with all necessary populated fields
    const order = await Order.findOne({
      _id: orderId,
      assignedRider: riderId
    })
    .populate({
      path: 'orderItems.medicineId',
      select: 'name mrp description images pharmacyId',
      populate: {
        path: 'pharmacyId',
        select: 'name address vendorPhone latitude longitude image vendorName vendorEmail'
      }
    })
    .populate({
      path: 'userId',
      select: 'name mobile location'
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: "Order not found or not assigned to this rider" 
      });
    }

    // Get the specific pharmacy details
    const pharmacyObjectId = new mongoose.Types.ObjectId(pharmacyId);
    
    // Filter medicines that belong to this pharmacy
    const pharmacyMedicines = order.orderItems.filter(item => {
      const itemPharmacyId = item.medicineId.pharmacyId._id?.toString() || 
                            item.medicineId.pharmacyId.toString();
      return itemPharmacyId === pharmacyId;
    });

    if (pharmacyMedicines.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "No medicines found for this pharmacy in the order" 
      });
    }

    // Get pharmacy details from first medicine
    const pharmacy = pharmacyMedicines[0].medicineId.pharmacyId;

    // ============= ACTION: GET PHARMACY PICKUP DETAILS =============
    if (action === 'details' || !action) {
      // Check existing pickup proofs for this pharmacy
      const existingProofs = order.beforePickupProof?.filter(
        proof => proof.pharmacyId?.toString() === pharmacyId
      ) || [];

      // Mark which medicines are already picked
      const medicinesWithStatus = pharmacyMedicines.map(item => {
        const isPicked = existingProofs.some(
          proof => proof.medicineId?.toString() === item.medicineId._id.toString()
        );
        
        return {
          medicineId: item.medicineId._id,
          name: item.medicineId.name,
          mrp: item.medicineId.mrp,
          quantity: item.quantity,
          images: item.medicineId.images || [],
          description: item.medicineId.description,
          isPicked: isPicked,
          pickedAt: existingProofs.find(
            p => p.medicineId?.toString() === item.medicineId._id.toString()
          )?.uploadedAt || null
        };
      });

      const allPicked = medicinesWithStatus.every(m => m.isPicked);

      return res.status(200).json({
        success: true,
        action: 'details',
        message: allPicked ? 'All medicines already picked from this pharmacy' : 'Pharmacy pickup details fetched successfully',
        pharmacy: {
          _id: pharmacy._id,
          name: pharmacy.name,
          address: pharmacy.address || 'Address not available',
          phone: pharmacy.vendorPhone || 'Phone not available',
          email: pharmacy.vendorEmail,
          latitude: pharmacy.latitude,
          longitude: pharmacy.longitude,
          image: pharmacy.image || null
        },
        orderInfo: {
          orderId: order._id,
          orderNumber: `ORD${order._id.toString().substring(0, 8).toUpperCase()}`,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount
        },
        medicines: medicinesWithStatus,
        pickupStatus: {
          totalItems: pharmacyMedicines.reduce((sum, item) => sum + item.quantity, 0),
          pickedItems: existingProofs.length,
          allPicked: allPicked,
          pendingItems: allPicked ? 0 : medicinesWithStatus.filter(m => !m.isPicked).length
        },
        existingProofs: existingProofs.map(p => ({
          imageUrl: p.imageUrl,
          uploadedAt: p.uploadedAt,
          medicineId: p.medicineId
        }))
      });
    }

    // ============= ACTION: VERIFY PICKUP WITH IMAGE =============
    if (action === 'verify') {
      const { medicineId } = req.body;
      
      // Validate required fields
      if (!medicineId) {
        return res.status(400).json({
          success: false,
          message: "medicineId is required for pickup verification"
        });
      }

      // Check if medicine belongs to this pharmacy in this order
      const medicineItem = pharmacyMedicines.find(
        item => item.medicineId._id.toString() === medicineId
      );

      if (!medicineItem) {
        return res.status(404).json({
          success: false,
          message: "Medicine not found in this pharmacy's order items"
        });
      }

      // Check if image file is uploaded
      if (!req.files || !req.files.pickupImage) {
        return res.status(400).json({
          success: false,
          message: "Pickup verification image is required"
        });
      }

      // Check if this medicine was already picked
      const alreadyPicked = order.beforePickupProof?.some(
        proof => proof.medicineId?.toString() === medicineId && 
                proof.pharmacyId?.toString() === pharmacyId
      );

      if (alreadyPicked) {
        return res.status(400).json({
          success: false,
          message: "This medicine has already been picked up and verified"
        });
      }

      // Upload image to Cloudinary
      const pickupImage = req.files.pickupImage;
      const uploadedImage = await cloudinary.uploader.upload(pickupImage.tempFilePath, {
        folder: 'rider_pickup_proofs',
        resource_type: 'auto'
      });

      // Initialize beforePickupProof array if it doesn't exist
      if (!order.beforePickupProof) {
        order.beforePickupProof = [];
      }

      // Add pickup proof
      order.beforePickupProof.push({
        riderId: riderId,
        pharmacyId: pharmacyId,
        medicineId: medicineId,
        imageUrl: uploadedImage.secure_url,
        uploadedAt: new Date()
      });

      await order.save();

      // ============= AUTO-DETERMINE NEXT PHARMACY =============
      // Group remaining unpicked medicines by pharmacy
      const allPharmacyMedicines = {};
      
      order.orderItems.forEach(item => {
        const itemPharmacyId = item.medicineId.pharmacyId._id?.toString() || 
                              item.medicineId.pharmacyId.toString();
        
        if (!allPharmacyMedicines[itemPharmacyId]) {
          allPharmacyMedicines[itemPharmacyId] = {
            pharmacyId: itemPharmacyId,
            pharmacy: item.medicineId.pharmacyId,
            medicines: [],
            totalQuantity: 0
          };
        }
        
        // Check if this specific medicine is already picked
        const isPicked = order.beforePickupProof?.some(
          proof => proof.medicineId?.toString() === item.medicineId._id.toString() &&
                  proof.pharmacyId?.toString() === itemPharmacyId
        );
        
        if (!isPicked) {
          allPharmacyMedicines[itemPharmacyId].medicines.push({
            medicineId: item.medicineId._id,
            name: item.medicineId.name,
            quantity: item.quantity,
            mrp: item.medicineId.mrp
          });
          allPharmacyMedicines[itemPharmacyId].totalQuantity += item.quantity;
        }
      });

      // Find next pharmacy with pending medicines
      const pendingPharmacies = Object.values(allPharmacyMedicines).filter(p => p.medicines.length > 0);
      
      let nextPharmacy = null;
      if (pendingPharmacies.length > 0) {
        // Get the first pharmacy with pending medicines (not the current one if completed)
        if (pendingPharmacies[0].pharmacyId === pharmacyId && pendingPharmacies.length > 1) {
          nextPharmacy = pendingPharmacies[1];
        } else {
          nextPharmacy = pendingPharmacies[0];
        }
      }

      // ============= CHECK IF ALL PHARMACIES COMPLETED =============
      const allPharmaciesCompleted = pendingPharmacies.length === 0;
      
      if (allPharmaciesCompleted) {
        // Generate final pickup summary
        const pickupSummary = {
          totalPharmacies: new Set(order.orderItems.map(i => 
            i.medicineId.pharmacyId._id?.toString() || i.medicineId.pharmacyId.toString()
          )).size,
          completedPharmacies: new Set(order.beforePickupProof.map(p => p.pharmacyId?.toString())).size,
          totalMedicines: order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
          pickedMedicines: order.beforePickupProof.length,
          medicinesCollected: order.beforePickupProof.map(p => {
            const med = order.orderItems.find(i => 
              i.medicineId._id.toString() === p.medicineId?.toString()
            );
            return {
              medicineId: p.medicineId,
              name: med?.medicineId?.name || 'Unknown',
              quantity: med?.quantity || 1,
              price: med?.medicineId?.mrp || 0,
              totalValue: (med?.medicineId?.mrp || 0) * (med?.quantity || 1),
              pickedAt: p.uploadedAt,
              pharmacyId: p.pharmacyId,
              imageUrl: p.imageUrl
            };
          }),
          totalOrderValue: order.totalAmount,
          pickupCompletedAt: new Date()
        };

        // Optionally update order status
        if (order.status === 'Assigned' || order.status === 'Accepted') {
          order.status = 'PickedUp';
          order.assignedRiderStatus = 'PickedUp';
          order.statusTimeline.push({
            status: 'PickedUp',
            message: 'All medicines have been picked up from all pharmacies',
            timestamp: new Date()
          });
          await order.save();
        }

        return res.status(200).json({
          success: true,
          action: 'verify',
          message: 'All pharmacies completed! Pickup verification successful.',
          allCompleted: true,
          currentPharmacy: {
            pharmacyId: pharmacyId,
            name: pharmacy.name,
            address: pharmacy.address
          },
          verifiedMedicine: {
            medicineId: medicineId,
            name: medicineItem.medicineId.name,
            quantity: medicineItem.quantity,
            imageUrl: uploadedImage.secure_url
          },
          pickupSummary: pickupSummary,
          nextPharmacy: null
        });
      }

      // ============= RETURN RESPONSE WITH NEXT PHARMACY =============
      return res.status(200).json({
        success: true,
        action: 'verify',
        message: 'Pickup verification successful',
        allCompleted: false,
        currentPharmacy: {
          pharmacyId: pharmacyId,
          name: pharmacy.name,
          address: pharmacy.address,
          completed: pendingPharmacies.find(p => p.pharmacyId === pharmacyId)?.medicines.length === 0 || false
        },
        verifiedMedicine: {
          medicineId: medicineId,
          name: medicineItem.medicineId.name,
          quantity: medicineItem.quantity,
          imageUrl: uploadedImage.secure_url
        },
        nextPharmacy: nextPharmacy ? {
          pharmacyId: nextPharmacy.pharmacyId,
          name: nextPharmacy.pharmacy.name,
          address: nextPharmacy.pharmacy.address,
          phone: nextPharmacy.pharmacy.vendorPhone,
          latitude: nextPharmacy.pharmacy.latitude,
          longitude: nextPharmacy.pharmacy.longitude,
          pendingMedicinesCount: nextPharmacy.medicines.length,
          pendingItemsQuantity: nextPharmacy.totalQuantity,
          medicines: nextPharmacy.medicines.map(m => ({
            medicineId: m.medicineId,
            name: m.name,
            quantity: m.quantity,
            mrp: m.mrp
          }))
        } : null,
        progress: {
          totalPharmacies: new Set(order.orderItems.map(i => 
            i.medicineId.pharmacyId._id?.toString() || i.medicineId.pharmacyId.toString()
          )).size,
          completedPharmacies: new Set(order.beforePickupProof.map(p => p.pharmacyId?.toString())).size,
          totalMedicines: order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
          pickedMedicines: order.beforePickupProof.length
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action. Use 'details' or 'verify'"
    });

  } catch (error) {
    console.error("❌ Pharmacy Pickup Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during pharmacy pickup verification",
      error: error.message
    });
  }
};

export const getAcceptedOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch the first accepted order that is not delivered
    const acceptedOrder = await Order.findOne({
      assignedRider: riderId,
      assignedRiderStatus: 'Accepted',
      status: { $ne: 'Delivered' } // Only fetch orders that are not delivered yet
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId', // Select the necessary fields
        populate: {
          path: 'pharmacyId',
          select: 'name address vendorPhone latitude longitude' // Populate pharmacyId fields
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location' // Select user fields
      })
      .lean();

    if (!acceptedOrder) {
      return res.status(404).json({ message: 'No accepted orders available for you at the moment.' });
    }

    // Fetch rider details
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process the accepted order
    const order = acceptedOrder;
    const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
    const userLocation = order.userId?.location?.coordinates;

    const pharmacyLat = parseFloat(pharmacy?.latitude);
    const pharmacyLon = parseFloat(pharmacy?.longitude);
    const userLat = userLocation?.[1];
    const userLon = userLocation?.[0];

    // Calculate distances
    const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
    const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

    // Time estimates
    const pickupMinutes = calculateTime(pickupDistance);
    const dropMinutes = calculateTime(dropDistance);

    const pickupTimeEstimate = addMinutesToTime(order.createdAt, pickupMinutes);
    const dropTimeEstimate = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

    const formattedPickupTime = formatTimeTo12Hour(pickupTimeEstimate);
    const formattedDropTime = formatTimeTo12Hour(dropTimeEstimate);

    // Add all the necessary data to the order response
    const orderResponse = {
      order,
      formattedPickupDistance: pickupDistance.toFixed(2),
      formattedDropDistance: dropDistance.toFixed(2),
      pickupTime: formattedPickupTime,
      dropTime: formattedDropTime
    };

    // Return the current active order
    return res.status(200).json({ acceptedOrder: orderResponse });

  } catch (error) {
    console.error("Error fetching accepted orders for rider:", error);
    return res.status(500).json({ message: "Server error while fetching accepted orders." });
  }
};



export const getPickedUpOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    const pickedUpOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: "PickedUp",
    })
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name address contactNumber latitude longitude",
        },
      })
      .populate({
        path: "userId",
        select: "name mobile location",
      })
      .lean();

    if (!pickedUpOrders || pickedUpOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "No picked up orders for you yet." });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const updatedOrders = pickedUpOrders.map((order) => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      const dropDistance = calculateDistance(
        [pharmacyLon, pharmacyLat],
        [userLon, userLat]
      );

      const dropMinutes = calculateTime(dropDistance);
      const dropTimeEstimate = addMinutesToTime(order.createdAt, dropMinutes);
      const formattedDropTime = formatTimeTo12Hour(dropTimeEstimate);

      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach((item) => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10;
      const deliveryCharge = parseFloat(rider.deliveryCharge) || 0;
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        order,
        formattedDropDistance: dropDistance.toFixed(2),
        dropTime: formattedDropTime,
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`,
        },
        // ✅ UPI ID sirf Cash on Delivery wale orders ke liye bhejna
        upiId: order.paymentMethod === "Cash on Delivery" ? (rider.upiId || "juleeperween@ybl") : null,
      };
    });

    return res.status(200).json({ pickedUpOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching picked up orders for rider:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching picked up orders." });
  }
};





export const updateRiderStatusController = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { orderId, newStatus, pharmacyId } = req.body;  // PharmacyId is still being sent in the request

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: 'This order is not assigned to you' });
    }

    const user = await User.findById(order.userId);
    if (!user) return res.status(404).json({ message: 'User not found for the order' });

    // 1. **Rider Rejected**:
    if (newStatus === 'Rejected') {
      if (!order.rejectedRiders) order.rejectedRiders = [];
      if (!order.rejectedRiders.includes(riderId)) {
        order.rejectedRiders.push(riderId);
      }

      order.assignedRider = null; // Clear rider
      order.assignedRiderStatus = 'Rejected';
      order.status = 'Rejected';

      order.statusTimeline.push({
        status: "Rejected",
        message: `Rider ${riderId} rejected the order`,
        timestamp: new Date(),
      });

      user.notifications.push({
        orderId: order._id,
        status: "Rejected",
        message: "Your order was rejected by the assigned rider. Searching for a new one...",
        timestamp: new Date(),
        read: false,
      });

      await user.save();
      await order.save();

      res.status(200).json({ message: "Order rejected. Will try to reassign shortly." });

      // Reassigning logic after rejection (as shown in the previous step)
      setTimeout(async () => {
        // Reassign logic remains the same
      }, 30 * 1000); // 30 seconds

      return;
    }

    // 2. **Rider Accepted**: 
    if (newStatus === 'Rider Accepted') {
      // Check if the pharmacy accepted
      if (!order.pharmacyResponses || !Array.isArray(order.pharmacyResponses)) {
        return res.status(400).json({ message: 'Invalid pharmacy responses' });
      }

      const pharmacyResponse = order.pharmacyResponses.find(
        response => response.pharmacyId.toString() === pharmacyId
      );

      if (!pharmacyResponse) {
        return res.status(404).json({ message: 'Pharmacy not found in responses' });
      }

      // Update pharmacy response with Rider Accepted status
      pharmacyResponse.status = 'Rider Accepted';
      pharmacyResponse.riderId = riderId; // Rider who accepted the order

      // If all pharmacies have accepted, update the order's status
      const allPharmaciesAccepted = order.pharmacyResponses.every(
        response => response.status === 'Rider Accepted'
      );

      if (allPharmaciesAccepted) {
        order.assignedRiderStatus = 'Accepted';
        order.status = 'Rider Accepted';
        order.statusTimeline.push({
          status: 'Rider Accepted',
          message: `All pharmacies have accepted the order. Rider ${riderId} is now assigned.`,
          timestamp: new Date(),
        });
      }

      user.notifications.push({
        orderId: order._id,
        status: "Rider Accepted",
        message: `Your order has been accepted by the rider and is now being processed.`,
        timestamp: new Date(),
        read: false,
      });

      await user.save();
      await order.save();

      return res.status(200).json({ message: "Rider has accepted the order." });
    }

    // 3. **Picked Up**: 
    if (newStatus === 'Picked Up') {
      order.assignedRiderStatus = 'Picked Up';
      order.status = 'Picked Up';
      order.statusTimeline.push({
        status: 'Picked Up',
        message: `Rider ${riderId} has picked up the order.`,
        timestamp: new Date(),
      });

      user.notifications.push({
        orderId: order._id,
        status: "Picked Up",
        message: `Your order has been picked up by the rider.`,
        timestamp: new Date(),
        read: false,
      });

      await user.save();
      await order.save();

      return res.status(200).json({ message: "Order picked up by the rider." });
    }

    // 4. **Completed**: 
    if (newStatus === 'Completed') {
      order.assignedRiderStatus = 'Completed';
      order.status = 'Completed';
      order.statusTimeline.push({
        status: 'Completed',
        message: `Rider ${riderId} has delivered the order.`,
        timestamp: new Date(),
      });

      user.notifications.push({
        orderId: order._id,
        status: "Completed",
        message: `Your order has been delivered successfully.`,
        timestamp: new Date(),
        read: false,
      });

      await user.save();
      await order.save();

      return res.status(200).json({ message: "Order completed and delivered to the user." });
    }

    // Default status update (for anything else like 'In Progress', etc.)
    order.assignedRiderStatus = newStatus;
    order.status = newStatus;

    order.statusTimeline.push({
      status: newStatus,
      message: `Rider updated status to ${newStatus}`,
      timestamp: new Date(),
    });

    user.notifications.push({
      orderId: order._id,
      status: newStatus,
      message: `Your order status was updated to: ${newStatus}`,
      timestamp: new Date(),
      read: false,
    });

    await user.save();
    await order.save();

    return res.status(200).json({ message: `Order status updated to ${newStatus}` });

  } catch (error) {
    console.error("Error updating rider status:", error);
    return res.status(500).json({ message: 'Server error while updating rider status' });
  }
};




export const getSingleOrderForRiderController = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Fetch order
    const order = await Order.findOne({
      _id: orderId,
      assignedRider: riderId,
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Add more fields as needed
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Full pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to rider' });
    }

    // Fetch rider
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);
    const deliveryCharge = parseFloat(rider.deliveryCharge) || 0;

    const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
    const userLocation = order.userId?.location?.coordinates;

    if (!pharmacy || !userLocation) {
      return res.status(400).json({ message: "Invalid pharmacy or user location" });
    }

    // Distance calculations
    const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacy.longitude, pharmacy.latitude]);
    const dropDistance = calculateDistance([pharmacy.longitude, pharmacy.latitude], [userLocation[0], userLocation[1]]);

    // Time estimations
    const pickupMinutes = calculateTime(pickupDistance);
    const dropMinutes = calculateTime(dropDistance);
    const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
    const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);
    const formattedPickupTime = formatTimeTo12Hour(pickupTime);
    const formattedDropTime = formatTimeTo12Hour(dropTime);

    // Billing calculations
    const totalItems = order.orderItems.length;
    let subTotal = 0;

    order.orderItems.forEach(item => {
      const mrp = item?.medicineId?.mrp || 0;
      const quantity = item?.quantity || 1;
      subTotal += mrp * quantity;
    });

    const platformFee = 10; // Static
    const estimatedEarning = deliveryCharge;
    const totalPaid = subTotal + platformFee + deliveryCharge;

    return res.status(200).json({
      order,
      pickupDistance: `${pickupDistance.toFixed(2)} km`,
      dropDistance: `${dropDistance.toFixed(2)} km`,
      pickupTime: formattedPickupTime,
      dropTime: formattedDropTime,
      estimatedEarning: `₹${estimatedEarning.toFixed(2)}`,
      billingDetails: {
        totalItems,
        subTotal: `₹${subTotal.toFixed(2)}`,
        platformFee: `₹${platformFee.toFixed(2)}`,
        deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
        totalPaid: `₹${totalPaid.toFixed(2)}`
      }
    });

  } catch (error) {
    console.error("Error fetching single order for rider:", error);
    res.status(500).json({ message: "Server error while fetching order" });
  }
};

export const getAllActiveOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch all active orders for rider
    const activeOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: 'Accepted'
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Populating medicine details
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Populating pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'  // Populating user details
      })
      .lean();

    if (!activeOrders || activeOrders.length === 0) {
      return res.status(404).json({ message: 'No active orders found' });
    }

    // Get rider location
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process each active order
    const updatedOrders = activeOrders.map(order => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      if (!pharmacy || !userLocation) return order;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      // Distance and time calculations
      const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
      const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

      const pickupMinutes = calculateTime(pickupDistance);
      const dropMinutes = calculateTime(dropDistance);

      const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
      const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

      // Billing calculations
      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach(item => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10; // Static platform fee
      const deliveryCharge = parseFloat(rider.deliveryCharge) || 0; // Rider's delivery charge
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        ...order,
        formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
        formattedDropDistance: `${dropDistance.toFixed(2)} km`,
        pickupTime: formatTimeTo12Hour(pickupTime),
        dropTime: formatTimeTo12Hour(dropTime),
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`
        }
      };
    });

    return res.status(200).json({ activeOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching active orders:", error);
    return res.status(500).json({ message: "Server error while fetching active orders" });
  }
};



export const getAllCompletedOrdersForRiderController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch all completed orders for rider
    const completedOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: 'Completed',
      status: 'Delivered' // Order should be delivered
    })
      .populate({
        path: 'orderItems.medicineId',
        select: 'name mrp description images pharmacyId',  // Populating medicine details
        populate: {
          path: 'pharmacyId',
          select: 'name address contactNumber latitude longitude' // Populating pharmacy details
        }
      })
      .populate({
        path: 'userId',
        select: 'name mobile location'  // Populating user details
      })
      .lean();

    if (!completedOrders || completedOrders.length === 0) {
      return res.status(404).json({ message: 'No completed orders found' });
    }

    // Get rider location
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const riderLat = parseFloat(rider.latitude);
    const riderLon = parseFloat(rider.longitude);

    // Process each completed order
    const updatedOrders = completedOrders.map(order => {
      const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
      const userLocation = order.userId?.location?.coordinates;

      if (!pharmacy || !userLocation) return order;

      const pharmacyLat = parseFloat(pharmacy?.latitude);
      const pharmacyLon = parseFloat(pharmacy?.longitude);
      const userLat = userLocation?.[1];
      const userLon = userLocation?.[0];

      // Distance and time calculations
      const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
      const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

      const pickupMinutes = calculateTime(pickupDistance);
      const dropMinutes = calculateTime(dropDistance);

      const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
      const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

      // Billing calculations
      const totalItems = order.orderItems.length;
      let subTotal = 0;

      order.orderItems.forEach(item => {
        const mrp = item?.medicineId?.mrp || 0;
        const quantity = item?.quantity || 1;
        subTotal += mrp * quantity;
      });

      const platformFee = 10; // Static platform fee
      const deliveryCharge = parseFloat(rider.deliveryCharge) || 0; // Rider's delivery charge
      const totalPaid = subTotal + platformFee + deliveryCharge;

      return {
        ...order,
        formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
        formattedDropDistance: `${dropDistance.toFixed(2)} km`,
        pickupTime: formatTimeTo12Hour(pickupTime),
        dropTime: formatTimeTo12Hour(dropTime),
        billingDetails: {
          totalItems,
          subTotal: `₹${subTotal.toFixed(2)}`,
          platformFee: `₹${platformFee.toFixed(2)}`,
          deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
          totalPaid: `₹${totalPaid.toFixed(2)}`
        }
      };
    });

    return res.status(200).json({ completedOrders: updatedOrders });
  } catch (error) {
    console.error("Error fetching completed orders:", error);
    return res.status(500).json({ message: "Server error while fetching completed orders" });
  }
};




// export const getAllPreviousOrdersForRiderController = async (req, res) => {
//   try {
//     const { riderId } = req.params;

//     // Validate riderId
//     if (!mongoose.Types.ObjectId.isValid(riderId)) {
//       return res.status(400).json({ message: "Invalid rider ID" });
//     }

//     // Fetch all active orders for rider
//     const activeOrders = await Order.find({
//       assignedRider: riderId,
//       assignedRiderStatus: 'Completed'
//     })
//       .populate({
//         path: 'orderItems.medicineId',
//         select: 'name mrp description images pharmacyId',  // Populating medicine details
//         populate: {
//           path: 'pharmacyId',
//           select: 'name address contactNumber latitude longitude' // Populating pharmacy details
//         }
//       })
//       .populate({
//         path: 'userId',
//         select: 'name mobile location'  // Populating user details
//       })
//       .lean();

//     if (!activeOrders || activeOrders.length === 0) {
//       return res.status(404).json({ message: 'No active orders found' });
//     }

//     // Get rider location
//     const rider = await Rider.findById(riderId);
//     if (!rider) return res.status(404).json({ message: 'Rider not found' });

//     const riderLat = parseFloat(rider.latitude);
//     const riderLon = parseFloat(rider.longitude);

//     // Process each active order
//     const updatedOrders = activeOrders.map(order => {
//       const pharmacy = order.orderItems[0]?.medicineId?.pharmacyId;
//       const userLocation = order.userId?.location?.coordinates;

//       if (!pharmacy || !userLocation) return order;

//       const pharmacyLat = parseFloat(pharmacy?.latitude);
//       const pharmacyLon = parseFloat(pharmacy?.longitude);
//       const userLat = userLocation?.[1];
//       const userLon = userLocation?.[0];

//       // Distance and time calculations
//       const pickupDistance = calculateDistance([riderLon, riderLat], [pharmacyLon, pharmacyLat]);
//       const dropDistance = calculateDistance([pharmacyLon, pharmacyLat], [userLon, userLat]);

//       const pickupMinutes = calculateTime(pickupDistance);
//       const dropMinutes = calculateTime(dropDistance);

//       const pickupTime = addMinutesToTime(order.createdAt, pickupMinutes);
//       const dropTime = addMinutesToTime(order.createdAt, pickupMinutes + dropMinutes);

//       // Billing calculations
//       const totalItems = order.orderItems.length;
//       let subTotal = 0;

//       order.orderItems.forEach(item => {
//         const mrp = item?.medicineId?.mrp || 0;
//         const quantity = item?.quantity || 1;
//         subTotal += mrp * quantity;
//       });

//       const platformFee = 10; // Static platform fee
//       const deliveryCharge = parseFloat(rider.deliveryCharge) || 0; // Rider's delivery charge
//       const totalPaid = subTotal + platformFee + deliveryCharge;

//       return {
//         ...order,
//         formattedPickupDistance: `${pickupDistance.toFixed(2)} km`,
//         formattedDropDistance: `${dropDistance.toFixed(2)} km`,
//         pickupTime: formatTimeTo12Hour(pickupTime),
//         dropTime: formatTimeTo12Hour(dropTime),
//         billingDetails: {
//           totalItems,
//           subTotal: `₹${subTotal.toFixed(2)}`,
//           platformFee: `₹${platformFee.toFixed(2)}`,
//           deliveryCharge: `₹${deliveryCharge.toFixed(2)}`,
//           totalPaid: `₹${totalPaid.toFixed(2)}`
//         }
//       };
//     });

//     return res.status(200).json({ activeOrders: updatedOrders });
//   } catch (error) {
//     console.error("Error fetching active orders:", error);
//     return res.status(500).json({ message: "Server error while fetching active orders" });
//   }
// };






// Add bank details to rider profile
export const addBankDetailsToRider = async (req, res) => {
  try {
    const { riderId } = req.params;
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId
    } = req.body;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({ message: "All required bank fields must be provided" });
    }

    const rider = await Rider.findById(riderId);

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const newBankDetail = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId: upiId || null
    };

    rider.accountDetails.push(newBankDetail);
    await rider.save();

    return res.status(200).json({
      message: "Bank details added successfully",
      accountDetails: rider.accountDetails
    });

  } catch (error) {
    console.error("Error adding bank details:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const getRiderBankDetails = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    const rider = await Rider.findById(riderId).select('accountDetails');

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Bank details fetched successfully",
      accountDetails: rider.accountDetails
    });

  } catch (error) {
    console.error("Error fetching bank details:", error);
    return res.status(500).json({
      message: "Server error while fetching bank details",
      error: error.message
    });
  }
};


export const markOrderAsDeliveredController = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;
    const { collectedAmount, paymentMethodType } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate rider assignment
    if (order.assignedRider?.toString() !== riderId) {
      return res.status(403).json({ message: "This order is not assigned to you" });
    }

    // Check delivery proof
    if (!order.deliveryProof || order.deliveryProof.length === 0) {
      return res.status(400).json({
        message: "Please upload delivery proof before marking the order as delivered.",
      });
    }

    // Handle COD (Cash on Delivery)
    if (order.paymentMethod === "Cash on Delivery") {
      if (!paymentMethodType || !["cash", "online"].includes(paymentMethodType)) {
        return res.status(400).json({
          message: "Payment method type must be 'cash' or 'online'.",
        });
      }

      if (collectedAmount === undefined || isNaN(collectedAmount)) {
        return res.status(400).json({
          message: "Collected amount is required for all COD payments (cash or online).",
        });
      }

      const parsedAmount = parseFloat(collectedAmount);

      // Store in DB
      order.collectedAmount = parsedAmount;
      order.codAmountReceived = parsedAmount;
      order.codPaymentMode = paymentMethodType;
      order.paymentMethodStatus = "Paid";

      if (paymentMethodType === "online") {
        order.isCodPaidOnline = true;
        order.upiPaidAt = new Date();
      }
    }

    // Fetch rider
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const deliveryCharge = parseFloat(order.deliveryCharge) || 0;  // Get delivery charge from the order

    // Update order status to Delivered
    order.status = "Delivered";
    order.paymentStatus = "Completed";
    order.assignedRiderStatus = "Completed";

    // Add to status timeline
    order.statusTimeline.push({
      status: "Delivered",
      message: `Order delivered by rider ${rider.name || riderId}`,
      timestamp: new Date(),
    });

    // Add COD payment status if applicable
    if (order.paymentMethod === "Cash on Delivery") {
      order.statusTimeline.push({
        status: "COD Collected",
        message:
          paymentMethodType === "cash"
            ? `₹${collectedAmount} collected in cash by rider ${rider.name || riderId}`
            : `₹${collectedAmount} received via UPI (QR scanned) by customer.`,
        timestamp: new Date(),
      });
    }

    // Update rider wallet
    rider.wallet += deliveryCharge;  // Add delivery charge to rider's wallet
    rider.walletTransactions.push({
      amount: deliveryCharge,
      type: "credit",
      createdAt: new Date(),
    });


  // Update pharmacy wallet
const pharmacy = await Pharmacy.findById(order.assignedPharmacy);
if (pharmacy) {
  let pharmacyEarning = 0;

  for (const item of order.orderItems) {
    const medicine = await Medicine.findById(item.medicineId);
    if (!medicine) continue;

    pharmacyEarning += (medicine.price || 0) * (item.quantity || 0);
  }

  pharmacy.wallet = (pharmacy.wallet || 0) + pharmacyEarning;
  pharmacy.walletTransactions.push({
    amount: pharmacyEarning,
    type: "credit",
    orderId: order._id,
    createdAt: new Date(),
  });

  await pharmacy.save();
}


    // Save order and rider updates
    await Promise.all([order.save(), rider.save()]);

    return res.status(200).json({
      message: "Order marked as delivered successfully",
      updatedWallet: `₹${rider.wallet.toFixed(2)}`,  // Return the updated wallet balance
    });

  } catch (error) {
    console.error("Error marking order as delivered:", error);
    res.status(500).json({ message: "Server error while updating delivery status" });
  }
};


// Controller: paymentController.js

export const getUpiInfo = async (req, res) => {
  try {
    const upiId = "juleeperween@ybl";

    // Generate QR code using public QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${upiId}&pn=CLYNIX`;

    return res.status(200).json({
      message: "UPI info fetched successfully",
      upiId,
      qrCodeUrl,
    });
  } catch (error) {
    console.error("Error fetching UPI info:", error);
    return res.status(500).json({
      message: "Server error while fetching UPI info",
      error: error.message,
    });
  }
};


export const getRiderWalletController = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate Rider ID
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch Rider
    const rider = await Rider.findById(riderId).select(
      "name wallet deliveryCharge createdAt"
    );

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const deliveryCharge = parseFloat(rider.deliveryCharge || 0);

    // Use rider's createdAt as start date and now as end date
    const startDate = new Date(rider.createdAt);
    const endDate = new Date();

    // Fetch all completed orders in date range
    const completedOrders = await Order.find({
      assignedRider: riderId,
      assignedRiderStatus: "Completed",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const totalEarnings = completedOrders.length * deliveryCharge;

    // Format date range
    const formattedStart = moment(startDate).format("DD MMM YYYY");
    const formattedEnd = moment(endDate).format("DD MMM YYYY");

    return res.status(200).json({
      wallet: `₹${(rider.wallet || 0).toFixed(2)}`,
      totalEarningsMessage: `Total Earnings from ${formattedStart} to ${formattedEnd}: ₹${totalEarnings.toFixed(
        2
      )}`,
    });
  } catch (error) {
    console.error("Error fetching rider wallet:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching wallet" });
  }
};


export const withdrawAmountFromWalletController = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { amount, bankId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({ message: "Invalid riderId or bankId" });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const walletBalance = parseFloat(rider.wallet || 0);
    if (amount > walletBalance) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    const bankDetail = rider.accountDetails.find(b => b._id.toString() === bankId);
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // Create a new withdrawal request (but don't deduct now)
    const request = new withdrawalRequestModel({
      riderId,
      amount,
      bankDetail: {
        accountHolderName: bankDetail.accountHolderName,
        accountNumber: bankDetail.accountNumber,
        ifscCode: bankDetail.ifscCode,
        bankName: bankDetail.bankName,
        upiId: bankDetail.upiId || null
      },
      status: 'Requested'
    });

    await request.save();

    return res.status(200).json({
      message: "Withdrawal request submitted successfully. Awaiting approval.",
      requestId: request._id,
      status: request.status
    });

  } catch (error) {
    console.error("Error submitting withdrawal request:", error);
    return res.status(500).json({ message: "Server error during withdrawal request" });
  }
};



// ✅ Get Rider Notifications
export const getRiderNotifications = async (req, res) => {
  try {
    const { riderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid Rider ID" });
    }

    const rider = await Rider.findById(riderId).select("notifications");

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      message: "Rider notifications fetched successfully",
      notifications: rider.notifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt) // latest first
      ),
    });
  } catch (error) {
    console.error("Error fetching rider notifications:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// ✅ Change Rider Status (online / offline) — returns only status
export const updateRiderStatus = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body; // "online" | "offline"

    if (!["online", "offline"].includes(status)) {
      return res.status(400).json({ message: "Invalid status (use online/offline)" });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    rider.status = status;
    await rider.save();

    return res.status(200).json({ status }); // ✅ Only return status

  } catch (error) {
    console.error("Error updating rider status:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



export const getRiderOrdersByStatus = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { assignedRiderStatus, status } = req.query;

    // ✅ Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // ✅ Check if rider exists
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // ✅ Build dynamic query
    const query = {
      assignedRider: riderId,
    };

    // 👉 Apply filters only if they exist
    if (assignedRiderStatus) {
      query.assignedRiderStatus = assignedRiderStatus;
    }

    if (status) {
      query.status = status;
    }

    // ✅ Fetch orders with populate
    const orders = await Order.find(query)
      .populate({
        path: "orderItems.medicineId",
        select: "name mrp description images pharmacyId",
        populate: {
          path: "pharmacyId",
          select: "name address contactNumber latitude longitude",
        },
      })
      .populate({
        path: "userId",
        select: "name mobile location",
      })
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No matching orders found" });
    }

    return res.status(200).json({
      message: "Orders fetched successfully",
      orders,
    });
  } catch (error) {
    console.error("Error fetching rider orders:", error);
    return res.status(500).json({
      message: "Server error while fetching orders",
      error: error.message,
    });
  }
};






// 📊 Rider Earnings Graph (from walletTransactions)
export const getRiderEarningsGraph = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { filter } = req.query; // today | yesterday | thisWeek | lastWeek | thisMonth | lastMonth | last6Months | last8Months | last1Year

    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    const rider = await Rider.findById(riderId).select("name wallet walletTransactions");
    if (!rider) return res.status(404).json({ message: "Rider not found" });

    const now = moment();
    const ranges = {
      today: [now.clone().startOf("day"), now.clone().endOf("day")],
      yesterday: [now.clone().subtract(1, "days").startOf("day"), now.clone().subtract(1, "days").endOf("day")],
      thisWeek: [now.clone().startOf("week"), now.clone().endOf("week")],
      lastWeek: [now.clone().subtract(1, "week").startOf("week"), now.clone().subtract(1, "week").endOf("week")],
      thisMonth: [now.clone().startOf("month"), now.clone().endOf("month")],
      lastMonth: [now.clone().subtract(1, "month").startOf("month"), now.clone().subtract(1, "month").endOf("month")],
      last6Months: [now.clone().subtract(6, "months").startOf("month"), now.clone().endOf("month")],
      last8Months: [now.clone().subtract(8, "months").startOf("month"), now.clone().endOf("month")],
      last1Year: [now.clone().subtract(1, "year").startOf("day"), now.clone().endOf("day")],
    };

    const [start, end] = ranges[filter] || ranges.thisWeek;

    // ✅ Filter transactions
    const transactions = rider.walletTransactions.filter(txn =>
      moment(txn.createdAt).isBetween(start, end, null, "[]")
    );

    // ✅ Group by day
    const earningsByDay = {};
    transactions.forEach(txn => {
      const day = moment(txn.createdAt).format("DD MMM");
      if (!earningsByDay[day]) earningsByDay[day] = 0;
      earningsByDay[day] += txn.amount;
    });

    // ✅ Sorted chart data
    const chartData = Object.keys(earningsByDay).sort((a, b) => moment(a, "DD MMM") - moment(b, "DD MMM"))
      .map(day => ({
        day,
        earnings: earningsByDay[day]
      }));

    return res.status(200).json({
      rider: rider.name,
      filter,
      totalEarnings: transactions.reduce((sum, t) => sum + t.amount, 0),
      walletBalance: rider.wallet,
      chartData
    });
  } catch (error) {
    console.error("Error fetching rider earnings graph:", error);
    return res.status(500).json({ message: "Server error while fetching earnings graph" });
  }
};


// ✅ Get Rider Driving License
export const getRiderDrivingLicense = async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Fetch Rider only with drivingLicense
    const rider = await Rider.findById(riderId).select("drivingLicense");
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({
      riderId,
      drivingLicense: rider.drivingLicense || null,
    });
  } catch (error) {
    console.error("Error fetching driving license:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching driving license" });
  }
};


export const updateRiderLocation = async (req, res) => {
  try {
    const { riderId } = req.params; // URL se riderId le rahe hain
    const { latitude, longitude } = req.body;

    if (!riderId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'riderId, latitude, and longitude are required' });
    }

    const updatedRider = await Rider.findByIdAndUpdate(
      riderId,
      {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      },
      { new: true }
    );

    if (!updatedRider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    return res.status(200).json({
      message: 'Rider location updated successfully',
      latitude: updatedRider.latitude,
      longitude: updatedRider.longitude,
    });
  } catch (error) {
    console.error('Error updating rider location:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


export const uploadDeliveryProof = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Check for uploaded image
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure rider is assigned to the order
    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: "Rider is not assigned to this order" });
    }

    // Upload image to Cloudinary
    const file = req.files.image;
    const uploadResponse = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "order_delivery_proofs",
    });

    // Push delivery proof into order
    order.deliveryProof.push({
      riderId,
      imageUrl: uploadResponse.secure_url,
      uploadedAt: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Delivery proof uploaded successfully",
      deliveryProof: order.deliveryProof,
    });
  } catch (error) {
    console.error("🔥 Error in uploadDeliveryProof:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const createRiderQuery = async (req, res) => {
  try {
    // Destructure the body to get the necessary fields
    const { riderId, name, email, mobile, message } = req.body;

    // Validate that riderId exists (optional but recommended)
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Create a new query document for the rider
    const query = new Query({
      riderId,
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
    console.error("Error creating rider query:", error);
    res.status(500).json({ message: "Error creating query", error });
  }
};



export const uploadMedicineProof = async (req, res) => {
  try {
    const { riderId, orderId } = req.params;

    // Check for uploaded image
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(riderId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid rider ID or order ID" });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure rider is assigned to the order
    if (!order.assignedRider || order.assignedRider.toString() !== riderId) {
      return res.status(403).json({ message: "Rider is not assigned to this order" });
    }

    // Get first medicine from order to find pharmacy
    if (!order.orderItems || order.orderItems.length === 0) {
      return res.status(400).json({ message: "No medicine items found in order" });
    }

    const firstMedicineId = order.orderItems[0].medicineId;
    
    // Find medicine details
    const medicine = await Medicine.findById(firstMedicineId);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    // Find pharmacy details
    const pharmacy = await Pharmacy.findById(medicine.pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    // Find rider details for current location
    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Check if rider has latitude and longitude
    if (!rider.latitude || !rider.longitude) {
      return res.status(400).json({ 
        message: "Rider location not available. Please enable location services." 
      });
    }

    // Check if rider is at vendor's location
    const riderLat = parseFloat(rider.latitude);
    const riderLng = parseFloat(rider.longitude);
    const pharmacyLat = pharmacy.latitude;
    const pharmacyLng = pharmacy.longitude;

    // Calculate distance between rider and pharmacy (in kilometers)
    const distanceInKm = calculateDistance(
      [riderLng, riderLat],  // [longitude, latitude]
      [pharmacyLng, pharmacyLat]  // [longitude, latitude]
    );

    // Convert km to meters for proximity check
    const distanceInMeters = distanceInKm * 1000;

    // Set proximity threshold (e.g., 100 meters)
    const PROXIMITY_THRESHOLD = 100;

    if (distanceInMeters > PROXIMITY_THRESHOLD) {
      return res.status(403).json({ 
        message: "You are not at the vendor's location. Please go to the vendor's location first.",
        distance: Math.round(distanceInMeters),
        threshold: PROXIMITY_THRESHOLD
      });
    }

    // Upload image to Cloudinary
    const file = req.files.image;
    const uploadResponse = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: "medicine_pickup_proofs",
    });

    // Create beforePickupProof field if it doesn't exist in order schema
    if (!order.beforePickupProof) {
      order.beforePickupProof = [];
    }

    order.beforePickupProof.push({
      riderId,
      imageUrl: uploadResponse.secure_url,
      uploadedAt: new Date(),
      medicineId: firstMedicineId,
      pharmacyId: medicine.pharmacyId
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Medicine proof uploaded successfully",
      medicineProof: order.beforePickupProof,
      distance: Math.round(distanceInMeters),
      locationVerified: true
    });
  } catch (error) {
    console.error("🔥 Error in uploadMedicineProof:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// // Helper function to calculate distance between two coordinates (Haversine formula)
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371e3; // Earth's radius in meters
//   const φ1 = (lat1 * Math.PI) / 180;
//   const φ2 = (lat2 * Math.PI) / 180;
//   const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//   const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//   const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//             Math.cos(φ1) * Math.cos(φ2) *
//             Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c; // Distance in meters
// }


