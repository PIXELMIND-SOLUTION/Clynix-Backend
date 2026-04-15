import mongoose from 'mongoose';

const { Schema } = mongoose;


// User Schema without required and trim
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    // Removed 'required' and 'trim'
  },
  email: {
    type: String,
    lowercase: true,
  },
  mobile: {
    type: String,
  },
  otp: {
    type: String,
  },
  password: {
  type: String,
},
 code: {
  type: String,
},
 // ✅ Moved location here (root level)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  myAddresses: [
    {
      house: { type: String, },
      street: { type: String, },
      city: { type: String, },
      state: { type: String, },
      pincode: { type: String, },
      country: { type: String,}
    }
  ],
  notifications: [
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    status: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    },
  
  type: {
        type: String,
        enum: ['Order', 'Pharmacy', 'PeriodicOrder', 'prescription_order_preview', 'order_confirmed', 'rider_assigned'],
        default: 'Order'
      },
      prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
      },
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy'
      },
      orderPreview: {
        type: mongoose.Schema.Types.Mixed
      }
    }
],

  profileImage: {
    type: String,
    default:
      'https://img.freepik.com/premium-vector/student-avatar-illustration-user-profile-icon-youth-avatar_118339-4406.jpg?w=2000'
  },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"], // optional, for control
      default: "active", // ✅ default value
    },
      periodicMedsPlan: {
    isActive: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true  // CreatedAt and UpdatedAt fields automatically
});

userSchema.index({ location: '2dsphere' });


// Create model based on schema
const User = mongoose.model('User', userSchema);

export default User;
