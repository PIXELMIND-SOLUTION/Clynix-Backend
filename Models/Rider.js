import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
    latitude: { type: String },
    longitude: { type: String },
    profileImage: { type: String }, // Single file
    rideImages: [{ type: String }], // Multiple files
    deliveryCharge: { type: Number, default: 0 },
    password: { type: String }, // ✅ password field
    drivingLicense: { type: String, default: null }, // ✅ new field added
    drivingLicenseStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"], // Status options
      default: "Pending", // Default status is "Pending"
    },
    accountDetails: [
      {
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        upiId: String, // optional
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    wallet: {
      type: Number,
      default: 0,
    },
    walletTransactions: [
      {
        amount: { type: Number, },
        type: { type: String, enum: ["credit", "debit"], default: "credit" },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "online", // Default status is online
    },

    // Delivery charge configuration
    baseFare: { type: Number }, // Base fare for first 2km
    baseDistanceKm: { type: Number }, // Base distance in km
    additionalChargePerKm: { type: Number }, // Extra charge per km beyond base
    deliveryCharge: { type: Number}, // Kept for backward compatibility
    profileImage: {
      type: String,
      default: "", // or a default image URL
    },

    // Rider notifications (with full order details)
    notifications: [
      {
        message: String,
        order: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
          user: {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: String,
            phone: String,
          },
          deliveryAddress: Object,
          orderItems: [
            {
              medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
              quantity: Number,
              name: String,
              price: Number,
              images: [String],
              description: String,
              pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy" },
            },
          ],
          subTotal: Number,
          platformFee: Number,
          deliveryCharge: Number,
          totalAmount: Number,
          notes: String,
          voiceNoteUrl: String,
          paymentMethod: String,
          paymentStatus: String,
          status: String,
          statusTimeline: [
            {
              status: String,
              message: String,
              timestamp: Date,
            },
          ],
        },
        createdAt: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Rider", riderSchema);
